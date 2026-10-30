const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../index');

async function fixture(t, store) {
    const logs = [];
    const server = createApp({ store, logger: { error: line => logs.push(line) } }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    return { base, logs, request: (url, options) => fetch(base + url, options) };
}

async function formToken(request) {
    const response = await request('/update-cobj');
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Update Custom Object Form \| Integrating With HubSpot I Practicum/);
    assert.match(html, /Return to the homepage/);
    return html.match(/name="csrf_token" value="([a-f0-9]{64})"/)[1];
}

function post(fields) {
    return { method: 'POST', body: new URLSearchParams(fields), redirect: 'manual' };
}

test('GET table → form → POST → redirect shows the new CRM record', async t => {
    const records = [];
    const f = await fixture(t, { list: async () => records, create: async properties => records.push({ id: '1', properties }) });
    assert.match(await (await f.request('/')).text(), /Add to this table/);
    const token = await formToken(f.request);
    const response = await f.request('/update-cobj', post({ csrf_token: token, name: ' Fern ', species: 'Nephrolepis', care_notes: 'Keep moist' }));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), '/?created=1');
    const page = await f.request('/?created=1');
    assert.match(await page.text(), /Fern.*Nephrolepis.*Keep moist/);
    assert.equal(records[0].properties.name, 'Fern');
    assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
});

test('invalid, duplicate, oversized and unexpected input never creates a CRM record', async t => {
    let writes = 0;
    const f = await fixture(t, { list: async () => [], create: async () => writes++ });
    const csrf_token = await formToken(f.request);
    const valid = { csrf_token, name: 'Fern', species: 'N', care_notes: 'Water' };
    assert.equal((await f.request('/update-cobj', post({ ...valid, name: ' ' }))).status, 422);
    // Duplicate keys are refused before a CRM write.
    const duplicate = new URLSearchParams(valid); duplicate.append('name', 'Second');
    assert.equal((await f.request('/update-cobj', { method: 'POST', body: duplicate })).status, 413);
    assert.equal((await f.request('/update-cobj', post({ ...valid, care_notes: 'x'.repeat(1001) }))).status, 422);
    const unknown = new URLSearchParams({ csrf_token, name: 'Fern', species: 'N', admin: 'true' });
    assert.equal((await f.request('/update-cobj', { method: 'POST', body: unknown })).status, 422);
    assert.equal((await f.request('/update-cobj', post({ ...valid, care_notes: 'x'.repeat(9000) }))).status, 413);
    assert.equal(writes, 0);
});

test('missing/forged tokens and rebinding Host are refused', async t => {
    let writes = 0;
    const f = await fixture(t, { list: async () => [], create: async () => writes++ });
    assert.equal((await f.request('/update-cobj', post({ name: 'Fern' }))).status, 403);
    assert.equal((await f.request('/update-cobj', post({ csrf_token: 'x'.repeat(64) }))).status, 403);
    const hostileStatus = await new Promise((resolve, reject) => {
        const request = http.get(f.base + '/', { headers: { Host: 'attacker.example' } }, response => {
            response.resume(); resolve(response.statusCode);
        });
        request.on('error', reject);
    });
    assert.equal(hostileStatus, 403);
    assert.equal(writes, 0);
});

test('CRM and reflected form values are HTML escaped', async t => {
    const payload = '<script>alert(1)</script>';
    const f = await fixture(t, { list: async () => [{ properties: { name: payload, species: 'N', care_notes: payload } }], create: async () => {} });
    const html = await (await f.request('/')).text();
    assert.ok(!html.includes(payload)); assert.match(html, /&lt;script&gt;/);
    const csrf_token = await formToken(f.request);
    const invalid = await f.request('/update-cobj', post({ csrf_token, name: payload, species: '', care_notes: payload }));
    assert.equal(invalid.status, 422);
    assert.ok(!(await invalid.text()).includes(payload));
});

test('upstream errors produce safe messages, hide credentials and warn on uncertain writes', async t => {
    const secret = 'sensitive-test-marker';
    const error = Object.assign(new Error(secret), { config: { headers: { Authorization: secret } }, response: { status: 401, data: secret } });
    const f = await fixture(t, { list: async () => { throw error; }, create: async () => { throw error; } });
    const response = await f.request('/');
    assert.equal(response.status, 502);
    const html = await response.text();
    assert.match(html, /HubSpot rejected the access token/); assert.ok(!html.includes(secret));
    const csrf_token = await formToken(f.request);
    const failed = await f.request('/update-cobj', post({ csrf_token, name: 'A', species: 'B', care_notes: 'C' }));
    assert.equal(failed.status, 502);
    assert.match(await failed.text(), /check the homepage before submitting again/);
    assert.ok(!f.logs.join('').includes(secret));
});

test('CSS loads and unknown pages return 404', async t => {
    const f = await fixture(t, { list: async () => [], create: async () => {} });
    assert.equal((await f.request('/css/style.css')).status, 200);
    assert.equal((await f.request('/missing')).status, 404);
    assert.equal((await f.request('/.env')).status, 404);
});
