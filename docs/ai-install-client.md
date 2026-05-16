# AI Agent Guide: Install MCP Client

Use this guide when a user asks an AI coding agent to install the Notion DB MCP client.

The user does **not** need to clone or run the MCP server locally when using a published remote MCP endpoint.

## Required Inputs

Ask or infer these values:

- `MCP_SERVER_URL`: remote MCP URL, for example `https://mcp.example.com/mcp`
- `NOTION_DB_MCP_TOKEN`: MCP bridge bearer token
- `NOTION_API_TOKEN`: Notion API token available on the client machine, when the server uses client-token/dual-header mode

Do not ask the user to paste secrets into repo files. Prefer shell environment variables or client-native secret handling.

## Codex: No-Clone Install

Set tokens in the shell that starts Codex:

```bash
export NOTION_DB_MCP_TOKEN='<mcp-access-token>'
export NOTION_API_TOKEN='<notion-token>'
```

Add the remote MCP server:

```bash
codex mcp add notion_db \
  --url https://mcp.example.com/mcp \
  --bearer-token-env-var NOTION_DB_MCP_TOKEN
```

If the server expects Notion auth from the client, add this to `~/.codex/config.toml`:

```toml
[mcp_servers.notion_db.env_http_headers]
X-Notion-Token = "NOTION_API_TOKEN"
```

Restart Codex.

## Claude Code: No-Clone Install

If the server already holds Notion auth:

```bash
claude mcp add --transport http \
  --header "Authorization: Bearer <mcp-access-token>" \
  notion_db https://mcp.example.com/mcp
```

If the client should send its own Notion token:

```bash
claude mcp add --transport http \
  --header "Authorization: Bearer <mcp-access-token>" \
  --header "X-Notion-Token: <notion-token>" \
  notion_db https://mcp.example.com/mcp
```

Prefer `claude mcp add-json` with environment variable expansion if literal tokens should not appear in shell history:

```bash
export MCP_SERVER_URL='https://mcp.example.com/mcp'
export NOTION_DB_MCP_TOKEN='<mcp-access-token>'
export NOTION_API_TOKEN='<notion-token>'

claude mcp add-json notion_db '{"type":"http","url":"${MCP_SERVER_URL}","headers":{"Authorization":"Bearer ${NOTION_DB_MCP_TOKEN}","X-Notion-Token":"${NOTION_API_TOKEN}"}}'
```

## Verify

Codex:

```bash
codex mcp list
codex mcp get notion_db
```

Claude Code:

```bash
claude mcp list
claude mcp get notion_db
```

Inside Claude Code, also check:

```text
/mcp
```

Expected MCP tools after client restart:

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

## Optional Codex Installer Script

If a checkout of this repository already exists, this script can write the Codex config automatically:

```bash
NOTION_MCP_SERVER_URL="https://mcp.example.com/mcp" \
  ./scripts/install-codex-client.sh
```

The script does not store token values.

## Troubleshooting

- If tools do not appear, restart the MCP client after setting env vars.
- If calls return `401 Unauthorized MCP bearer token`, check `NOTION_DB_MCP_TOKEN`.
- If calls return a Notion API auth error, check `NOTION_API_TOKEN` or `X-Notion-Token`.
- If a source alias is unknown, the server-side `config.json` needs that source configured.
