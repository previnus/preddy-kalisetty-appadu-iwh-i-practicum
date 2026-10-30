const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('../lib/config');
const { createClient, createPlantStore, verifyAccount, safeErrorMessage } = require('../lib/hubspot');
const { schema, fields, samples } = require('../lib/plants');

function validateSchema(existing) {
    if (!/^2-\d+$/.test(existing.objectTypeId || '')) throw new Error('HubSpot did not return a valid custom object ID.');
    if (existing.primaryDisplayProperty !== 'name' || fields.some(field =>
        !existing.properties?.some(property => property.name === field.name && property.type === 'string' &&
            (field.name !== 'name' || property.label === 'Name')))) {
        throw new Error('The existing Plants schema differs from this app. Review its three text properties before continuing.');
    }
    const contactsEnabled = existing.associatedObjects?.includes('0-1') ||
        existing.associations?.some(association => String(association.toObjectTypeId) === '0-1');
    if (!contactsEnabled) throw new Error('Enable the Plants-to-Contacts association in the custom object schema first.');
}

function recordId(value) {
    const id = String(value || '');
    if (!/^[1-9]\d*$/.test(id)) throw new Error('HubSpot did not return a valid record ID.');
    return id;
}

async function setupHubspot(client, config) {
    // This read-only token check must finish before any CRM mutation.
    await verifyAccount(client, config);
    let existing;
    if (config.objectType) {
        existing = (await client.get(`/crm-object-schemas/v3/schemas/${config.objectType}`)).data;
    } else {
        const { data } = await client.get('/crm-object-schemas/v3/schemas');
        if (!Array.isArray(data.results)) throw new Error('HubSpot returned an invalid schema list.');
        existing = data.results.find(item => item.name === schema.name);
        if (!existing) existing = (await client.post('/crm-object-schemas/v3/schemas', schema)).data;
    }
    validateSchema(existing);
    const objectType = existing.objectTypeId;
    const store = createPlantStore(client, objectType);
    const records = await store.list();
    const plantIds = [];
    for (const properties of samples) {
        const matches = records.filter(record => record.properties?.name === properties.name);
        if (matches.length > 1) throw new Error('Duplicate sample Names found. Resolve them in the test account before setup.');
        const record = matches[0] || await store.create(properties);
        plantIds.push(recordId(record.id));
    }

    // Reserved example.com address: this is synthetic test data, never emailed.
    const email = 'practicum.gardener@example.com';
    let contact;
    try {
        contact = (await client.get(`/crm/v3/objects/contacts/${encodeURIComponent(email)}`, {
            params: { idProperty: 'email' }
        })).data;
    } catch (error) {
        if (error.response?.status !== 404) throw error;
        contact = (await client.post('/crm/v3/objects/contacts', {
            properties: { email, firstname: 'Practicum', lastname: 'Gardener' }
        })).data;
    }
    const contactId = recordId(contact.id);
    for (const id of plantIds) {
        await client.put(`/crm/v4/objects/${objectType}/${id}/associations/default/contacts/${contactId}`, {});
    }
    return { objectType, plantIds, contactId,
        listViewUrl: `https://app.hubspot.com/contacts/${config.accountId}/objects/${objectType}/views/all/list` };
}

function saveSetupResult(result) {
    // Fixed local paths; credentials are never copied to the README.
    const root = path.join(__dirname, '..');
    const envPath = path.join(root, '.env');
    if (fs.existsSync(envPath)) {
        const text = fs.readFileSync(envPath, 'utf8');
        const entry = `HUBSPOT_CUSTOM_OBJECT_ID=${result.objectType}`;
        fs.writeFileSync(envPath, /^HUBSPOT_CUSTOM_OBJECT_ID=.*$/m.test(text) ?
            text.replace(/^HUBSPOT_CUSTOM_OBJECT_ID=.*$/m, entry) : `${text}\n${entry}\n`);
    }
    const readmePath = path.join(root, 'README.md');
    const readme = fs.readFileSync(readmePath, 'utf8');
    const marker = /<!-- test-account-list-view:start -->[\s\S]*?<!-- test-account-list-view:end -->/;
    if (!marker.test(readme)) throw new Error('README list-view marker is missing. Add the printed list-view URL manually.');
    fs.writeFileSync(readmePath, readme.replace(marker,
        `<!-- test-account-list-view:start -->\n[Plants in the developer test account](${result.listViewUrl})\n<!-- test-account-list-view:end -->`));
}

if (require.main === module) {
    (async () => {
        const config = loadConfig({ requireObject: false });
        const result = await setupHubspot(createClient(config.token), config);
        saveSetupResult(result);
        console.log(`Created or reused Plants (${result.objectType}), three sample records and their test-contact associations.`);
        console.log(`README list view: ${result.listViewUrl}`);
        console.log('Local .env object ID updated if that file exists. Run npm run verify:hubspot next.');
    })().catch(error => {
        console.error(error.isAxiosError ? safeErrorMessage(error) : error.message);
        console.error('Setup is restartable; inspect the test account before retrying after a timeout.');
        process.exitCode = 1;
    });
}

module.exports = { setupHubspot, validateSchema };
