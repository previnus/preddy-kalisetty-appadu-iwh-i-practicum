const path = require('node:path');
const { randomBytes, timingSafeEqual } = require('node:crypto');
const express = require('express');
const { loadConfig } = require('./lib/config');
const { createClient, createPlantStore, safeErrorMessage } = require('./lib/hubspot');
const { validatePlant } = require('./lib/plants');

function createApp({ store, logger = console } = {}) {
    if (!store) throw new Error('A plant store is required.');
    const app = express();
    const formToken = randomBytes(32).toString('hex');
    app.disable('x-powered-by');
    app.set('view engine', 'pug');
    app.set('views', path.join(__dirname, 'views'));
    app.use((req, res, next) => {
        res.set({
            'Content-Security-Policy': "default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
            'Cache-Control': 'no-store'
        });
        // Loopback binding plus Host validation closes the DNS-rebinding path.
        if (!/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(req.get('host') || '')) {
            return res.status(403).send('Open this app through localhost or 127.0.0.1.');
        }
        next();
    });
    app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'deny' }));
    app.use(express.urlencoded({ extended: false, limit: '8kb', parameterLimit: 4 }));

    // Route 1: request every custom property and render the HubSpot records.
    app.get('/', async (req, res, next) => {
        try {
            const data = await store.list();
            res.render('homepage', {
                title: 'Plants | Integrating With HubSpot I Practicum',
                data, created: req.query.created === '1'
            });
        } catch (error) { next(error); }
    });

    // Route 2: render the required creation form.
    app.get('/update-cobj', (req, res) => {
        res.render('updates', {
            title: 'Update Custom Object Form | Integrating With HubSpot I Practicum',
            values: {}, errors: [], formToken
        });
    });

    // Route 3: create one CRM record, then redirect to the homepage.
    app.post('/update-cobj', async (req, res, next) => {
        const submittedToken = req.body?.csrf_token;
        if (typeof submittedToken !== 'string' || !/^[a-f0-9]{64}$/.test(submittedToken) ||
            !timingSafeEqual(Buffer.from(submittedToken), Buffer.from(formToken)) ||
            req.get('sec-fetch-site') === 'cross-site') {
            return res.status(403).render('error', {
                title: 'Form expired', message: 'Open the form again from this app before submitting.'
            });
        }
        const { values, errors } = validatePlant(req.body);
        if (errors.length) {
            return res.status(422).render('updates', {
                title: 'Update Custom Object Form | Integrating With HubSpot I Practicum',
                values, errors, formToken
            });
        }
        try {
            await store.create(values);
            res.redirect(303, '/?created=1');
        } catch (error) { next(error); }
    });

    app.use((req, res) => res.status(404).render('error', {
        title: 'Page not found', message: 'That page does not exist. Return to your plants below.'
    }));
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        const bodyError = ['entity.too.large', 'parameters.too.many'].includes(error.type);
        const parseError = ['entity.parse.failed', 'charset.unsupported', 'encoding.unsupported'].includes(error.type);
        // Axios errors include request headers. Log only safe status categories.
        const status = bodyError ? 413 : parseError ? 400 : 502;
        logger.error(`Request failed (HTTP ${status}; upstream ${Number(error.response?.status) || 'unavailable'}).`);
        res.status(status).render('error', {
            title: 'Unable to complete request',
            message: bodyError ? 'The submitted form is too large.' :
                parseError ? 'Submit the form using its original text fields.' : safeErrorMessage(error),
            uncertainCreate: req.method === 'POST' && !bodyError && !parseError
        });
    });
    return app;
}

if (require.main === module) {
    try {
        const config = loadConfig();
        const store = createPlantStore(createClient(config.token), config.objectType);
        const app = createApp({ store });
        const server = app.listen(config.port, '127.0.0.1', () => {
            console.log(`Listening on http://localhost:${config.port}`);
        });
        server.on('error', () => {
            console.error('Unable to start the local server. Check that PORT is available.');
            process.exitCode = 1;
        });
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

module.exports = { createApp };
