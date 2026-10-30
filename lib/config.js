const path = require('node:path');
const dotenv = require('dotenv');

function parseConfig(env, { requireObject = true } = {}) {
    const token = (env.HUBSPOT_ACCESS_TOKEN || '').trim();
    const accountId = (env.HUBSPOT_TEST_ACCOUNT_ID || '').trim();
    const objectType = (env.HUBSPOT_CUSTOM_OBJECT_ID || '').trim();
    const port = Number(env.PORT || 3000);
    if (!token || /\s/.test(token)) throw new Error('Set HUBSPOT_ACCESS_TOKEN in your local .env file.');
    if (!/^[1-9]\d*$/.test(accountId)) throw new Error('Set HUBSPOT_TEST_ACCOUNT_ID to your developer test-account ID.');
    if (env.HUBSPOT_IS_TEST_ACCOUNT !== 'true') throw new Error('Confirm your developer test account, then set HUBSPOT_IS_TEST_ACCOUNT=true.');
    if ((requireObject || objectType) && !/^2-\d+$/.test(objectType)) {
        throw new Error('Set HUBSPOT_CUSTOM_OBJECT_ID to the Plants objectTypeId (2-...).');
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
    return { token, accountId, objectType, port };
}

function loadConfig(options) {
    dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });
    return parseConfig(process.env, options);
}

module.exports = { loadConfig, parseConfig };
