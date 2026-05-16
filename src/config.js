import fs from 'node:fs';
import path from 'node:path';

export function defaultConfig() {
  return { aliases: {}, data_sources: {} };
}

export function getConfigPath({ forWrite = false } = {}) {
  if (process.env.NOTION_DB_CONFIG) return process.env.NOTION_DB_CONFIG;

  const cwdConfig = path.join(process.cwd(), 'config.json');
  if (!forWrite && fs.existsSync(cwdConfig)) return cwdConfig;

  return path.join(process.env.HOME || process.cwd(), '.config', 'notion-db-mcp', 'config.json');
}

export function loadConfig() {
  const candidates = [
    process.env.NOTION_DB_CONFIG,
    path.join(process.cwd(), 'config.json'),
    path.join(process.env.HOME || '', '.config', 'notion-db-mcp', 'config.json'),
  ].filter(Boolean);

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  }
  return defaultConfig();
}

export function saveConfig(config, file = getConfigPath({ forWrite: true })) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const normalized = {
    aliases: config.aliases || {},
    data_sources: config.data_sources || {},
  };
  fs.writeFileSync(file, `${JSON.stringify(normalized, null, 2)}\n`);
  return file;
}

export function resolveDataSourceId(aliasOrId, config = loadConfig()) {
  return getDataSourceConfig(aliasOrId, config)?.id || config.aliases?.[aliasOrId] || aliasOrId;
}

export function getDataSourceConfig(aliasOrId, config = loadConfig()) {
  const source = config.data_sources?.[aliasOrId];
  if (!source) return undefined;
  if (typeof source === 'string') return { id: source };
  return source;
}

export function listDataSources(config = loadConfig()) {
  const sources = {};
  for (const [alias, value] of Object.entries(config.aliases || {})) {
    sources[alias] = { id: value, alias, source: 'aliases' };
  }
  for (const [alias, value] of Object.entries(config.data_sources || {})) {
    const source = typeof value === 'string' ? { id: value } : value;
    sources[alias] = { ...source, alias, source: 'data_sources' };
  }
  return Object.values(sources);
}

export function getDataSourceKeyProperty(aliasOrId, config = loadConfig()) {
  return getDataSourceConfig(aliasOrId, config)?.key_property;
}

export function getDataSourceStatusProperty(aliasOrId, config = loadConfig()) {
  return getDataSourceConfig(aliasOrId, config)?.status_property;
}
