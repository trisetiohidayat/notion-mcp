# AI Agent Guide: Install MCP Client

Use this guide when a user asks an AI coding agent to install the Notion DB MCP client for Codex.

The user does **not** need to clone or run the MCP server locally when using a published remote MCP endpoint.

## Required Inputs

Ask or infer these values:

- `NOTION_MCP_SERVER_URL`: remote MCP URL, for example `https://mcp.example.com/mcp`
- `NOTION_DB_MCP_TOKEN`: MCP bridge bearer token
- `NOTION_API_TOKEN`: Notion API token available on the client machine

Do not ask the user to paste secrets into files unless they explicitly want persistence. Prefer shell environment variables.

## One-Command Installer

From a checkout of this repository:

```bash
NOTION_MCP_SERVER_URL="https://mcp.example.com/mcp" \
  ./scripts/install-codex-client.sh
```

The script configures Codex with:

```toml
[mcp_servers.notion_db]
url = "https://mcp.example.com/mcp"
bearer_token_env_var = "NOTION_DB_MCP_TOKEN"

[mcp_servers.notion_db.env_http_headers]
X-Notion-Token = "NOTION_API_TOKEN"
```

It does not store token values.

## Runtime Environment

Before starting Codex, the user must set:

```bash
export NOTION_DB_MCP_TOKEN='<mcp-access-token>'
export NOTION_API_TOKEN='<notion-token>'
codex
```

## Custom Names

Use these env vars to customize config names:

```bash
NOTION_MCP_SERVER_NAME="notion_db" \
NOTION_MCP_SERVER_URL="https://mcp.example.com/mcp" \
NOTION_MCP_TOKEN_ENV="NOTION_DB_MCP_TOKEN" \
NOTION_MCP_NOTION_TOKEN_ENV="NOTION_API_TOKEN" \
  ./scripts/install-codex-client.sh
```

## Verify

Run:

```bash
codex mcp list
codex mcp get notion_db
```

Expected MCP tools after Codex restart:

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

## Troubleshooting

- If tools do not appear, restart Codex after setting env vars.
- If calls return `401 Unauthorized MCP bearer token`, check `NOTION_DB_MCP_TOKEN`.
- If calls return a Notion API auth error, check `NOTION_API_TOKEN`.
- If a source alias is unknown, the server-side `config.json` needs that source configured.
