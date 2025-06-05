import {
  assertEquals,
  assertExists,
  assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { DeepWikiClient } from "./client.ts";

// Mock fetch for testing
function createMockFetch(
  responses: Map<
    string,
    { status: number; text: string; headers?: Record<string, string> }
  >,
) {
  return (input: string | URL | Request, _init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const response = responses.get(url);

    if (!response) {
      throw new Error(`Unexpected fetch to ${url}`);
    }

    return Promise.resolve({
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      text: () => Promise.resolve(response.text),
      headers: new Headers(
        response.headers || {
          "content-type": "text/x-component",
        },
      ),
    } as Response);
  };
}

Deno.test("DeepWikiClient - constructor with default options", () => {
  const client = new DeepWikiClient();
  assertEquals(client.baseUrl, "https://deepwiki.com");
  assertExists(client.defaultHeaders["user-agent"]);
});

Deno.test("DeepWikiClient - constructor with custom options", () => {
  const client = new DeepWikiClient({
    baseUrl: "https://custom.deepwiki.com",
    defaultHeaders: {
      "x-custom": "header",
    },
  });

  assertEquals(client.baseUrl, "https://custom.deepwiki.com");
  assertEquals(client.defaultHeaders["x-custom"], "header");
  assertExists(client.defaultHeaders["user-agent"]);
});

Deno.test("DeepWikiClient - fetchWiki success", async () => {
  const mockRSC = `18:T379d,# Test Page
Content here.
16:["$","$L17",null,{"repoName":"test/repo","wiki":{"metadata":{"repo_name":"test/repo","commit_hash":"abc123","generated_at":"2025-01-01T00:00:00.000000"},"pages":[{"page_plan":{"id":"1","title":"Test Page"},"content":"$18"}]},"children":[]}]`;

  const responses = new Map([
    ["https://deepwiki.com/test/repo", { status: 200, text: mockRSC }],
  ]);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch(responses);

  try {
    const client = new DeepWikiClient();
    const result = await client.fetchWiki("test", "repo");

    assertExists(result.metadata);
    assertEquals(result.metadata?.repo_name, "test/repo");
    assertEquals(result.pages.length, 1);
    assertEquals(result.pages[0].title, "Test Page");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("DeepWikiClient - fetchWiki handles HTTP errors", async () => {
  const responses = new Map([
    ["https://deepwiki.com/test/repo", { status: 404, text: "Not found" }],
  ]);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch(responses);

  try {
    const client = new DeepWikiClient();
    await assertRejects(
      async () => await client.fetchWiki("test", "repo"),
      Error,
      "HTTP error! status: 404",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("DeepWikiClient - getAllPages", async () => {
  const mockRSC = `18:T379d,# Page 1
19:T470c,# Page 2
16:["$","$L17",null,{"repoName":"test/repo","wiki":{"metadata":{},"pages":[{"page_plan":{"id":"1","title":"Page 1"},"content":"$18"},{"page_plan":{"id":"2","title":"Page 2"},"content":"$19"}]},"children":[]}]`;

  const responses = new Map([
    ["https://deepwiki.com/test/repo", { status: 200, text: mockRSC }],
  ]);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch(responses);

  try {
    const client = new DeepWikiClient();
    const pages = await client.getAllPages("test", "repo");

    assertEquals(pages.length, 2);
    assertEquals(pages[0].id, "1");
    assertEquals(pages[0].title, "Page 1");
    assertEquals(pages[1].id, "2");
    assertEquals(pages[1].title, "Page 2");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("DeepWikiClient - cache behavior", async () => {
  let fetchCount = 0;
  const mockRSC = "18:T379d,# Test";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (
    _input: string | URL | Request,
    _init?: RequestInit,
  ) => {
    fetchCount++;
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(mockRSC),
      headers: new Headers({ "content-type": "text/x-component" }),
    } as Response);
  };

  try {
    const client = new DeepWikiClient();

    // First call
    await client.fetchWiki("test", "repo");
    assertEquals(fetchCount, 1);

    // Second call - should fetch again (no caching implemented)
    await client.fetchWiki("test", "repo");
    assertEquals(fetchCount, 2);

    // Clear cache
    client.clearCache();

    // Third call - should fetch again
    await client.fetchWiki("test", "repo");
    assertEquals(fetchCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
