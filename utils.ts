/**
 * Utility functions for DeepWiki RSC Parser
 */

import { DeepWikiRSCParser } from "./parser.ts";
import { DeepWikiClient } from "./client.ts";
import type { PageInfo, ParseResult, WikiMetadata } from "./parser.ts";

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
    header += `\n\n${formatMetadataForMarkdown(meta)}`;
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
      // Apply GitHub links if metadata is available
      const pageContent = meta ? addGitHubLinks(page.content, meta) : page.content;
      return `<a id="${anchorId}"></a>\n\n## ${page.id} ${page.title}\n\n${pageContent}`;
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
    const filename = generateOutputFilename(page);
    const filepath = `${outputDir}/${filename}`;

    await Deno.writeTextFile(filepath, page.content);
    console.log(`Saved: ${filepath}`);
  }

  // Save combined document
  const combinedPath = `${outputDir}/_combined.md`;
  await Deno.writeTextFile(combinedPath, convertToMarkdownDocument(result));
  console.log(`Saved combined document: ${combinedPath}`);
}

/**
 * Sanitize a string to be used as a filename
 */
export function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Add GitHub links to markdown content
 */
export function addGitHubLinks(
  content: string,
  metadata: WikiMetadata,
): string {
  const { repo_name, commit_hash } = metadata;
  const baseUrl = `https://github.com/${repo_name}/blob/${commit_hash}`;

  // Replace file references like [Makefile](Makefile) with GitHub links
  let processed = content.replace(
    /\[([^\]]+)\]\((?!https?:\/\/)([^)]+)\)/g,
    (match, text, path) => {
      // Skip if it's already a full URL or an anchor link
      if (path.startsWith("#") || path.startsWith("http")) {
        return match;
      }
      return `[${text}](${baseUrl}/${path})`;
    },
  );

  // Replace source references like Sources: [file.py:10-20]() or fix incomplete ones in Sources: lines
  // Also handle **Sources**: format
  processed = processed.replace(
    /(\*\*)?Sources(\*\*)?:([^\n]+)/g,
    (_match, boldStart, boldEnd, sourcesContent) => {
      // Process each citation in the Sources line
      const processedSources = sourcesContent.replace(
        /\[([^\]]+):(\d+)(?:-(\d+))?\]\(([^)]*)\)/g,
        (
          citationMatch: string,
          file: string,
          startLine: string,
          endLine: string | undefined,
          existingUrl: string,
        ) => {
          // If URL already exists and is not empty, keep it
          if (existingUrl && existingUrl.trim() !== "") {
            return citationMatch;
          }
          // Otherwise, generate the GitHub URL
          const lineRef = endLine
            ? `L${startLine}-L${endLine}`
            : `L${startLine}`;
          return `[${file}:${startLine}${
            endLine ? `-${endLine}` : ""
          }](${baseUrl}/${file}#${lineRef})`;
        },
      );
      // Preserve the original formatting (bold or not)
      const prefix = boldStart || "";
      const suffix = boldEnd || "";
      return `${prefix}Sources${suffix}:${processedSources}`;
    },
  );

  return processed;
}

/**
 * Format a wiki page for console display
 */
export function formatPageForDisplay(page: PageInfo): string {
  const separator = "=".repeat(60);
  return `${separator}\n${page.id}: ${page.title}\n${separator}\n${page.content}`;
}

/**
 * Format metadata for console display
 */
export function formatMetadataForConsole(metadata: WikiMetadata): string {
  return [
    "\nMetadata:",
    `- Repository: ${metadata.repo_name}`,
    `- Commit: ${metadata.commit_hash}`,
    `- Generated: ${metadata.generated_at}`,
  ].join("\n");
}

/**
 * Format metadata for markdown display
 */
export function formatMetadataForMarkdown(metadata: WikiMetadata): string {
  return [
    `**Repository:** ${metadata.repo_name}`,
    `**Commit:** ${metadata.commit_hash}`,
    `**Generated:** ${new Date(metadata.generated_at).toLocaleString()}`,
  ].join("\n");
}

/**
 * Generate output filename for a wiki page
 */
export function generateOutputFilename(page: PageInfo): string {
  return `${page.id}-${sanitizeFilename(page.title)}.md`;
}
