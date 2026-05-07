# AGENTS.md

## Project Overview

Bible JSON MCP Server — an MCP (Model Context Protocol) server that exposes tools for querying Bible versions, books, chapters, verses, searching text, and comparing translations across 100+ Bible versions in 38+ languages.

The server does **not** contain Bible data itself. It reads from an external Bible-json dataset at runtime.

## Getting the Bible Data

The Bible data comes from the [Bible-json](https://github.com/Amosamevor/Bible-json) dataset. Clone it to any location on your machine:

```bash
git clone https://github.com/Amosamevor/Bible-json.git ~/Bible-json
```

The data repo has this structure:

```
Bible-json/
├── versions/{locale}/{version_name}.json   # Main Bible data (100+ versions)
├── apocrypha-versions/{version_name}.json  # Deuterocanonical books
├── locale_version_map.json                 # Locale → version name → abbreviation
└── book_name_mapping.json                  # English book names → localized names
```

Each version JSON uses the structure: `{ "Book": { "Chapter": { "Verse": "text" } } }`

## Requirements

- [Bun](https://bun.sh) runtime

## Commands

```bash
bun install           # Install dependencies
bun run dev           # Run the server directly (for development)
bun run build         # Compile to single binary at bin/bible-mcp
bun run inspector     # Open MCP Inspector for testing
```

## Architecture

```
src/
├── index.ts        # Server entry, stdio transport, McpServer init
├── tools.ts        # All 7 tool registrations with Zod schemas + annotations
├── bible-data.ts   # Data loading, LRU cache (max 5 versions), version resolution, query logic
└── types.ts        # TypeScript interfaces
```

**Data flow:** Tools → `bible-data.ts` functions → lazy-load JSON from disk → parse & cache → return results.

The server finds the data via the `BIBLE_DATA_ROOT` environment variable, which must point to the cloned Bible-json directory.

## The 7 Tools

| Tool | Purpose | Key Params |
|------|---------|------------|
| `bible_list_versions` | List available versions | `language?` filter |
| `bible_list_books` | List books in a version | `version` |
| `bible_get_verse` | Get single verse | `version, book, chapter, verse` |
| `bible_get_chapter` | Get all verses in chapter | `version, book, chapter` |
| `bible_get_passage` | Get verse range | `version, book, chapter, start_verse, end_verse` |
| `bible_search` | Full-text substring search | `version, query, book?, limit?` |
| `bible_compare` | Same verse across versions | `book, chapter, verse, versions[]` |

Version resolution supports full name (`"KING JAMES BIBLE"`), abbreviation (`"KJV"`), or fuzzy substring match. Book names also support fuzzy matching.

## Testing

```bash
# Smoke test via stdio
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"bible_get_verse","arguments":{"version":"KJV","book":"John","chapter":3,"verse":16}}}' | BIBLE_DATA_ROOT=~/Bible-json bin/bible-mcp
```

Evaluations are in `evaluations/bible-eval.xml` — 10 QA pairs for testing tool accuracy.

## Building the Binary

```bash
bun run build
# Output: bin/bible-mcp (~98MB standalone binary)
```

## Registering with MCP Clients

**Generic MCP client config (Claude Code, Cursor, etc.):**
```json
{
  "mcpServers": {
    "bible": {
      "command": "/path/to/bible-mcp/bin/bible-mcp",
      "env": { "BIBLE_DATA_ROOT": "/path/to/Bible-json" }
    }
  }
}
```

**Or run directly without building:**
```json
{
  "mcpServers": {
    "bible": {
      "command": "bun",
      "args": ["run", "/path/to/bible-mcp/src/index.ts"],
      "env": { "BIBLE_DATA_ROOT": "/path/to/Bible-json" }
    }
  }
}
```

## Conventions

- Bun runtime, TypeScript, ESM modules
- No tsconfig — Bun handles TypeScript natively
- Zod for tool input schemas
- No comments in code unless asked
- All tools are read-only (`readOnlyHint: true`)
- Lazy-load JSON files on first access, LRU cache with max 5 entries
- Error messages are actionable with suggestions (e.g. "Available books: ...")
