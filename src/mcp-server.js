#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerNotionDbTools } from './register-tools.js';

const server = new McpServer({ name: 'notion-db-precise', version: '0.1.0' });
registerNotionDbTools(server);

async function main() {
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
