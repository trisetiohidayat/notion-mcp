# Notion API Coverage

This project exposes high-level MCP tools for common Notion data source work and
raw API escape-hatch tools for less common Notion API endpoints.

## Coverage Strategy

Use high-level tools first:

- `notion_source_*` tools when a local source alias is configured.
- `notion_db_*` tools when you have a raw `data_source_id`.
- `notion_api_request` for any JSON Notion API endpoint that does not yet have a
  convenience tool.
- `notion_api_paginate` for list/query endpoints that return
  `results`, `has_more`, and `next_cursor`.
- `notion_file_upload_send` for multipart file bytes after creating a Notion file
  upload object.

## Advanced Raw API Tools

### `notion_api_request`

Calls any JSON Notion API endpoint through MCP.

```json
{
  "method": "PATCH",
  "path": "/pages/<page-id>",
  "body": {
    "archived": true
  }
}
```

Use relative paths only. Both `/pages/<id>` and `/v1/pages/<id>` are accepted;
full URLs are rejected.

### `notion_api_paginate`

Paginates endpoints that use Notion's cursor shape.

```json
{
  "path": "/search",
  "body": {
    "query": "Tasks"
  },
  "page_size": 50,
  "max_results": 200
}
```

### `notion_file_upload_send`

Uploads local file bytes to an existing `file_upload_id`.

```json
{
  "file_upload_id": "<file-upload-id>",
  "file_path": "/absolute/path/to/file.pdf"
}
```

Create and complete file uploads with `notion_api_request`; use
`notion_file_upload_send` only for the multipart `send` step.

## Endpoint Map

The current Notion API surface includes these endpoint families:

- Blocks: retrieve/update/delete blocks, retrieve/append block children.
- Comments: list/create/retrieve/update/delete comments.
- Custom emojis: list custom emojis.
- Data sources: create/retrieve/update/query data sources and list templates.
- Databases: create/retrieve/update databases.
- File uploads: list/create/retrieve/send/complete file uploads.
- Pages: create/retrieve/update/move pages, retrieve page properties, retrieve
  and update page markdown.
- Search: search by title.
- Users: list users, retrieve bot user, retrieve a user.
- Views: list/create/retrieve/update/delete views and manage view queries.

High-level tools cover data-source row operations, reporting queries, schema
changes, and page property updates. Raw API tools cover the rest without local
scripts.
