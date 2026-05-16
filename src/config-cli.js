import { getConfigPath } from './config.js';
import { NotionError } from './notion.js';
import {
  addConfigSource,
  discoverConfigSources,
  getConfigInfo,
  refreshConfigSource,
  removeConfigSource,
} from './config-manager.js';

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
  const { config_path: configPath, sources } = getConfigInfo();
  if (json) return printJson({ config_path: configPath, sources });
  console.log(`Config: ${configPath}`);
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
  printJson(await addConfigSource({ alias, input, options }));
}

function removeCommand(args) {
  const { values, options } = parseOptions(args);
  const [alias] = requireArgs(values, 1, 'Usage: notion-mcp config remove <alias> [--yes]');
  printJson(removeConfigSource(alias, { yes: options.yes }));
}

async function refreshCommand(args) {
  const { values } = parseOptions(args);
  const [alias] = values;
  printJson(await refreshConfigSource(alias));
}

async function discoverCommand(args) {
  const { values, options } = parseOptions(args);
  const query = values.join(' ') || options.query;
  printJson(await discoverConfigSources({ query }));
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

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printHelp() {
  console.log(`Notion MCP local config helper\n\nCommands:\n  notion-mcp config path\n  notion-mcp config list [--json]\n  notion-mcp config discover [query]\n  notion-mcp config add <alias> <notion-url-or-id> [--key No] [--title Task] [--status Status] [--name Name] [--yes]\n  notion-mcp config refresh [alias]\n  notion-mcp config remove <alias> --yes\n`);
}
