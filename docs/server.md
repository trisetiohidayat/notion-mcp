# Local stdio Server

This project is designed primarily for personal/local stdio MCP. In stdio mode, Codex or Claude Code starts the MCP server as a child process on the same machine.

## No-Clone Server via `npx`

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

## Local Development from Checkout

Use this when editing the MCP tools locally:

```bash
git clone https://github.com/trisetiohidayat/notion-mcp.git
cd notion-mcp
npm install
npm run check
```

Add the local checkout to Codex:

```bash
codex mcp add notion_db_dev -- node /path/to/notion-mcp/bin/notion-mcp.js serve
```

Or configure manually:

```toml
[mcp_servers.notion_db_dev]
command = "node"
args = ["/path/to/notion-mcp/bin/notion-mcp.js", "serve"]
cwd = "/path/to/notion-mcp"
```

Restart the MCP client after code changes.

## Local Auth

Use one local auth source:

```bash
ntn login
```

or:

```bash
export NOTION_API_TOKEN='<notion-token>'
```

The server checks `NOTION_TOKEN`, `NOTION_API_TOKEN`, `NOTION_API_KEY`, `NOTION_ACCESS_TOKEN`, then `ntn` file-based auth.

## Local Config

Create source aliases locally:

```bash
mkdir -p ~/.config/notion-db-mcp
cat > ~/.config/notion-db-mcp/config.json <<'JSON'
{
  "data_sources": {
    "task_list": {
      "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "name": "Task List",
      "key_property": "No",
      "title_property": "Task",
      "status_property": "Status"
    }
  }
}
JSON
```

Use `NOTION_DB_CONFIG` when you want a specific config file:

```bash
export NOTION_DB_CONFIG="$HOME/.config/notion-db-mcp/config.json"
```

## CLI Helper

From a checkout:

```bash
./bin/db.js schema task_list
./bin/db.js get task_list No 38
./bin/db.js update task_list No 38 Status Done
./bin/db.js update-props task_list No 38 Summary="Done: verified"
```
