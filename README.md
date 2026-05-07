# Bible MCP Server

An MCP server that lets any AI assistant look up Bible verses, search across translations, and compare how different versions render the same passage.

Built on the [Bible-json](https://github.com/Amosamevor/Bible-json) dataset. 100+ versions across 38+ languages, all local, no API keys.

## Why this exists

Most Bible APIs are rate-limited, require keys, or only cover a few versions. The actual text data is freely available, but getting it into an AI tool is still annoying.

This server fixes that. Clone the data, build the binary, point your MCP client at it. Done. Your AI can now pull up any verse in any version without hitting a remote service.

If you're building a Bible study app, doing theological research, or just want Claude to be able to look something up, this should save you some time.

## What you get

Seven tools, all read-only, all running locally:

| Tool | What it does |
|------|-------------|
| `bible_list_versions` | See available Bible versions, filterable by language |
| `bible_list_books` | List all books in a given version |
| `bible_get_verse` | Pull a single verse |
| `bible_get_chapter` | Get an entire chapter |
| `bible_get_passage` | Get a range of verses (e.g. John 3:16-21) |
| `bible_search` | Full-text search across a version |
| `bible_compare` | Same verse side-by-side in multiple translations |

Version names are flexible. Use `"KJV"`, `"King James Bible"`, or even partial matches. Book names work the same way.

## Quick start

### 1. Get the Bible data

```bash
git clone https://github.com/Amosamevor/Bible-json.git ~/Bible-json
```

### 2. Install and build

```bash
git clone https://github.com/stackpwnies/bible-mcp.git
cd bible-mcp
bun install
bun run build
```

You need [Bun](https://bun.sh). If you don't have it, install it. You can also skip the build step and run `bun run src/index.ts` directly during development.

### 3. Add to your MCP client

**Claude Code** (`~/.claude.json` or project `.mcp.json`):
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

**Cursor / VS Code** (`.cursor/mcp.json`):
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

**Without building** (runs from source):
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

## Examples

Once connected, your AI assistant can handle things like:

> "Look up John 3:16 in the KJV"

> "Compare Psalm 23:1 across KJV, NIV, ESV, and NLT"

> "Search for 'valley of the shadow of death' in the KJV"

> "What English Bible versions are available?"

> "Show me all of 1 Corinthians 13 in the NIV"

> "How many books are in the King James Bible?"

## Languages

English, Chinese, Spanish, French, German, Portuguese, Russian, Arabic, Hebrew, Greek, Korean, Italian, Dutch, Swedish, Finnish, Hungarian, Czech, Croatian, Albanian, Danish, Turkish, Thai, Vietnamese, Indonesian, Basque, Latin, Latvian, Maori, Swahili, Ukrainian, Armenian. Some languages have multiple versions. English has 44.

## How it works

The server loads Bible JSON files on first access and keeps the 5 most recently used versions in memory. No database, no running server, no network calls. Files on disk, read when needed, cached so repeated lookups are fast.

Version resolution handles abbreviations (`KJV`), full names (`King James Bible`), and fuzzy matches. Book names work the same way.

## Requirements

- [Bun](https://bun.sh)
- [Bible-json](https://github.com/Amosamevor/Bible-json) dataset (cloned separately)

## License

MIT

## Thanks

- [Amosamevor/Bible-json](https://github.com/Amosamevor/Bible-json) for the Bible dataset
- [Model Context Protocol](https://modelcontextprotocol.io) for the open protocol
