import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BibleVersion,
  VersionInfo,
  VerseResult,
  SearchResult,
  ComparisonResult,
} from "./types.js";

function findDataRoot(): string {
  if (process.env.BIBLE_DATA_ROOT) return process.env.BIBLE_DATA_ROOT;

  const candidates = [
    resolve(process.argv[1] || "", "..", ".."),
    resolve(process.argv[1] || "", ".."),
    resolve(process.cwd()),
  ];

  for (const dir of candidates) {
    if (existsSync(join(dir, "locale_version_map.json"))) return dir;
  }

  const __dirname = resolve(fileURLToPath(import.meta.url), "..");
  const devPath = resolve(__dirname, "../../..");
  if (existsSync(join(devPath, "locale_version_map.json"))) return devPath;

  return resolve(__dirname, "../../..");
}

const DATA_ROOT = findDataRoot();
const VERSIONS_DIR = join(DATA_ROOT, "versions");
const APOCRYPHA_DIR = join(DATA_ROOT, "apocrypha-versions");
const LOCALE_MAP_PATH = join(DATA_ROOT, "locale_version_map.json");

interface LocaleMap {
  [locale: string]: {
    [versionName: string]: string;
  };
}

interface CacheEntry {
  data: BibleVersion;
  lastAccess: number;
}

const MAX_CACHE_SIZE = 5;
const versionCache = new Map<string, CacheEntry>();
let versionIndex: VersionInfo[] | null = null;
let localeMap: LocaleMap | null = null;

function loadLocaleMap(): LocaleMap {
  if (!localeMap) {
    const raw = readFileSync(LOCALE_MAP_PATH, "utf-8");
    localeMap = JSON.parse(raw) as LocaleMap;
  }
  return localeMap!;
}

function discoverVersions(): VersionInfo[] {
  if (versionIndex) return versionIndex;

  const versions: VersionInfo[] = [];
  const map = loadLocaleMap();

  for (const [locale, versionEntries] of Object.entries(map)) {
    for (const [versionName, abbreviation] of Object.entries(versionEntries)) {
      const dirPath = join(VERSIONS_DIR, locale);
      if (!existsSync(dirPath)) continue;

      const files = readdirSync(dirPath).filter((f) => f.endsWith(".json"));
      const match = files.find((f) => {
        const name = f.replace(/\.json$/, "");
        return name === versionName || fuzzyMatch(name, versionName);
      });

      if (match) {
        const langName = localeToLanguage(locale);
        versions.push({
          name: versionName,
          abbreviation,
          language: langName,
          locale,
          filePath: join(dirPath, match),
        });
      }
    }
  }

  const apocryphaFiles = existsSync(APOCRYPHA_DIR)
    ? readdirSync(APOCRYPHA_DIR).filter((f) => f.endsWith(".json"))
    : [];

  for (const file of apocryphaFiles) {
    const name = file.replace(/\.json$/, "");
    const existing = versions.find(
      (v) => v.name.toLowerCase() === name.toLowerCase()
    );
    if (!existing) {
      versions.push({
        name: `${name} (Apocrypha)`,
        abbreviation: `${name.toUpperCase().slice(0, 6)}-APOC`,
        language: "English",
        locale: "en",
        filePath: join(APOCRYPHA_DIR, file),
      });
    }
  }

  versionIndex = versions;
  return versions;
}

function fuzzyMatch(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .replace(/\s+/g, "");
  return normalize(a) === normalize(b);
}

function localeToLanguage(locale: string): string {
  const names: Record<string, string> = {
    af: "Afrikaans",
    ar: "Arabic",
    bar: "Bavarian",
    bg: "Bulgarian",
    cs: "Czech",
    da: "Danish",
    de: "German",
    el: "Greek",
    en: "English",
    es: "Spanish",
    eu: "Basque",
    fi: "Finnish",
    fr: "French",
    he: "Hebrew",
    hr: "Croatian",
    hu: "Hungarian",
    hy: "Armenian",
    id: "Indonesian",
    it: "Italian",
    ko: "Korean",
    la: "Latin",
    lv: "Latvian",
    mi: "Maori",
    nl: "Dutch",
    pt: "Portuguese",
    ru: "Russian",
    sq: "Albanian",
    sv: "Swedish",
    sw: "Swahili",
    th: "Thai",
    tr: "Turkish",
    uk: "Ukrainian",
    vi: "Vietnamese",
    zh: "Chinese",
  };
  return names[locale] || locale.toUpperCase();
}

function evictCache(): void {
  if (versionCache.size <= MAX_CACHE_SIZE) return;
  let oldest: string | null = null;
  let oldestTime = Infinity;
  for (const [key, entry] of versionCache) {
    if (entry.lastAccess < oldestTime) {
      oldestTime = entry.lastAccess;
      oldest = key;
    }
  }
  if (oldest) versionCache.delete(oldest);
}

function loadVersion(filePath: string): BibleVersion {
  const cached = versionCache.get(filePath);
  if (cached) {
    cached.lastAccess = Date.now();
    return cached.data;
  }

  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as BibleVersion;
  versionCache.set(filePath, { data, lastAccess: Date.now() });
  evictCache();
  return data;
}

function resolveVersion(versionInput: string): VersionInfo | undefined {
  const versions = discoverVersions();
  const lower = versionInput.toLowerCase().trim();

  return (
    versions.find((v) => v.abbreviation.toLowerCase() === lower) ||
    versions.find((v) => v.name.toLowerCase() === lower) ||
    versions.find(
      (v) =>
        v.name.toLowerCase().includes(lower) ||
        lower.includes(v.abbreviation.toLowerCase())
    )
  );
}

function resolveBookName(
  bible: BibleVersion,
  bookInput: string
): string | undefined {
  const lower = bookInput.toLowerCase().trim();
  const books = Object.keys(bible);

  return (
    books.find((b) => b.toLowerCase() === lower) ||
    books.find((b) => b.toLowerCase().startsWith(lower)) ||
    books.find((b) => {
      const normalized = b
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const inputNorm = lower.replace(/[^a-z0-9]/g, "");
      return normalized === inputNorm || normalized.startsWith(inputNorm);
    })
  );
}

export function listVersions(language?: string): VersionInfo[] {
  const versions = discoverVersions();
  if (!language) return versions;

  const lower = language.toLowerCase().trim();
  return versions.filter(
    (v) =>
      v.locale.toLowerCase() === lower ||
      v.language.toLowerCase() === lower ||
      v.language.toLowerCase().startsWith(lower)
  );
}

export function listBooks(versionInput: string): string[] {
  const info = resolveVersion(versionInput);
  if (!info) {
    throw new Error(
      `Version "${versionInput}" not found. Use bible_list_versions to see available versions.`
    );
  }
  const bible = loadVersion(info.filePath);
  return Object.keys(bible);
}

export function getVerse(
  versionInput: string,
  book: string,
  chapter: string | number,
  verse: string | number
): VerseResult {
  const info = resolveVersion(versionInput);
  if (!info) {
    throw new Error(
      `Version "${versionInput}" not found. Use bible_list_versions to see available versions.`
    );
  }

  const bible = loadVersion(info.filePath);
  const bookName = resolveBookName(bible, book);
  if (!bookName) {
    const available = Object.keys(bible).join(", ");
    throw new Error(
      `Book "${book}" not found in ${info.name}. Available books: ${available}`
    );
  }

  const ch = String(chapter);
  const vs = String(verse);
  const chapterData = bible[bookName]?.[ch];
  if (!chapterData) {
    throw new Error(
      `Chapter ${ch} not found in ${bookName} (${info.name}). The book has ${Object.keys(bible[bookName]).length} chapters.`
    );
  }

  const text = chapterData[vs];
  if (!text) {
    throw new Error(
      `Verse ${vs} not found in ${bookName} ${ch} (${info.name}). The chapter has ${Object.keys(chapterData).length} verses.`
    );
  }

  return { book: bookName, chapter: ch, verse: vs, text };
}

export function getChapter(
  versionInput: string,
  book: string,
  chapter: string | number
): VerseResult[] {
  const info = resolveVersion(versionInput);
  if (!info) {
    throw new Error(
      `Version "${versionInput}" not found. Use bible_list_versions to see available versions.`
    );
  }

  const bible = loadVersion(info.filePath);
  const bookName = resolveBookName(bible, book);
  if (!bookName) {
    const available = Object.keys(bible).join(", ");
    throw new Error(
      `Book "${book}" not found in ${info.name}. Available books: ${available}`
    );
  }

  const ch = String(chapter);
  const chapterData = bible[bookName]?.[ch];
  if (!chapterData) {
    throw new Error(
      `Chapter ${ch} not found in ${bookName} (${info.name}). The book has ${Object.keys(bible[bookName]).length} chapters.`
    );
  }

  return Object.entries(chapterData)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([vs, text]) => ({
      book: bookName,
      chapter: ch,
      verse: vs,
      text,
    }));
}

export function getPassage(
  versionInput: string,
  book: string,
  chapter: string | number,
  startVerse: string | number,
  endVerse: string | number
): VerseResult[] {
  const chapterVerses = getChapter(versionInput, book, chapter);
  const start = Number(startVerse);
  const end = Number(endVerse);

  if (isNaN(start) || isNaN(end)) {
    throw new Error(
      `Invalid verse range: startVerse and endVerse must be numbers.`
    );
  }

  return chapterVerses.filter(
    (v) => Number(v.verse) >= start && Number(v.verse) <= end
  );
}

export function search(
  versionInput: string,
  query: string,
  book?: string,
  limit?: number
): SearchResult[] {
  const info = resolveVersion(versionInput);
  if (!info) {
    throw new Error(
      `Version "${versionInput}" not found. Use bible_list_versions to see available versions.`
    );
  }

  const bible = loadVersion(info.filePath);
  const lowerQuery = query.toLowerCase();
  const maxResults = limit || 50;
  const results: SearchResult[] = [];

  const books = book
    ? [resolveBookName(bible, book)].filter(Boolean) as string[]
    : Object.keys(bible);

  for (const bookName of books) {
    const bookData = bible[bookName];
    if (!bookData) continue;

    for (const [ch, chapterData] of Object.entries(bookData)) {
      for (const [vs, text] of Object.entries(chapterData)) {
        const lowerText = text.toLowerCase();
        const idx = lowerText.indexOf(lowerQuery);
        if (idx !== -1) {
          results.push({
            verse: { book: bookName, chapter: ch, verse: vs, text },
            matchIndex: idx,
          });
          if (results.length >= maxResults) return results;
        }
      }
    }
  }

  return results;
}

export function compare(
  book: string,
  chapter: string | number,
  verse: string | number,
  versionInputs: string[]
): ComparisonResult {
  const ch = String(chapter);
  const vs = String(verse);

  const versionResults = versionInputs.map((vInput) => {
    try {
      const result = getVerse(vInput, book, ch, vs);
      const info = resolveVersion(vInput)!;
      return {
        version: info.name,
        abbreviation: info.abbreviation,
        text: result.text,
      };
    } catch (err) {
      return {
        version: vInput,
        abbreviation: vInput,
        text: `Error: ${(err as Error).message}`,
      };
    }
  });

  const resolvedBook =
    versionResults.find((v) => !v.text.startsWith("Error:")) !== undefined
      ? (() => {
          try {
            return getVerse(versionInputs[0], book, ch, vs).book;
          } catch {
            return book;
          }
        })()
      : book;

  return {
    book: resolvedBook,
    chapter: ch,
    verse: vs,
    versions: versionResults,
  };
}
