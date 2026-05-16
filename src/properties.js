import { NotionError } from './notion.js';

const TEXT_TYPES = new Set(['title', 'rich_text', 'url', 'email', 'phone_number']);

export function schemaProperties(schema) {
  return schema.properties || {};
}

export function summarizeSchemaProperties(schema) {
  return Object.entries(schemaProperties(schema)).map(([name, property]) => summarizePropertySchema(name, property));
}

export function summarizePropertySchema(name, property) {
  const summary = { name, type: property.type };
  if (['select', 'status', 'multi_select'].includes(property.type)) {
    summary.options = (property[property.type]?.options || []).map((option) => ({
      name: option.name,
      color: option.color,
    }));
  }
  if (property.type === 'formula') summary.expression = property.formula?.expression;
  if (property.type === 'rollup') {
    summary.rollup = {
      function: property.rollup?.function,
      relation_property_name: property.rollup?.relation_property_name,
      rollup_property_name: property.rollup?.rollup_property_name,
    };
  }
  return summary;
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
      return richTextToPlainText(property.title) || '(untitled)';
    }
  }
  return '(untitled)';
}

export function summarizePage(page) {
  return { page_id: page.id, title: pageTitle(page), url: page.url };
}

export function richTextToPlainText(parts = []) {
  return parts.map((part) => part.plain_text || part.text?.content || '').join('');
}

export function simplifyPropertyValue(property) {
  if (!property || !property.type) return undefined;
  const type = property.type;
  const value = property[type];

  if (type === 'title' || type === 'rich_text') return richTextToPlainText(value);
  if (type === 'number') return value ?? null;
  if (type === 'checkbox') return Boolean(value);
  if (type === 'select' || type === 'status') return value?.name ?? null;
  if (type === 'multi_select') return (value || []).map((option) => option.name);
  if (type === 'date') return simplifyDate(value);
  if (type === 'url' || type === 'email' || type === 'phone_number') return value ?? null;
  if (type === 'unique_id') return simplifyUniqueId(value);
  if (type === 'people') return (value || []).map(simplifyUser);
  if (type === 'created_by' || type === 'last_edited_by') return simplifyUser(value);
  if (type === 'created_time' || type === 'last_edited_time') return value ?? null;
  if (type === 'relation') return (value || []).map((item) => item.id).filter(Boolean);
  if (type === 'files') return (value || []).map(simplifyFile);
  if (type === 'formula') return simplifyTypedValue(value);
  if (type === 'rollup') return simplifyRollup(value);
  if (type === 'button') return value?.name ?? null;

  return value ?? null;
}

export function simplifyPageProperties(page, propertyNames) {
  const properties = page.properties || {};
  const names = propertyNames?.length ? propertyNames : Object.keys(properties);
  const output = {};
  for (const name of names) {
    output[name] = simplifyPropertyValue(properties[name]);
  }
  return output;
}

export function tableRow(page, propertyNames) {
  return {
    ...summarizePage(page),
    properties: simplifyPageProperties(page, propertyNames),
  };
}

function simplifyDate(value) {
  if (!value) return null;
  if (!value.end && !value.time_zone) return value.start ?? null;
  return {
    start: value.start ?? null,
    end: value.end ?? null,
    time_zone: value.time_zone ?? null,
  };
}

function simplifyUniqueId(value) {
  if (!value) return null;
  if (value.prefix) return `${value.prefix}-${value.number}`;
  return value.number ?? null;
}

function simplifyUser(user) {
  if (!user) return null;
  return user.name || user.id || null;
}

function simplifyFile(file) {
  if (!file) return null;
  return {
    name: file.name || null,
    url: file.file?.url || file.external?.url || null,
  };
}

function simplifyTypedValue(value) {
  if (!value || !value.type) return null;
  const type = value.type;
  if (type === 'string') return value.string ?? null;
  if (type === 'number') return value.number ?? null;
  if (type === 'boolean') return value.boolean ?? null;
  if (type === 'date') return simplifyDate(value.date);
  if (type === 'array') return (value.array || []).map(simplifyTypedValue);
  return value[type] ?? null;
}

function simplifyRollup(value) {
  if (!value || !value.type) return null;
  if (value.type === 'array') return (value.array || []).map(simplifyPropertyValue);
  if (value.type === 'number') return value.number ?? null;
  if (value.type === 'date') return simplifyDate(value.date);
  if (value.type === 'incomplete') return { incomplete: true };
  if (value.type === 'unsupported') return { unsupported: true };
  return value[value.type] ?? null;
}
