/**
 * DeepWiki RSC Parser
 *
 * A Deno library for parsing React Server Components responses from DeepWiki
 *
 * @module
 */

export { DeepWikiRSCParser } from "./parser.ts";
export type {
  PageInfo,
  PageStructure,
  ParseResult,
  RSCEntry,
} from "./parser.ts";

export { DeepWikiClient } from "./client.ts";
export type { DeepWikiOptions, FetchOptions } from "./client.ts";

// Re-export convenience functions
export { fetchDeepWikiDocs, parseRSCResponse } from "./utils.ts";
