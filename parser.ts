/**
 * DeepWiki RSC Parser
 *
 * A TypeScript/Deno library for parsing React Server Components responses from DeepWiki
 */

export interface PageInfo {
  id: string;
  title: string;
  content: string;
}

export interface WikiMetadata {
  repo_name: string;
  commit_hash: string;
  generated_at: string;
}

export interface ParseResult {
  pages: PageInfo[];
  markdownById: Record<string, string>;
  allMarkdown: string[];
  pageStructure: PageStructure[];
  metadata?: WikiMetadata;
}

export interface PageStructure {
  id: string;
  title: string;
  contentRef: string;
}

export interface RSCEntry {
  id: string;
  type: "I" | "T" | "ARRAY" | "OTHER";
  content?: string;
  hash?: string;
  fullContent?: string;
}

/**
 * Parser for DeepWiki RSC responses
 */
export class DeepWikiRSCParser {
  private entries = new Map<string, RSCEntry>();
  private markdownContents = new Map<string, string>();
  private pageStructure: PageStructure[] = [];
  public metadata?: WikiMetadata;

  /**
   * Parse RSC response content
   */
  parse(rscContent: string): ParseResult {
    this.reset();

    // Pre-process to extract embedded entries
    // Pattern 1: hex:Thex, (T-type entries)
    // Pattern 2: hex:[ (array entries)
    // Pattern 3: hex:I[ (I-type entries)
    // These can appear anywhere in a line
    const embeddedPatterns = [
      /([0-9a-f]{1,2}):T([0-9a-f]{1,4}),/g,  // T-type
      /([0-9a-f]{1,2}):\[/g,                 // Array type
      /([0-9a-f]{1,2}):I\[/g,                // I-type
    ];

    let processedContent = rscContent;
    for (const pattern of embeddedPatterns) {
      processedContent = processedContent.replace(
        pattern,
        (match) => {
          // Add newline before embedded entries to separate them
          return `\n${match}`;
        },
      );
    }

    const lines = processedContent.split("\n");
    let currentEntry: RSCEntry | null = null;
    let contentBuffer: string[] = [];

    for (const line of lines) {
      const idMatch = line.match(/^([0-9a-f]+):(.*)$/);

      if (idMatch) {
        // Save previous entry
        if (currentEntry) {
          this.saveEntry(currentEntry, contentBuffer);
        }

        // Start new entry
        const [, id, firstPart] = idMatch;
        currentEntry = this.parseEntryStart(id, firstPart);
        contentBuffer = [];

        // Handle first line content
        if (currentEntry.type === "T" && currentEntry.content) {
          contentBuffer.push(currentEntry.content);
        } else if (
          currentEntry.type === "ARRAY" || currentEntry.type === "OTHER"
        ) {
          contentBuffer.push(firstPart);
        }
      } else {
        // Continuation line
        contentBuffer.push(line);
      }
    }

    // Save last entry
    if (currentEntry) {
      this.saveEntry(currentEntry, contentBuffer);
    }

    // Extract page structure
    this.extractPageStructure();

    return this.buildResult();
  }

  private reset(): void {
    this.entries.clear();
    this.markdownContents.clear();
    this.pageStructure = [];
    this.metadata = undefined;
  }

  private parseEntryStart(id: string, content: string): RSCEntry {
    // I type: I[data array]
    if (content.startsWith("I[")) {
      return { id, type: "I", content };
    }

    // Array type
    if (content.startsWith("[")) {
      return { id, type: "ARRAY" };
    }

    // T type: Thash,content (with optional content on first line)
    const tMatch = content.match(/^T([0-9a-f]+)(,(.*))?$/);
    if (tMatch) {
      return {
        id,
        type: "T",
        hash: tMatch[1],
        content: tMatch[3] || "",
      };
    }

    // Other types
    return { id, type: "OTHER" };
  }

  private saveEntry(entry: RSCEntry, contentBuffer: string[]): void {
    let fullContent = contentBuffer.join("\n").trim();

    if (entry.type === "T") {
      // For T-type entries, stop at the first occurrence of RSC metadata patterns
      // This prevents RSC response data from being included in markdown content
      const rscPatterns = [
        /\d+:\["\$","\$L\d+"/,  // RSC array pattern
        /\{"repoName":/,           // Wiki metadata pattern
        /\{"parallelRouterKey":/,  // Next.js router pattern
      ];

      for (const pattern of rscPatterns) {
        const match = fullContent.match(pattern);
        if (match && match.index !== undefined) {
          // Trim content before the RSC metadata
          fullContent = fullContent.substring(0, match.index).trim();
          break;
        }
      }

      this.markdownContents.set(entry.id, fullContent);
    }

    this.entries.set(entry.id, {
      ...entry,
      fullContent,
    });
  }

  private extractPageStructure(): void {
    // Check all entries for page structure and metadata
    for (const [_id, entry] of this.entries) {
      const content = entry.fullContent || "";

      if (content.includes('"wiki":{')) {
        try {
          // Extract metadata
          const metadataMatch = content.match(/"metadata":\s*\{([^\}]+)\}/);
          if (metadataMatch) {
            const metadataStr = `{${metadataMatch[1]}}`;
            try {
              this.metadata = JSON.parse(metadataStr);
            } catch (e) {
              console.error("Error parsing metadata:", e);
            }
          }

          // Extract pages array
          const pagesMatch = content.match(/"pages":\s*\[([\s\S]*?)\]\}/)?.[1];
          if (!pagesMatch) {
            // Try alternative pattern
            const altMatch = content.match(
              /"pages":\s*\[([^\]]+(?:\{[^\}]*\}[^\]]*)*)]/,
            );
            if (altMatch) {
              this.parsePageList(altMatch[1]);
            }
          } else {
            this.parsePageList(pagesMatch);
          }
        } catch (error) {
          console.error("Error parsing page structure:", error);
        }
      }
    }
  }

  private parsePageList(pagesContent: string): void {
    const pageRegex =
      /\{"page_plan":\s*\{"id":\s*"([^"]+)",\s*"title":\s*"([^"]+)"\},\s*"content":\s*"\$([0-9a-f]+)"\}/g;

    this.pageStructure = [];
    let match: RegExpExecArray | null = null;

    while ((match = pageRegex.exec(pagesContent)) !== null) {
      const [, id, title, contentRef] = match;
      this.pageStructure.push({
        id,
        title,
        contentRef,
      });
    }
  }

  private buildResult(): ParseResult {
    const pages: PageInfo[] = [];

    // Build pages from structure
    for (const page of this.pageStructure) {
      const markdown = this.markdownContents.get(page.contentRef);
      if (markdown) {
        pages.push({
          id: page.id,
          title: page.title,
          content: markdown,
        });
      }
    }

    return {
      pages,
      markdownById: Object.fromEntries(this.markdownContents),
      allMarkdown: Array.from(this.markdownContents.values()),
      pageStructure: this.pageStructure,
      metadata: this.metadata,
    };
  }

  /**
   * Get markdown content by ID
   */
  getMarkdownById(id: string): string | null {
    return this.markdownContents.get(id) || null;
  }

  /**
   * Get markdown by page ID
   */
  getPageMarkdown(pageId: string): string | null {
    const page = this.pageStructure.find((p) => p.id === pageId);
    if (page) {
      return this.markdownContents.get(page.contentRef) || null;
    }
    return null;
  }

  /**
   * Get all markdown combined
   */
  getAllMarkdownCombined(): string {
    if (this.pageStructure.length > 0) {
      const sections = this.pageStructure
        .map((page) => {
          const content = this.markdownContents.get(page.contentRef);
          if (content) {
            const separator = "=".repeat(60);
            // Add GitHub links to content if metadata is available
            const processedContent = this.metadata
              ? this.addGitHubLinks(content)
              : content;
            return `${separator}\n${page.id}: ${page.title}\n${separator}\n${processedContent}`;
          }
          return null;
        })
        .filter(Boolean);

      console.log(`\nFound ${sections.length} pages:\n`);
      return sections.join("\n\n");
    }

    return Array.from(this.markdownContents.values()).join("\n\n---\n\n");
  }

  /**
   * Add GitHub links to markdown content
   */
  private addGitHubLinks(content: string): string {
    if (!this.metadata) return content;

    const { repo_name, commit_hash } = this.metadata;
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
          (citationMatch: string, file: string, startLine: string, endLine: string, existingUrl: string) => {
            // If URL already exists and is not empty, keep it
            if (existingUrl && existingUrl.trim() !== "") {
              return citationMatch;
            }
            // Otherwise, generate the GitHub URL
            const lineRef = endLine
              ? `L${startLine}-L${endLine}`
              : `L${startLine}`;
            return `[${file}:${startLine}${endLine ? `-${endLine}` : ""
              }](${baseUrl}/${file}#${lineRef})`;
          },
        );
        return `Sources:${processedSources}`;
      },
    );

    return processed;
  }
}
