const { loadConfig } = require('../lib/config');
const { createClient, createPlantStore, verifyAccount, safeErrorMessage } = require('../lib/hubspot');
const { validateSchema } = require('./setup-hubspot');
const { fields, samples } = require('../lib/plants');

async function verifyHubspot(client, config) {
    await verifyAccount(client, config);
    validateSchema((await client.get(`/crm-object-schemas/v3/schemas/${config.objectType}`)).data);
    const records = await createPlantStore(client, config.objectType).list();
    if (records.length < 3) throw new Error('At least three plant records are required.');
    for (const sample of samples) {
        const record = records.find(item => item.properties?.name === sample.name);
        if (!record || fields.some(field => typeof record.properties[field.name] !== 'string' || !record.properties[field.name].trim())) {
            throw new Error('All three sample records must have every custom property filled.');
        }
        if (!/^[1-9]\d*$/.test(String(record.id))) throw new Error('Invalid CRM record ID.');
        const { data } = await client.get(`/crm/v3/objects/${config.objectType}/${record.id}`, {
            params: { associations: 'contacts', properties: fields.map(field => field.name).join(',') }
        });
        if (!data.associations?.contacts?.results?.length) throw new Error('A sample plant is missing its contact association.');
    }
    return { recordCount: records.length };
}

if (require.main === module) {
    (async () => {
        const config = loadConfig();
        const result = await verifyHubspot(createClient(config.token), config);
        console.log(`Live HubSpot verification passed: ${result.recordCount} plant records; three sample records have all properties and contact associations.`);
    })().catch(error => {
        console.error(error.isAxiosError ? safeErrorMessage(error) : error.message);
        process.exitCode = 1;
    });
}

module.exports = { verifyHubspot };
