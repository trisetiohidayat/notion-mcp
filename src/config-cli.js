import { defaultConfig, getConfigPath, listDataSources, loadConfig, saveConfig } from './config.js';
import { retrieveDatabase, retrieveDataSource, searchDataSources, NotionError } from './notion.js';
import { schemaProperties } from './properties.js';

export async function configMain(argv) {
  const [command, ...args] = argv;
  if (!command || ['help', '-h', '--help'].includes(command)) return printHelp();

  if (command === 'path') return pathCommand();
  if (command === 'list') return listCommand(args);
  if (command === 'add') return addCommand(args);
  if (command === 'remove' || command === 'rm') return removeCommand(args);
  if (command === 'refresh') return refreshCommand(args);
  if (command === 'discover') return discoverCommand(args);

  throw new NotionError(`Unknown config command: ${command}\nRun: notion-mcp config help`);
}

function pathCommand() {
  printJson({ path: getConfigPath({ forWrite: true }) });
}

function listCommand(args) {
  const { json } = parseOptions(args);
  const config = loadConfig();
  const sources = listDataSources(config);
  if (json) return printJson({ config_path: getConfigPath(), sources });
  console.log(`Config: ${getConfigPath()}`);
  if (!sources.length) {
    console.log('No sources configured.');
    return;
  }
  for (const source of sources) {
    console.log(`${source.alias}\t${source.id}\t${source.name || ''}\tkey=${source.key_property || ''}\tstatus=${source.status_property || ''}`);
  }
}

async function addCommand(args) {
  const { values, options } = parseOptions(args);
  const [alias, input] = requireArgs(values, 2, 'Usage: notion-mcp config add <alias> <notion-url-or-id> [--key No] [--title Task] [--status Status] [--name Name] [--yes]');
  validateAlias(alias);
  const config = loadWritableConfig();
  if ((config.data_sources?.[alias] || config.aliases?.[alias]) && !options.yes) {
    throw new NotionError(`Source already exists: ${alias}. Re-run with --yes to overwrite.`);
  }
  const source = await buildSource(alias, input, options);
  config.aliases = config.aliases || {};
  config.data_sources = config.data_sources || {};
  delete config.aliases[alias];
  config.data_sources[alias] = source;
  const file = saveConfig(config);
  printJson({ added: true, config_path: file, alias, source });
}

function removeCommand(args) {
  const { values, options } = parseOptions(args);
  const [alias] = requireArgs(values, 1, 'Usage: notion-mcp config remove <alias> [--yes]');
  const config = loadWritableConfig();
  const existed = Boolean(config.data_sources?.[alias] || config.aliases?.[alias]);
  if (!existed) throw new NotionError(`Source not found: ${alias}`);
  if (!options.yes) throw new NotionError(`Refusing to remove ${alias} without --yes.`);
  delete config.data_sources?.[alias];
  delete config.aliases?.[alias];
  const file = saveConfig(config);
  printJson({ removed: true, config_path: file, alias });
}

async function refreshCommand(args) {
  const { values } = parseOptions(args);
  const [alias] = values;
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
  printJson({ refreshed: true, config_path: file, sources: refreshed });
}

async function discoverCommand(args) {
  const { values, options } = parseOptions(args);
  const query = values.join(' ') || options.query;
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
  printJson({ count: candidates.length, candidates });
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

function parseOptions(args) {
  const values = [];
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      values.push(arg);
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);
    const key = rawKey.replace(/-/g, '_');
    if (inlineValue !== undefined) {
      options[key] = inlineValue;
    } else if (['yes', 'json'].includes(key)) {
      options[key] = true;
    } else {
      options[key] = args[index + 1];
      index += 1;
    }
  }
  return { values, options, json: Boolean(options.json) };
}

function requireArgs(args, count, usage) {
  if (args.length < count) throw new NotionError(usage);
  return args;
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

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printHelp() {
  console.log(`Notion MCP local config helper\n\nCommands:\n  notion-mcp config path\n  notion-mcp config list [--json]\n  notion-mcp config discover [query]\n  notion-mcp config add <alias> <notion-url-or-id> [--key No] [--title Task] [--status Status] [--name Name] [--yes]\n  notion-mcp config refresh [alias]\n  notion-mcp config remove <alias> --yes\n`);
}
