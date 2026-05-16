# Configuration

Copy the example config and edit it for your own Notion workspace:

```bash
cp config.example.json config.json
```

`config.json` is intentionally ignored by git because it may contain workspace-specific IDs.

## Simple Aliases

Use `aliases` when you only need a short name for a Notion `data_source_id`:

```json
{
  "aliases": {
    "tasks": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

Then use `tasks` wherever a tool asks for `data_source_id`.

## Rich Data Source Metadata

Use `data_sources` when you have many Notion databases/tables and want default key/title/status properties:

```json
{
  "data_sources": {
    "tasks": {
      "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "name": "Tasks",
      "description": "Implementation task database",
      "key_property": "No",
      "title_property": "Task",
      "status_property": "Status"
    },
    "customers": {
      "id": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
      "name": "Customers",
      "description": "Customer master database",
      "key_property": "Customer Code",
      "title_property": "Name"
    }
  }
}
```

With this metadata, source tools can be called with fewer arguments:

```json
{
  "source": "tasks",
  "key_value": 38
}
```

## Resolving Notion IDs

Notion database URLs usually contain a database ID. Newer Notion API endpoints operate on data source IDs. You can resolve a database ID with the official Notion CLI:

```bash
ntn datasources resolve <database_id> --json
```

Use the returned `data_sources[0].id` in this project's config.
