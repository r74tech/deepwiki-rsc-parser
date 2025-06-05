/**
 * Utility functions for DeepWiki RSC Parser
 */

import { DeepWikiRSCParser } from "./parser.ts";
import { DeepWikiClient } from "./client.ts";
import type { ParseResult, WikiMetadata } from "./parser.ts";

/**
 * Parse RSC response string directly
 */
export function parseRSCResponse(rscContent: string): ParseResult {
  const parser = new DeepWikiRSCParser();
  return parser.parse(rscContent);
}

/**
 * Fetch and parse DeepWiki documentation
 */
export async function fetchDeepWikiDocs(
  org: string,
  repo: string,
): Promise<ParseResult> {
  const client = new DeepWikiClient();
  return await client.fetchWiki(org, repo);
}

/**
 * Extract all markdown content from RSC response
 */
export function extractMarkdown(rscContent: string): string[] {
  const result = parseRSCResponse(rscContent);
  return result.allMarkdown;
}

/**
 * Get a specific page's markdown by page ID
 */
export function getPageContent(
  rscContent: string,
  pageId: string,
): string | null {
  const parser = new DeepWikiRSCParser();
  const result = parser.parse(rscContent);

  const page = result.pages.find((p) => p.id === pageId);
  return page?.content || null;
}

/**
 * Convert DeepWiki pages to a single markdown document
 */
export function convertToMarkdownDocument(
  result: ParseResult,
  metadata?: WikiMetadata,
): string {
  // Use metadata from result if not provided
  const meta = metadata || result.metadata;

  // Create header with metadata
  let header = "# DeepWiki Documentation";

  if (meta) {
    header += `\n\n**Repository:** ${meta.repo_name}`;
    header += `\n**Commit:** ${meta.commit_hash}`;
    header += `\n**Generated:** ${new Date(meta.generated_at).toLocaleString()
      }`;
  }

  // Create table of contents
  const toc = result.pages
    .map((page) =>
      `- [${page.id} ${page.title}](#${page.id.replace(/\./g, "")})`
    )
    .join("\n");

  // Create content sections
  const content = result.pages
    .map((page) => {
      const anchorId = page.id.replace(/\./g, "");
      return `<a id="${anchorId}"></a>\n\n## ${page.id} ${page.title}\n\n${page.content}`;
    })
    .join("\n\n---\n\n");

  return `${header}\n\n## Table of Contents\n\n${toc}\n\n---\n\n${content}`;
}

/**
 * Download all documentation as markdown files
 */
export async function downloadAllDocs(
  org: string,
  repo: string,
  outputDir: string,
): Promise<void> {
  const client = new DeepWikiClient();
  const result = await client.fetchWiki(org, repo);

  // Ensure output directory exists
  await Deno.mkdir(outputDir, { recursive: true });

  // Save each page as a separate file
  for (const page of result.pages) {
    const filename = `${page.id}-${page.title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      }.md`;
    const filepath = `${outputDir}/${filename}`;

    await Deno.writeTextFile(filepath, page.content);
    console.log(`Saved: ${filepath}`);
  }

  // Save combined document
  const combinedPath = `${outputDir}/_combined.md`;
  await Deno.writeTextFile(combinedPath, convertToMarkdownDocument(result));
  console.log(`Saved combined document: ${combinedPath}`);
}
