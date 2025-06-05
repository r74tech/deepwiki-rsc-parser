/**
 * DeepWiki Client for fetching and parsing RSC responses
 */

import {
  DeepWikiRSCParser,
  type PageInfo,
  type ParseResult,
  type WikiMetadata,
} from "./parser.ts";

export interface FetchOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

export interface DeepWikiOptions {
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
}

/**
 * Client for interacting with DeepWiki
 */
export class DeepWikiClient {
  public parser = new DeepWikiRSCParser();
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private rscIdCache = new Map<string, string>();

  constructor(options: DeepWikiOptions = {}) {
    this.baseUrl = options.baseUrl || "https://deepwiki.com";
    this.defaultHeaders = {
      "accept": "*/*",
      "user-agent": "DeepWiki-RSC-Parser/1.0",
      ...options.defaultHeaders,
    };
  }

  /**
   * Get RSC ID from initial page load
   */
  private async getRscId(org: string, repo: string): Promise<string> {
    const cacheKey = `${org}/${repo}`;

    // Check cache first
    if (this.rscIdCache.has(cacheKey)) {
      return this.rscIdCache.get(cacheKey) || "";
    }

    // For DeepWiki, we don't need an RSC ID in the URL
    // The server responds with RSC data when we send the proper headers
    this.rscIdCache.set(cacheKey, "");
    return "";
  }

  /**
   * Fetch wiki documentation for a repository
   */
  async fetchWiki(org: string, repo: string): Promise<ParseResult> {
    const rscId = await this.getRscId(org, repo);
    const url = rscId
      ? `${this.baseUrl}/${org}/${repo}?_rsc=${rscId}`
      : `${this.baseUrl}/${org}/${repo}`;

    const response = await this.fetchRSC(url, {
      org,
      repo,
      wikiRoutes: [""],
    });

    return this.parser.parse(response);
  }

  /**
   * Fetch a specific wiki page
   */
  async fetchWikiPage(
    org: string,
    repo: string,
    pageId: string,
  ): Promise<ParseResult> {
    const rscId = await this.getRscId(org, repo);
    const url = `${this.baseUrl}/${org}/${repo}/${pageId}?_rsc=${rscId}`;

    const response = await this.fetchRSC(url, {
      org,
      repo,
      wikiRoutes: [pageId],
    });

    return this.parser.parse(response);
  }

  /**
   * Fetch RSC response with proper headers
   */
  private async fetchRSC(
    url: string,
    routeParams: {
      org: string;
      repo: string;
      wikiRoutes: string[];
    },
  ): Promise<string> {
    const stateTree = this.buildStateTree(routeParams);

    const headers = {
      ...this.defaultHeaders,
      "rsc": "1",
      "next-router-prefetch": "1",
      "next-router-state-tree": encodeURIComponent(stateTree),
      "next-url": `/${routeParams.org}/${routeParams.repo}`,
    };

    const response = await fetch(url, {
      headers,
      method: "GET",
      mode: "cors",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.text();
  }

  /**
   * Build Next.js router state tree
   */
  private buildStateTree(params: {
    org: string;
    repo: string;
    wikiRoutes: string[];
  }): string {
    const wikiRoute = params.wikiRoutes[0] || "";

    return JSON.stringify([
      "",
      {
        children: [
          ["org", params.org, "d"],
          {
            children: [
              ["repo", params.repo, "d"],
              {
                children: [
                  ["wikiRoutes", wikiRoute, "oc"],
                  {
                    children: ["__PAGE__", {}],
                  },
                ],
              },
            ],
          },
        ],
      },
      null,
      null,
      true,
    ]);
  }

  /**
   * Clear RSC ID cache
   */
  clearCache(): void {
    this.rscIdCache.clear();
  }

  /**
   * Get all pages from a wiki
   */
  async getAllPages(org: string, repo: string): Promise<PageInfo[]> {
    const result = await this.fetchWiki(org, repo);
    // Process content to add GitHub links if metadata is available
    if (this.parser.metadata && result.pages) {
      return result.pages.map((page) => ({
        ...page,
        content: this.addGitHubLinksToContent(
          page.content,
          this.parser.metadata || {
            repo_name: org,
            commit_hash: "",
            generated_at: "",
          },
        ),
      }));
    }
    return result.pages;
  }

  /**
   * Get markdown content for all pages
   */
  async getAllMarkdown(org: string, repo: string): Promise<string> {
    const result = await this.fetchWiki(org, repo);
    const parser = new DeepWikiRSCParser();

    // Re-parse to ensure we have the parser instance
    const parsed = parser.parse(
      await this.fetchRSC(
        `${this.baseUrl}/${org}/${repo}?_rsc=${await this.getRscId(org, repo)}`,
        { org, repo, wikiRoutes: [""] },
      ),
    );

    return parser.getAllMarkdownCombined();
  }

  /**
   * Add GitHub links to markdown content
   */
  private addGitHubLinksToContent(
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

    // Replace source references like Sources: [file.py:10-20]()
    processed = processed.replace(
      /Sources:\s*\[([^\]]+):(\d+)(?:-(\d+))?\]\(\)/g,
      (match, file, startLine, endLine) => {
        const lineRef = endLine ? `L${startLine}-L${endLine}` : `L${startLine}`;
        return `Sources: [${file}:${startLine}${
          endLine ? `-${endLine}` : ""
        }](${baseUrl}/${file}#${lineRef})`;
      },
    );

    return processed;
  }
}
