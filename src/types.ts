export interface BibleChapter {
  [verse: string]: string;
}

export interface BibleBook {
  [chapter: string]: BibleChapter;
}

export interface BibleVersion {
  [book: string]: BibleBook;
}

export interface VersionInfo {
  name: string;
  abbreviation: string;
  language: string;
  locale: string;
  filePath: string;
}

export interface VerseResult {
  book: string;
  chapter: string;
  verse: string;
  text: string;
}

export interface SearchResult {
  verse: VerseResult;
  matchIndex: number;
}

export interface ComparisonResult {
  book: string;
  chapter: string;
  verse: string;
  versions: {
    version: string;
    abbreviation: string;
    text: string;
  }[];
}
