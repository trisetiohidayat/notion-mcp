#!/usr/bin/env node

try {
  const [command, ...args] = process.argv.slice(2);

  if (!command || ['help', '-h', '--help'].includes(command)) {
    printHelp();
    process.exit(0);
  }

  if (command === 'serve' || command === 'stdio') {
    await import('../src/mcp-server.js');
  } else if (command === 'http') {
    await import('../src/mcp-http-server.js');
  } else if (command === 'db') {
    const { main } = await import('../src/cli.js');
    await main(args);
  } else if (command === 'config') {
    const { configMain } = await import('../src/config-cli.js');
    await configMain(args);
  } else {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }
} catch (error) {
  console.error(error.message || error);
  process.exitCode = error.exitCode || 1;
}

function printHelp() {
  console.log(`Notion DB MCP helper

Commands:
  notion-mcp serve   Start stdio MCP server
  notion-mcp stdio   Alias for serve
  notion-mcp http    Start Streamable HTTP MCP server
  notion-mcp db ...  Run CLI database helper
  notion-mcp config  Manage local source mappings

Examples:
  notion-mcp serve
  notion-mcp db schema example_tasks
  notion-mcp config list
`);
}
