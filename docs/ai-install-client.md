# AI Agent Guide: Install MCP Client

Use this guide when a user asks an AI coding agent to install the Notion DB MCP client.

Default to local stdio via `npx` unless the user explicitly asks for a remote HTTPS MCP server.

## Recommended: Codex Local All-In-One

Use this when Codex and Notion auth are on the same machine:

```bash
codex mcp add notion_db -- \
  npx --yes --package github:trisetiohidayat/notion-mcp \
  notion-mcp serve
```

Before starting Codex, ensure one local Notion auth source exists:

```bash
ntn login
```

or:

```bash
export NOTION_API_TOKEN='<notion-token>'
codex
```

The server checks `NOTION_TOKEN`, `NOTION_API_TOKEN`, `NOTION_API_KEY`, `NOTION_ACCESS_TOKEN`, then `ntn` file-based auth.

## Recommended: Claude Code Local All-In-One

Use this when Claude Code and Notion auth are on the same machine:

```bash
claude mcp add notion_db -- \
  npx --yes --package github:trisetiohidayat/notion-mcp \
  notion-mcp serve
```

Before starting Claude Code, ensure one local Notion auth source exists:

```bash
ntn login
```

or:

```bash
export NOTION_API_TOKEN='<notion-token>'
claude
```

## Pin a Commit When Needed

For reproducible installs, pin the GitHub package:

```bash
codex mcp add notion_db -- \
  npx --yes --package github:trisetiohidayat/notion-mcp#<commit-sha> \
  notion-mcp serve
```

## Notion Token Source

If the user does not have `NOTION_API_TOKEN`, tell them to create a Notion internal integration:

1. Open <https://www.notion.so/my-integrations>.
2. Create a new internal connection/integration.
3. Copy the integration secret and set it as `NOTION_API_TOKEN`.
4. In the connection settings, add the required pages/databases from the `Content access` tab. New connections may have no content access by default.
5. Alternatively, open the target Notion database/page and use `Add connections`/`Connections` to connect that content to the integration.

Do not assume the token can access every database. Notion only allows the integration to access pages/databases explicitly shared with it.

## About `ntn` Login

The official Notion CLI (`ntn`) can authenticate the local machine with `ntn login`. This is appropriate for local all-in-one MCP because the server runs on the same machine as the client.

Do not assume `ntn login` is enough for remote MCP client setup. For remote Codex or Claude Code clients, prefer `NOTION_API_TOKEN` from a Notion internal integration or server-held Notion auth.

## Alternative: Codex Remote HTTP

Use this only when the user wants to connect to an already-running remote MCP server.

Required inputs:

- `MCP_SERVER_URL`: remote MCP URL, for example `https://mcp.example.com/mcp`
- `NOTION_DB_MCP_TOKEN`: MCP bridge bearer token
- `NOTION_API_TOKEN`: Notion token available on the client machine, when the server uses client-token/dual-header mode

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

## Alternative: Claude Code Remote HTTP

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

## Troubleshooting

- If tools do not appear, restart the MCP client after setting env vars or after `ntn login`.
- If calls return `Missing Notion token`, set `NOTION_API_TOKEN` as a fallback.
- If calls return a Notion API auth error, check `NOTION_API_TOKEN`, `ntn login`, or `X-Notion-Token` for remote mode.
- If a source alias is unknown, the server-side `config.json` needs that source configured.
