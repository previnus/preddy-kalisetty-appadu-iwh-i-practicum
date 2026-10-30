const axios = require('axios');
const { fields } = require('./plants');

function createClient(token) {
    return axios.create({
        baseURL: 'https://api.hubapi.com',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 10000, maxRedirects: 0,
        maxContentLength: 2 * 1024 * 1024, maxBodyLength: 64 * 1024
    });
}

function objectPath(objectType) {
    if (!/^2-\d+$/.test(objectType)) throw new Error('Invalid custom object ID.');
    return `/crm/v3/objects/${encodeURIComponent(objectType)}`;
}

async function listPlants(client, objectType) {
    const records = [];
    const cursors = new Set();
    let after;
    for (let page = 0; page < 100; page++) {
        const response = await client.get(objectPath(objectType), {
            params: { properties: fields.map(field => field.name).join(','), limit: 100, archived: false, ...(after ? { after } : {}) }
        });
        if (!Array.isArray(response.data.results)) throw new Error('Invalid CRM list response.');
        records.push(...response.data.results);
        const cursor = response.data.paging?.next?.after;
        if (cursor === undefined || cursor === null) return records;
        if (!['string', 'number'].includes(typeof cursor)) throw new Error('Invalid CRM paging cursor.');
        after = String(cursor);
        if (!after || after.length > 200 || cursors.has(after)) throw new Error('Invalid CRM paging cursor.');
        cursors.add(after);
    }
    throw new Error('CRM paging limit exceeded.');
}

function createPlantStore(client, objectType) {
    objectPath(objectType);
    return {
        list: () => listPlants(client, objectType),
        create: async properties => {
            const { data } = await client.post(objectPath(objectType), { properties });
            return data;
        }
    };
}

async function verifyAccount(client, config) {
    const { data } = await client.post('/oauth/v2/private-apps/get/access-token-info', { tokenKey: config.token });
    if (String(data.hubId) !== config.accountId) {
        throw new Error('The access token belongs to a different account. No setup writes were made.');
    }
}

function safeErrorMessage(error) {
    const status = error.response?.status;
    if (status === 401) return 'HubSpot rejected the access token. Check the local .env configuration.';
    if (status === 403) return 'HubSpot denied access. Check private-app scopes and test-account permissions.';
    if (status === 404) return 'HubSpot could not find that object. Check HUBSPOT_CUSTOM_OBJECT_ID.';
    if (status === 409) return 'That Name already exists. Use a different plant name.';
    if (status === 429) return 'HubSpot is limiting requests. Wait a moment, then check your plants.';
    if (status === 400) return 'HubSpot rejected the record. Check the property definitions and use a unique Name.';
    return 'HubSpot could not complete the request. Check your connection and local configuration.';
}

module.exports = { createClient, objectPath, listPlants, createPlantStore, verifyAccount, safeErrorMessage };
