/**
 * DeepWiki Client for fetching and parsing RSC responses
 */

import {
  DeepWikiRSCParser,
  type PageInfo,
  type ParseResult,
} from "./parser.ts";
import { addGitHubLinks } from "./utils.ts";

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
  public baseUrl: string;
  public defaultHeaders: Record<string, string>;
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
  private getRscId(org: string, repo: string): string {
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
    const rscId = this.getRscId(org, repo);
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
    const rscId = this.getRscId(org, repo);
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
        content: addGitHubLinks(
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
    const _result = await this.fetchWiki(org, repo);
    const parser = new DeepWikiRSCParser();

    // Re-parse to ensure we have the parser instance
    const _parsed = parser.parse(
      await this.fetchRSC(
        `${this.baseUrl}/${org}/${repo}?_rsc=${this.getRscId(org, repo)}`,
        { org, repo, wikiRoutes: [""] },
      ),
    );

    return parser.getAllMarkdownCombined();
  }
}
