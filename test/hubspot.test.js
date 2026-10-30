const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient, listPlants, verifyAccount } = require('../lib/hubspot');
const { parseConfig } = require('../lib/config');
const { schema, samples } = require('../lib/plants');
const { setupHubspot } = require('../scripts/setup-hubspot');
const { verifyHubspot } = require('../scripts/verify-hubspot');

const config = { token: 'synthetic-test-value', accountId: '12345', objectType: '' };

test('HubSpot list requests every custom property and follows only cursors', async () => {
    const calls = [];
    const client = { get: async (url, options) => {
        calls.push({ url, options });
        return calls.length === 1 ? { data: { results: [{ id: '1' }], paging: { next: { after: '2', link: 'http://untrusted.example' } } } } : { data: { results: [{ id: '2' }] } };
    } };
    assert.equal((await listPlants(client, '2-99')).length, 2);
    assert.ok(calls.every(call => call.url === '/crm/v3/objects/2-99'));
    assert.equal(calls[0].options.params.properties, 'name,species,care_notes');
    assert.equal(calls[1].options.params.after, '2');
});

test('repeated paging cursors and malformed lists fail safely', async () => {
    await assert.rejects(listPlants({ get: async () => ({ data: { results: [], paging: { next: { after: '2' } } } }) }, '2-99'), /paging cursor/);
    await assert.rejects(listPlants({ get: async () => ({ data: { results: 'invalid' } }) }, '2-99'), /Invalid CRM list/);
    await assert.rejects(listPlants({}, '../contacts'), /Invalid custom object ID/);
});

test('client fixes API host, timeout and redirect policy', () => {
    const client = createClient(config.token);
    assert.equal(client.defaults.baseURL, 'https://api.hubapi.com');
    assert.equal(client.defaults.timeout, 10000);
    assert.equal(client.defaults.maxRedirects, 0);
});

test('missing token, missing test confirmation, bad object IDs and invalid port fail closed', () => {
    const env = { HUBSPOT_ACCESS_TOKEN: config.token, HUBSPOT_TEST_ACCOUNT_ID: '12345', HUBSPOT_IS_TEST_ACCOUNT: 'true', HUBSPOT_CUSTOM_OBJECT_ID: '2-99' };
    assert.equal(parseConfig(env).port, 3000);
    assert.throws(() => parseConfig({ ...env, HUBSPOT_ACCESS_TOKEN: '' }), /HUBSPOT_ACCESS_TOKEN/);
    assert.throws(() => parseConfig({ ...env, HUBSPOT_IS_TEST_ACCOUNT: 'false' }), /Confirm/);
    assert.throws(() => parseConfig({ ...env, HUBSPOT_CUSTOM_OBJECT_ID: '../contacts' }), /objectTypeId/);
    assert.throws(() => parseConfig({ ...env, PORT: '1.2' }), /PORT/);
});

test('wrong-account token prevents all CRM writes', async () => {
    const calls = [];
    const client = { post: async (url) => { calls.push(url); return { data: { hubId: '99999' } }; } };
    await assert.rejects(setupHubspot(client, config), /different account/);
    assert.deepEqual(calls, ['/oauth/v2/private-apps/get/access-token-info']);
    await assert.rejects(verifyAccount(client, config), /different account/);
});

test('setup creates schema, three records, synthetic contact and associations; rerun reuses them', async () => {
    let createdSchema;
    const records = [];
    let contact;
    let associations = 0;
    let creates = 0;
    const client = {
        get: async url => {
            if (url === '/crm-object-schemas/v3/schemas') return { data: { results: createdSchema ? [createdSchema] : [] } };
            if (url === '/crm/v3/objects/2-99') return { data: { results: records } };
            if (url.startsWith('/crm/v3/objects/contacts/')) {
                if (contact) return { data: contact };
                throw Object.assign(new Error('not found'), { response: { status: 404 } });
            }
            throw new Error(`Unexpected read in test: ${url}`);
        },
        post: async (url, body) => {
            if (url.includes('access-token-info')) return { data: { hubId: 12345 } };
            creates++;
            if (url === '/crm-object-schemas/v3/schemas') {
                createdSchema = { ...body, objectTypeId: '2-99' }; return { data: createdSchema };
            }
            if (url === '/crm/v3/objects/2-99') {
                const record = { id: String(records.length + 1), properties: body.properties };
                records.push(record); return { data: record };
            }
            if (url === '/crm/v3/objects/contacts') { contact = { id: '9' }; return { data: contact }; }
            throw new Error(`Unexpected write in test: ${url}`);
        },
        put: async url => { assert.match(url, /^\/crm\/v4\/objects\/2-99\/\d+\/associations\/default\/contacts\/9$/); associations++; }
    };
    const first = await setupHubspot(client, config);
    assert.equal(first.listViewUrl, 'https://app.hubspot.com/contacts/12345/objects/2-99/views/all/list');
    assert.equal(creates, 5); assert.equal(associations, 3);
    const second = await setupHubspot(client, config);
    assert.deepEqual(second, first);
    assert.equal(creates, 5); assert.equal(associations, 6);
    assert.equal(records.length, 3);
    assert.equal(createdSchema.properties.find(field => field.name === 'name').type, 'string');
});

test('live verification requires actual contact associations as well as three filled records', async () => {
    let linked = false;
    const client = {
        post: async () => ({ data: { hubId: 12345 } }),
        get: async url => {
            if (url.startsWith('/crm-object-schemas/')) return { data: { ...schema, objectTypeId: '2-99' } };
            if (url === '/crm/v3/objects/2-99') return { data: { results: samples.map((properties, index) => ({ id: String(index + 1), properties })) } };
            return { data: { associations: { contacts: { results: linked ? [{ id: '9' }] : [] } } } };
        }
    };
    await assert.rejects(verifyHubspot(client, { ...config, objectType: '2-99' }), /missing its contact/);
    linked = true;
    assert.equal((await verifyHubspot(client, { ...config, objectType: '2-99' })).recordCount, 3);
});
