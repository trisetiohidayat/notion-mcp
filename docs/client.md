# MCP Client Installation

This guide configures MCP clients for Notion DB MCP. The recommended setup is local stdio via `npx`, where the MCP client starts the MCP server on the same machine.

For AI-agent-oriented installation instructions, see [`ai-install-client.md`](ai-install-client.md).

## Recommended: Local All-In-One via `npx`

Use this when Codex or Claude Code runs on the same machine that should access Notion. This does not require a VPS, HTTPS endpoint, or MCP bridge token.

Codex:

```bash
codex mcp add notion_db -- \
  npx --yes --package github:trisetiohidayat/notion-mcp \
  notion-mcp serve
```

Claude Code:

```bash
claude mcp add notion_db -- \
  npx --yes --package github:trisetiohidayat/notion-mcp \
  notion-mcp serve
```

The MCP client will run this command as a local stdio MCP server when it starts.

## Local Notion Auth

For local all-in-one setup, authenticate Notion on the same machine and OS user that runs Codex or Claude Code.

Preferred local options:

1. Use official Notion CLI auth if available:

   ```bash
   ntn login
   ```

2. Or set an explicit Notion token:

   ```bash
   export NOTION_API_TOKEN='<notion-token>'
   ```

The server checks auth in this order:

1. `NOTION_TOKEN`
2. `NOTION_API_TOKEN`
3. `NOTION_API_KEY`
4. `NOTION_ACCESS_TOKEN`
5. `ntn` file-based auth

If `ntn login` succeeds but the MCP tool returns `Missing Notion token`, set `NOTION_API_TOKEN` as a fallback.

## Getting a Notion Token

Use a Notion internal integration token when you choose explicit token auth.

1. Open <https://www.notion.so/my-integrations>.
2. Create a new internal connection/integration.
3. Copy the integration secret and use it as `NOTION_API_TOKEN`.
4. Open the connection settings and grant content access from the `Content access` tab. New connections may have no content access by default.
5. Or open the target Notion database/page and use `Add connections`/`Connections` to connect that page/database to the integration.

The token only works for pages/databases that are shared with the integration. If the MCP tool returns a Notion permission or object-not-found error, check that the integration has access to the database.

## About `ntn` Login

The official Notion CLI (`ntn`) authenticates local tooling. It does not generate/export a reusable token for remote MCP clients.

Use this rule of thumb:

- Local MCP server on the same machine as `ntn login`: `ntn` auth can be useful.
- Remote MCP server over HTTPS: use `NOTION_API_TOKEN` from an internal integration, or make the remote server hold its own Notion auth.

## Alternative: Remote HTTP Server for Codex

Use this when Codex connects to an already-running MCP server over HTTPS.

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

If the remote server expects the caller's Notion token in `X-Notion-Token`, add this to `~/.codex/config.toml`:

```toml
[mcp_servers.notion_db.env_http_headers]
X-Notion-Token = "NOTION_API_TOKEN"
```

Restart Codex, then verify:

```bash
codex mcp list
codex mcp get notion_db
```

## Alternative: Remote HTTP Server for Claude Code

Use this when Claude Code connects to an already-running MCP server over HTTPS.

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

## Optional: Pin a GitHub Commit

Pin the GitHub package when you want reproducible local `npx` installs:

```bash
codex mcp add notion_db -- \
  npx --yes --package github:trisetiohidayat/notion-mcp#<commit-sha> \
  notion-mcp serve
```

## Optional: Codex Installer Script

If you already have a checkout of this repository, this helper writes the Codex remote HTTP config for you:

```bash
NOTION_MCP_SERVER_URL="https://mcp.example.com/mcp" \
  ./scripts/install-codex-client.sh
```

The script stores only environment variable names, not token values.

## Development: Local stdio Server from Checkout

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
