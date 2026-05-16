# MCP Client Installation

This guide configures an MCP client to use the server.

For AI-agent-oriented installation instructions, see [`ai-install-client.md`](ai-install-client.md).

## Fastest Codex Remote Install

From a checkout of this repository:

```bash
NOTION_MCP_SERVER_URL="https://mcp.example.com/mcp" \
  ./scripts/install-codex-client.sh
```

Then start Codex from a shell with both tokens set:

```bash
export NOTION_DB_MCP_TOKEN='<mcp-access-token>'
export NOTION_API_TOKEN='<notion-token>'
codex
```

## Codex: Local stdio Server

Use this when the server project is installed on the same machine as Codex:

```bash
codex mcp add notion_db_precise -- /path/to/notion-db-mcp/bin/notion-db-mcp.js
```

Recommended config:

```toml
[mcp_servers.notion_db_precise]
command = "/path/to/notion-db-mcp/bin/notion-db-mcp.js"
cwd = "/path/to/notion-db-mcp"
```

Provide Notion auth locally:

```bash
export NOTION_API_TOKEN='<your-notion-token>'
codex
```

## Codex: Remote HTTP Server, Server Holds Notion Auth

Use this when the MCP server already has Notion auth configured.

```bash
export NOTION_DB_MCP_TOKEN='<mcp-access-token>'
codex mcp add notion_db_precise_remote \
  --url https://mcp.example.com/mcp \
  --bearer-token-env-var NOTION_DB_MCP_TOKEN
```

Config shape:

```toml
[mcp_servers.notion_db_precise_remote]
url = "https://mcp.example.com/mcp"
bearer_token_env_var = "NOTION_DB_MCP_TOKEN"
```

## Codex: Remote HTTP Server, Client Sends Notion Token

Use this when the client keeps the Notion token and the server is only a bridge.

Set local env vars:

```bash
export NOTION_DB_MCP_TOKEN='<mcp-access-token>'
export NOTION_API_TOKEN='<your-local-notion-token>'
```

Add the remote server:

```bash
codex mcp add notion_db_precise_remote \
  --url https://mcp.example.com/mcp \
  --bearer-token-env-var NOTION_DB_MCP_TOKEN
```

Then edit your Codex config to add the `X-Notion-Token` header from the local environment:

```toml
[mcp_servers.notion_db_precise_remote]
url = "https://mcp.example.com/mcp"
bearer_token_env_var = "NOTION_DB_MCP_TOKEN"

[mcp_servers.notion_db_precise_remote.env_http_headers]
X-Notion-Token = "NOTION_API_TOKEN"
```

Start Codex from a shell where both env vars are set:

```bash
codex
```

## SSH Tunnel Alternative

If you do not want to expose the MCP server publicly:

```bash
ssh -L 3088:127.0.0.1:3088 user@server
```

Then configure the client URL:

```toml
[mcp_servers.notion_db_precise_remote]
url = "http://127.0.0.1:3088/mcp"
bearer_token_env_var = "NOTION_DB_MCP_TOKEN"
```

Add `env_http_headers` if the server uses dual-header mode.

## Test the Client

Ask your MCP client to list tools. Expected tools:

- `notion_source_list`
- `notion_source_schema`
- `notion_source_get_by_key`
- `notion_source_update_by_key`
- `notion_source_update_status_by_key`
- `notion_db_schema`
- `notion_db_query`
- `notion_db_get_by_property`
- `notion_db_update_page`
- `notion_db_update_by_property`
