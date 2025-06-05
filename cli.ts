#!/usr/bin/env -S deno run --allow-net --allow-write

/**
 * DeepWiki RSC Parser CLI
 *
 * Usage:
 *   deno run --allow-net --allow-write cli.ts <org> <repo> [options]
 *
 * Options:
 *   --output, -o <dir>    Output directory for markdown files
 *   --page, -p <id>       Fetch specific page by ID
 *   --combined            Save as single combined file
 *   --json                Output as JSON
 */

import { DeepWikiClient } from "./mod.ts";
import { convertToMarkdownDocument } from "./utils.ts";
import type { ParseResult, WikiMetadata } from "./parser.ts";

function printHelp() {
  console.log(`
DeepWiki RSC Parser CLI

Usage:
  deno run --allow-net --allow-write cli.ts <org> <repo> [options]

Options:
  --output, -o <dir>    Output directory for markdown files
  --page, -p <id>       Fetch specific page by ID
  --combined            Save as single combined file
  --json                Output as JSON
  --help, -h            Show this help

Examples:
  # Fetch and display all pages
  deno run --allow-net cli.ts vitejs vite

  # Save to directory
  deno run --allow-net --allow-write cli.ts vitejs vite -o ./docs

  # Fetch specific page
  deno run --allow-net cli.ts vitejs vite -p 5.3-forum-api

  # Output as JSON
  deno run --allow-net cli.ts vitejs vite --json
`);
}

async function main() {
  const args = Deno.args;

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    Deno.exit(0);
  }

  const org = args[0];
  const repo = args[1];

  if (!org || !repo) {
    console.error("Error: Organization and repository are required");
    printHelp();
    Deno.exit(1);
  }

  const options = {
    output: "",
    page: "",
    combined: false,
    json: false,
  };

  // Parse options
  for (let i = 2; i < args.length; i++) {
    switch (args[i]) {
      case "--output":
      case "-o":
        options.output = args[++i] || "";
        break;
      case "--page":
      case "-p":
        options.page = args[++i] || "";
        break;
      case "--combined":
        options.combined = true;
        break;
      case "--json":
        options.json = true;
        break;
    }
  }

  try {
    const client = new DeepWikiClient();

    let result: ParseResult;
    let metadata: WikiMetadata | undefined;

    if (options.page) {
      result = await client.fetchWikiPage(org, repo, options.page);
      metadata = client.parser?.metadata;
    } else {
      result = await client.fetchWiki(org, repo);
      // Extract metadata from the parser if available
      metadata = client.parser?.metadata;
    }

    // JSON output
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // Save to files
    if (options.output) {
      await Deno.mkdir(options.output, { recursive: true });

      if (options.combined) {
        const combined = convertToMarkdownDocument(result, metadata);
        const filepath = `${options.output}/deepwiki-${org}-${repo}.md`;
        await Deno.writeTextFile(filepath, combined);
        console.log(`Saved combined documentation to: ${filepath}`);
      } else {
        // Save metadata file if available
        if (metadata) {
          const metaPath = `${options.output}/.deepwiki-meta.json`;
          await Deno.writeTextFile(metaPath, JSON.stringify(metadata, null, 2));
          console.log(`Saved metadata to: ${metaPath}`);
        }

        for (const page of result.pages) {
          const filename = `${page.id}-${
            page.title
              .toLowerCase()
              .replace(/\s+/g, "-")
              .replace(/[^a-zA-Z0-9-]/g, "-")
              .replace(/-+/g, "-")
              .replace(/^-|-$/g, "")
          }.md`;
          const filepath = `${options.output}/${filename}`;

          // Add GitHub links to content if metadata is available
          let content = page.content;
          if (metadata) {
            content = addGitHubLinks(content, metadata);
          }

          await Deno.writeTextFile(filepath, content);
          console.log(`Saved: ${filepath}`);
        }
      }
    } else {
      // Display to console
      if (metadata) {
        console.log("\nMetadata:");
        console.log(`- Repository: ${metadata.repo_name}`);
        console.log(`- Commit: ${metadata.commit_hash}`);
        console.log(`- Generated: ${metadata.generated_at}`);
      }

      console.log(`\nFound ${result.pages.length} pages:\n`);

      for (const page of result.pages) {
        console.log(`${"=".repeat(60)}`);
        console.log(`${page.id}: ${page.title}`);
        console.log(`${"=".repeat(60)}`);
        console.log(page.content);
        console.log("\n");
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

/**
 * Add GitHub links to markdown content
 */
function addGitHubLinks(content: string, metadata: WikiMetadata): string {
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
  processed = processed.replace(
    /Sources:([^\n]+)/g,
    (_match, sourcesContent) => {
      // Process each citation in the Sources line
      const processedSources = sourcesContent.replace(
        /\[([^\]]+):(\d+)(?:-(\d+))?\]\(([^)]*)\)/g,
        (citationMatch: string, file: string, startLine: string, endLine: string | undefined, existingUrl: string) => {
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
      return `Sources:${processedSources}`;
    },
  );

  return processed;
}

if (import.meta.main) {
  main();
}
