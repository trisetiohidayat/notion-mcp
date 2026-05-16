# MCP Client Installation

This guide configures MCP clients to use a published Notion DB MCP server. You do not need to clone this repository when you only want to connect to a remote MCP endpoint.

For AI-agent-oriented installation instructions, see [`ai-install-client.md`](ai-install-client.md).

## Required Values

Ask the server owner for:

- `MCP_SERVER_URL`: remote MCP URL, for example `https://mcp.example.com/mcp`
- `NOTION_DB_MCP_TOKEN`: bearer token that protects the MCP bridge
- `NOTION_API_TOKEN`: Notion token used by the client, if the server is configured in client-token/dual-header mode

Do not put real tokens in shared config files. Prefer environment variables when the client supports them.

## Getting a Notion Token

Use a Notion internal integration token when the client needs to send `NOTION_API_TOKEN`.

1. Open <https://www.notion.so/my-integrations>.
2. Create a new internal integration.
3. Copy the integration secret and use it as `NOTION_API_TOKEN`.
4. Open the target Notion database/page.
5. Share or connect that page/database with the integration.

The token only works for pages/databases that are shared with the integration. If the MCP tool returns a Notion permission or object-not-found error, check that the integration has access to the database.

## Codex: Remote HTTP Server

Use this when Codex connects directly to the remote MCP server.

Set tokens in the shell that starts Codex:

```bash
export NOTION_DB_MCP_TOKEN='<mcp-access-token>'
export NOTION_API_TOKEN='<notion-token>'
```

Add the MCP server:

```bash
codex mcp add notion_db \
  --url https://mcp.example.com/mcp \
  --bearer-token-env-var NOTION_DB_MCP_TOKEN
```

If the server expects the caller's Notion token in `X-Notion-Token`, add this to `~/.codex/config.toml`:

```toml
[mcp_servers.notion_db.env_http_headers]
X-Notion-Token = "NOTION_API_TOKEN"
```

Restart Codex, then verify:

```bash
codex mcp list
codex mcp get notion_db
```

## Claude Code: Remote HTTP Server

Use this when Claude Code connects directly to the remote MCP server.

If the server already holds Notion auth, pass only the MCP bridge bearer token:

```bash
claude mcp add --transport http \
  --header "Authorization: Bearer <mcp-access-token>" \
  notion_db https://mcp.example.com/mcp
```

If the client should send its own Notion token, pass both headers:

```bash
claude mcp add --transport http \
  --header "Authorization: Bearer <mcp-access-token>" \
  --header "X-Notion-Token: <notion-token>" \
  notion_db https://mcp.example.com/mcp
```

Verify in Claude Code:

```bash
claude mcp list
claude mcp get notion_db
```

Inside Claude Code, run:

```text
/mcp
```

Claude Code also supports JSON config with environment variable expansion. Use this form if you do not want literal token values in the `claude mcp add` command:

```json
{
  "type": "http",
  "url": "${MCP_SERVER_URL}",
  "headers": {
    "Authorization": "Bearer ${NOTION_DB_MCP_TOKEN}",
    "X-Notion-Token": "${NOTION_API_TOKEN}"
  }
}
```

Add it with:

```bash
claude mcp add-json notion_db '{"type":"http","url":"${MCP_SERVER_URL}","headers":{"Authorization":"Bearer ${NOTION_DB_MCP_TOKEN}","X-Notion-Token":"${NOTION_API_TOKEN}"}}'
```

## Optional: Codex Installer Script

If you already have a checkout of this repository, this helper writes the Codex remote HTTP config for you:

```bash
NOTION_MCP_SERVER_URL="https://mcp.example.com/mcp" \
  ./scripts/install-codex-client.sh
```

The script stores only environment variable names, not token values.

## Codex: Local stdio Server

Use this only when the server project is installed on the same machine as Codex:

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

## SSH Tunnel Alternative

If you do not want to expose the MCP server publicly:

```bash
ssh -L 3088:127.0.0.1:3088 user@server
```

Then configure the client URL:

```toml
[mcp_servers.notion_db]
url = "http://127.0.0.1:3088/mcp"
bearer_token_env_var = "NOTION_DB_MCP_TOKEN"
```

Add `env_http_headers` if the server uses dual-header mode.

## Expected Tools

After restart, the MCP client should see these tools:

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
