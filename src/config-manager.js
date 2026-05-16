import { defaultConfig, getConfigPath, listDataSources, loadConfig, saveConfig } from './config.js';
import { retrieveDatabase, retrieveDataSource, searchDataSources, NotionError } from './notion.js';
import { schemaProperties } from './properties.js';

export function getConfigInfo() {
  const config = loadConfig();
  return {
    config_path: getConfigPath(),
    sources: listDataSources(config),
  };
}

export function listConfigSources() {
  return getConfigInfo().sources;
}

export async function discoverConfigSources({ query } = {}) {
  const dataSources = await searchDataSources({ query });
  const candidates = [];
  for (const dataSource of dataSources) {
    const title = plainTitle(dataSource.title) || dataSource.name || dataSource.url || dataSource.id;
    candidates.push({
      data_source_id: dataSource.id,
      title,
      url: dataSource.url,
    });
  }
  return { count: candidates.length, candidates };
}

export async function addConfigSource({ alias, input, options = {} }) {
  validateAlias(alias);
  if (!input) throw new NotionError('Missing Notion URL or data_source_id.');

  const config = loadWritableConfig();
  if ((config.data_sources?.[alias] || config.aliases?.[alias]) && !options.yes && !options.overwrite) {
    throw new NotionError(`Source already exists: ${alias}. Re-run with --yes to overwrite.`);
  }

  const source = await buildSource(alias, input, options);
  config.aliases = config.aliases || {};
  config.data_sources = config.data_sources || {};
  delete config.aliases[alias];
  config.data_sources[alias] = source;
  const file = saveConfig(config);
  return { added: true, config_path: file, alias, source };
}

export function removeConfigSource(alias, { yes = false } = {}) {
  const config = loadWritableConfig();
  const existed = Boolean(config.data_sources?.[alias] || config.aliases?.[alias]);
  if (!existed) throw new NotionError(`Source not found: ${alias}`);
  if (!yes) throw new NotionError(`Refusing to remove ${alias} without confirmation.`);
  delete config.data_sources?.[alias];
  delete config.aliases?.[alias];
  const file = saveConfig(config);
  return { removed: true, config_path: file, alias };
}

export async function refreshConfigSource(alias) {
  const config = loadWritableConfig();
  const aliases = alias ? [alias] : Object.keys(config.data_sources || {});
  if (!aliases.length) throw new NotionError('No data_sources configured.');

  const refreshed = [];
  for (const name of aliases) {
    const existing = config.data_sources?.[name];
    if (!existing) throw new NotionError(`Source not found in data_sources: ${name}`);
    const source = await buildSource(name, existing.id || existing, existing);
    config.data_sources[name] = { ...existing, ...source };
    refreshed.push({ alias: name, source: config.data_sources[name] });
  }
  const file = saveConfig(config);
  return { refreshed: true, config_path: file, sources: refreshed };
}

async function buildSource(alias, input, options = {}) {
  const resolved = await resolveInputToDataSource(input);
  const schema = await retrieveDataSource(resolved.data_source_id);
  const guessed = guessMetadata(schema);
  return compactObject({
    id: schema.id,
    name: options.name || schema.name || resolved.name || alias,
    description: options.description,
    key_property: options.key || options.key_property || guessed.key_property,
    title_property: options.title || options.title_property || guessed.title_property,
    status_property: options.status || options.status_property || guessed.status_property,
  });
}

async function resolveInputToDataSource(input) {
  const rawId = extractNotionId(input);
  if (!rawId) throw new NotionError(`Could not find a Notion ID in: ${input}`);

  try {
    const schema = await retrieveDataSource(rawId);
    return { data_source_id: schema.id, name: schema.name };
  } catch (error) {
    if (!String(error.message || '').includes('404')) throw error;
  }

  const database = await retrieveDatabase(rawId);
  const dataSourceIds = extractDataSourceIds(database);
  if (dataSourceIds.length === 0) throw new NotionError(`No data sources found for database: ${rawId}`);
  if (dataSourceIds.length > 1) {
    throw new NotionError(`Database has multiple data sources. Re-run with a specific data_source_id:\n${dataSourceIds.join('\n')}`);
  }
  return { data_source_id: dataSourceIds[0], name: plainTitle(database.title) };
}

function extractDataSourceIds(database) {
  const dataSources = database.data_sources || database.dataSources || [];
  return dataSources.map((item) => item.id || item.data_source_id).filter(Boolean);
}

function extractNotionId(input) {
  const text = String(input);
  const pathPart = text.split(/[?#]/, 1)[0];
  const normalized = pathPart.replace(/-/g, '');
  const matches = normalized.match(/[0-9a-fA-F]{32}/g) || [];
  if (!matches.length) return undefined;
  const id = matches[0].toLowerCase();
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

function guessMetadata(schema) {
  const properties = schemaProperties(schema);
  const entries = Object.entries(properties);
  const title = entries.find(([, property]) => property.type === 'title')?.[0];
  const status = entries.find(([name, property]) => property.type === 'status' && /^status$/i.test(name))?.[0]
    || entries.find(([, property]) => property.type === 'status')?.[0]
    || entries.find(([name, property]) => property.type === 'select' && /^status$/i.test(name))?.[0];
  const key = ['No', 'ID', 'Id', 'Number', 'Code'].find((name) => properties[name])
    || entries.find(([, property]) => property.type === 'unique_id')?.[0]
    || entries.find(([, property]) => property.type === 'number')?.[0];
  return { key_property: key, title_property: title, status_property: status };
}

function loadWritableConfig() {
  const config = loadConfig();
  return {
    ...defaultConfig(),
    ...config,
    aliases: { ...(config.aliases || {}) },
    data_sources: { ...(config.data_sources || {}) },
  };
}

function validateAlias(alias) {
  if (!/^[a-zA-Z0-9_.-]+$/.test(alias)) throw new NotionError(`Invalid alias: ${alias}`);
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ''));
}

function plainTitle(parts = []) {
  return parts.map((part) => part.plain_text || part.text?.content || '').join('') || undefined;
}
