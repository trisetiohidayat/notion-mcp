import { loadConfig, resolveDataSourceId } from './config.js';
import { queryDataSource, retrieveDataSource, NotionError } from './notion.js';
import { buildExactFilter, getPropertySchema, schemaProperties, summarizePage } from './properties.js';
import { assertSingleMatch, notion_db_update_by_property } from './tools.js';

export async function main(argv) {
  const [command, ...args] = argv;
  if (!command || ['help', '-h', '--help'].includes(command)) return printHelp();

  if (command === 'schema') return schemaCommand(args);
  if (command === 'get' || command === 'task-get') return getCommand(args);
  if (command === 'update' || command === 'task-update-status') return updateCommand(args);
  if (command === 'update-props' || command === 'task-update-properties') return updatePropsCommand(args);
  if (command === 'query-json') return queryJsonCommand(args);

  throw new NotionError(`Unknown command: ${command}\nRun: db help`);
}

async function schemaCommand(args) {
  const [aliasOrId] = requireArgs(args, 1, 'Usage: db schema <alias_or_data_source_id>');
  const schema = await getSchema(aliasOrId);
  const rows = Object.entries(schemaProperties(schema)).map(([name, property]) => ({ name, type: property.type }));
  printJson(rows);
}

async function getCommand(args) {
  const [aliasOrId, propertyName, value] = requireArgs(args, 3, 'Usage: db get <alias_or_data_source_id> <property> <value>');
  const page = await getSingleByProperty(aliasOrId, propertyName, value);
  printJson({ ...summarizePage(page), properties: page.properties });
}

async function updateCommand(args) {
  const [aliasOrId, matchProperty, matchValue, statusProperty, statusValue] = requireArgs(
    args,
    5,
    'Usage: db update <alias_or_data_source_id> <match_property> <match_value> <status_property> <status_value>',
  );
  await updateByProperty(aliasOrId, matchProperty, matchValue, { [statusProperty]: statusValue });
}

async function updatePropsCommand(args) {
  const [aliasOrId, matchProperty, matchValue, ...pairs] = requireArgs(
    args,
    4,
    'Usage: db update-props <alias_or_data_source_id> <match_property> <match_value> Field=value ...',
  );
  const rawProperties = parsePairs(pairs);
  await updateByProperty(aliasOrId, matchProperty, matchValue, rawProperties);
}

async function queryJsonCommand(args) {
  const [aliasOrId, filterJson, sortsJson] = requireArgs(args, 2, 'Usage: db query-json <alias_or_data_source_id> <filter_json> [sorts_json]');
  const dataSourceId = resolveAlias(aliasOrId);
  const results = await queryDataSource(dataSourceId, {
    filter: JSON.parse(filterJson),
    sorts: sortsJson ? JSON.parse(sortsJson) : undefined,
  });
  printJson(results.map(summarizePage));
}

async function updateByProperty(aliasOrId, matchProperty, matchValue, rawProperties) {
  const updated = await notion_db_update_by_property(resolveAlias(aliasOrId), matchProperty, matchValue, rawProperties);
  printJson({ updated: true, ...summarizePage(updated) });
}

async function getSingleByProperty(aliasOrId, propertyName, value, schema) {
  const resolvedSchema = schema || await getSchema(aliasOrId);
  const dataSourceId = resolveAlias(aliasOrId);
  const propertySchema = getPropertySchema(resolvedSchema, propertyName);
  const filter = buildExactFilter(propertyName, value, propertySchema);
  const matches = await queryDataSource(dataSourceId, { filter });
  return assertSingleMatch(matches, propertyName, value);
}

async function getSchema(aliasOrId) {
  return retrieveDataSource(resolveAlias(aliasOrId));
}

function resolveAlias(aliasOrId) {
  return resolveDataSourceId(aliasOrId, loadConfig());
}

function parsePairs(pairs) {
  const output = {};
  for (const pair of pairs) {
    const index = pair.indexOf('=');
    if (index <= 0) throw new NotionError(`Invalid Field=value argument: ${pair}`);
    output[pair.slice(0, index)] = pair.slice(index + 1);
  }
  return output;
}

function requireArgs(args, count, usage) {
  if (args.length < count) throw new NotionError(usage);
  return args;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printHelp() {
  console.log(`Precise Notion data source helper\n\nCommands:\n  db schema <alias_or_data_source_id>\n  db get <alias_or_data_source_id> <property> <value>\n  db update <alias_or_data_source_id> <match_property> <match_value> <status_property> <status_value>\n  db update-props <alias_or_data_source_id> <match_property> <match_value> Field=value ...\n  db query-json <alias_or_data_source_id> <filter_json> [sorts_json]\n\nEnvironment:\n  NOTION_TOKEN                 Optional direct bearer token\n  NOTION_API_TOKEN             Official Notion CLI/PAT token env var\n  NOTION_ACCESS_TOKEN          Optional OAuth access token\n  NOTION_DB_CONFIG             Optional config file path\n  NOTION_VERSION               Optional Notion API version override\n`);
}
