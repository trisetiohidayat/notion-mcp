import { NotionError } from './notion.js';

const TEXT_TYPES = new Set(['title', 'rich_text', 'url', 'email', 'phone_number']);

export function schemaProperties(schema) {
  return schema.properties || {};
}

export function getPropertySchema(schema, propertyName) {
  const property = schemaProperties(schema)[propertyName];
  if (!property) {
    throw new NotionError(`Property not found in schema: ${propertyName}`);
  }
  return property;
}

export function buildExactFilter(propertyName, rawValue, propertySchema) {
  const type = propertySchema.type;
  if (TEXT_TYPES.has(type)) return { property: propertyName, [type]: { equals: String(rawValue) } };
  if (type === 'number') return { property: propertyName, number: { equals: Number(rawValue) } };
  if (type === 'checkbox') return { property: propertyName, checkbox: { equals: parseBoolean(rawValue) } };
  if (type === 'select') return { property: propertyName, select: { equals: String(rawValue) } };
  if (type === 'status') return { property: propertyName, status: { equals: String(rawValue) } };
  if (type === 'multi_select') return { property: propertyName, multi_select: { contains: String(rawValue) } };
  if (type === 'date') return { property: propertyName, date: { equals: String(rawValue) } };
  if (type === 'unique_id') return { property: propertyName, unique_id: { equals: Number(rawValue) } };
  throw new NotionError(`Exact filter is not implemented for property type: ${type}`);
}

export function buildPropertyValue(propertyName, rawValue, propertySchema) {
  validateOption(propertyName, rawValue, propertySchema);
  const type = propertySchema.type;
  const value = String(rawValue);
  if (type === 'title') return { title: [{ text: { content: value } }] };
  if (type === 'rich_text') return { rich_text: [{ text: { content: value } }] };
  if (type === 'number') return { number: Number(rawValue) };
  if (type === 'checkbox') return { checkbox: parseBoolean(rawValue) };
  if (type === 'select') return { select: { name: value } };
  if (type === 'status') return { status: { name: value } };
  if (type === 'multi_select') return { multi_select: value.split(',').map((name) => ({ name: name.trim() })).filter((item) => item.name) };
  if (type === 'date') return { date: { start: value } };
  if (type === 'url') return { url: value };
  if (type === 'email') return { email: value };
  if (type === 'phone_number') return { phone_number: value };
  throw new NotionError(`Update is not implemented for property type: ${type}`);
}

export function buildProperties(rawProperties, schema) {
  const output = {};
  for (const [name, value] of Object.entries(rawProperties)) {
    output[name] = buildPropertyValue(name, value, getPropertySchema(schema, name));
  }
  return output;
}

export function validateOption(propertyName, rawValue, propertySchema) {
  const type = propertySchema.type;
  if (type !== 'select' && type !== 'status') return;
  const options = propertySchema[type]?.options || [];
  if (!options.length) return;
  const names = options.map((option) => option.name);
  if (!names.includes(String(rawValue))) {
    throw new NotionError(`Invalid ${type} option for ${propertyName}: ${rawValue}. Available: ${names.join(', ')}`);
  }
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  if (['true', 'yes', '1', 'done'].includes(normalized)) return true;
  if (['false', 'no', '0', 'todo', 'undone'].includes(normalized)) return false;
  throw new NotionError(`Expected boolean value, got: ${value}`);
}

export function pageTitle(page) {
  for (const property of Object.values(page.properties || {})) {
    if (property.type === 'title') {
      return (property.title || []).map((part) => part.plain_text || '').join('') || '(untitled)';
    }
  }
  return '(untitled)';
}

export function summarizePage(page) {
  return { page_id: page.id, title: pageTitle(page), url: page.url };
}
