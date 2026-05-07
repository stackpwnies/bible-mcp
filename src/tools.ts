import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  listVersions,
  listBooks,
  getVerse,
  getChapter,
  getPassage,
  search,
  compare,
} from "./bible-data";

export function registerTools(server: McpServer): void {
  server.registerTool(
    "bible_list_versions",
    {
      description:
        "List all available Bible versions. Optionally filter by language code (e.g. 'en' for English, 'zh' for Chinese, 'de' for German). Returns version name, abbreviation, language, and locale for each version.",
      inputSchema: {
        language: z
          .string()
          .optional()
          .describe(
            "Filter by language. Accepts locale codes (e.g. 'en', 'zh', 'de', 'es', 'fr') or full language names (e.g. 'English', 'Chinese'). Omit to list all versions."
          ),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ language }) => {
      const versions = listVersions(language);
      const formatted = versions
        .map(
          (v) =>
            `**${v.name}** (${v.abbreviation}) — ${v.language} [${v.locale}]`
        )
        .join("\n");
      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${versions.length} Bible version(s):\n\n${formatted}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "bible_list_books",
    {
      description:
        "List all books available in a specific Bible version. Returns book names as they appear in that version (may be in the original language for non-English versions).",
      inputSchema: {
        version: z
          .string()
          .describe(
            "Bible version name or abbreviation. Examples: 'KJV', 'NIV', 'ESV', 'KING JAMES BIBLE', 'NEW INTERNATIONAL VERSION'."
          ),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ version }) => {
      const books = listBooks(version);
      return {
        content: [
          {
            type: "text" as const,
            text: `${version} contains ${books.length} books:\n\n${books.join(", ")}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "bible_get_verse",
    {
      description:
        "Get a single Bible verse by specifying the version, book, chapter, and verse number.",
      inputSchema: {
        version: z
          .string()
          .describe(
            "Bible version name or abbreviation (e.g. 'KJV', 'NIV', 'ESV')."
          ),
        book: z
          .string()
          .describe(
            "Book name (e.g. 'Genesis', 'John', 'Psalms', 'Revelation'). Supports partial/fuzzy matching."
          ),
        chapter: z
          .union([z.string(), z.number()])
          .describe("Chapter number."),
        verse: z
          .union([z.string(), z.number()])
          .describe("Verse number."),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ version, book, chapter, verse }) => {
      const result = getVerse(version, book, chapter, verse);
      return {
        content: [
          {
            type: "text" as const,
            text: `**${result.book} ${result.chapter}:${result.verse}** (${version})\n\n${result.text}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "bible_get_chapter",
    {
      description:
        "Get all verses from a specific chapter in a Bible version. Returns every verse in the chapter.",
      inputSchema: {
        version: z
          .string()
          .describe(
            "Bible version name or abbreviation (e.g. 'KJV', 'NIV', 'ESV')."
          ),
        book: z
          .string()
          .describe(
            "Book name (e.g. 'Genesis', 'John', 'Psalms'). Supports partial/fuzzy matching."
          ),
        chapter: z
          .union([z.string(), z.number()])
          .describe("Chapter number."),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ version, book, chapter }) => {
      const verses = getChapter(version, book, chapter);
      const formatted = verses
        .map((v) => `**${v.verse}.** ${v.text}`)
        .join("\n\n");
      return {
        content: [
          {
            type: "text" as const,
            text: `**${verses[0]?.book || book} ${chapter}** (${version}) — ${verses.length} verses\n\n${formatted}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "bible_get_passage",
    {
      description:
        "Get a range of verses from a chapter. Specify start and end verse numbers to retrieve a passage (e.g. John 3:16-21).",
      inputSchema: {
        version: z
          .string()
          .describe(
            "Bible version name or abbreviation (e.g. 'KJV', 'NIV', 'ESV')."
          ),
        book: z
          .string()
          .describe(
            "Book name (e.g. 'Genesis', 'John', 'Psalms'). Supports partial/fuzzy matching."
          ),
        chapter: z
          .union([z.string(), z.number()])
          .describe("Chapter number."),
        start_verse: z
          .union([z.string(), z.number()])
          .describe("Starting verse number."),
        end_verse: z
          .union([z.string(), z.number()])
          .describe("Ending verse number (inclusive)."),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ version, book, chapter, start_verse, end_verse }) => {
      const verses = getPassage(version, book, chapter, start_verse, end_verse);
      const formatted = verses
        .map((v) => `**${v.verse}.** ${v.text}`)
        .join("\n\n");
      return {
        content: [
          {
            type: "text" as const,
            text: `**${verses[0]?.book || book} ${chapter}:${start_verse}-${end_verse}** (${version}) — ${verses.length} verses\n\n${formatted}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "bible_search",
    {
      description:
        "Search for text within a Bible version. Performs case-insensitive substring matching across all verses. Optionally limit to a specific book and set a max number of results.",
      inputSchema: {
        version: z
          .string()
          .describe(
            "Bible version name or abbreviation (e.g. 'KJV', 'NIV', 'ESV')."
          ),
        query: z
          .string()
          .describe(
            "Text to search for. Case-insensitive substring match. Examples: 'In the beginning', 'love your neighbor', 'for God so loved'."
          ),
        book: z
          .string()
          .optional()
          .describe(
            "Optional: limit search to a specific book (e.g. 'Psalms', 'John')."
          ),
        limit: z
          .number()
          .optional()
          .describe(
            "Maximum number of results to return. Default: 50. Use smaller values for faster responses."
          ),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ version, query, book, limit }) => {
      const results = search(version, query, book, limit);
      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No verses found matching "${query}"${book ? ` in ${book}` : ""} (${version}).`,
            },
          ],
        };
      }
      const formatted = results
        .map(
          (r) =>
            `- **${r.verse.book} ${r.verse.chapter}:${r.verse.verse}**: ${r.verse.text}`
        )
        .join("\n");
      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${results.length} verse(s) matching "${query}" (${version}):\n\n${formatted}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "bible_compare",
    {
      description:
        "Compare the same verse across multiple Bible versions. Provide a book, chapter, verse reference and a list of versions to see how each translation renders that passage side by side.",
      inputSchema: {
        book: z
          .string()
          .describe(
            "Book name (e.g. 'Genesis', 'John', 'Psalms'). Supports partial/fuzzy matching."
          ),
        chapter: z
          .union([z.string(), z.number()])
          .describe("Chapter number."),
        verse: z
          .union([z.string(), z.number()])
          .describe("Verse number."),
        versions: z
          .array(z.string())
          .min(2)
          .max(10)
          .describe(
            "Array of Bible version names or abbreviations to compare (2-10). Examples: ['KJV', 'NIV', 'ESV', 'NLT']."
          ),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ book, chapter, verse, versions }) => {
      const result = compare(book, chapter, verse, versions);
      const formatted = result.versions
        .map(
          (v) =>
            `**${v.version}** (${v.abbreviation}):\n${v.text}`
        )
        .join("\n\n---\n\n");
      return {
        content: [
          {
            type: "text" as const,
            text: `**Comparison: ${result.book} ${result.chapter}:${result.verse}**\n\n${formatted}`,
          },
        ],
      };
    }
  );
}
