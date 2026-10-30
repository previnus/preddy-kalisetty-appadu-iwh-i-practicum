const fields = [
    { name: 'name', label: 'Name', max: 120 },
    { name: 'species', label: 'Species', max: 120 },
    { name: 'care_notes', label: 'Care Notes', max: 1000 }
];

function validatePlant(body = {}) {
    const values = {};
    const errors = [];
    const allowed = new Set([...fields.map(field => field.name), 'csrf_token']);
    if (Object.keys(body).some(key => !allowed.has(key))) errors.push('The form contains an unexpected field.');
    for (const field of fields) {
        const raw = body[field.name];
        const value = typeof raw === 'string' ? raw.trim() : '';
        values[field.name] = value.slice(0, field.max);
        if (!value || value.length > field.max) errors.push(`${field.label} must contain 1–${field.max} characters.`);
    }
    return { values, errors };
}

const schema = {
    name: 'practicum_plants',
    description: 'Synthetic plant records for the HubSpot Foundations practicum.',
    labels: { singular: 'Plant', plural: 'Plants' },
    primaryDisplayProperty: 'name',
    secondaryDisplayProperties: ['species', 'care_notes'],
    searchableProperties: ['name', 'species'],
    requiredProperties: ['name', 'species', 'care_notes'],
    associatedObjects: ['0-1'],
    properties: fields.map(field => ({
        name: field.name, label: field.label, type: 'string',
        fieldType: field.name === 'care_notes' ? 'textarea' : 'text',
        ...(field.name === 'name' ? { hasUniqueValue: true } : {})
    }))
};

const samples = [
    { name: 'Monstera', species: 'Monstera deliciosa', care_notes: 'Bright indirect light. Water when the top soil is dry.' },
    { name: 'Snake Plant', species: 'Dracaena trifasciata', care_notes: 'Allow soil to dry between waterings.' },
    { name: 'Peace Lily', species: 'Spathiphyllum wallisii', care_notes: 'Indirect light. Keep soil lightly moist.' }
];

module.exports = { fields, validatePlant, schema, samples };
