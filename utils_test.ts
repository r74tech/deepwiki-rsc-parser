import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  parseRSCResponse,
  extractMarkdown,
  getPageContent,
  convertToMarkdownDocument
} from "./utils.ts";
import type { ParseResult } from "./parser.ts";

Deno.test("utils - parseRSCResponse", () => {
  const rscContent = `18:T379d,# Test Page
Content here.`;

  const result = parseRSCResponse(rscContent);
  assertEquals(result.allMarkdown.length, 1);
  assertEquals(result.allMarkdown[0], "# Test Page\nContent here.");
});

Deno.test("utils - extractMarkdown", () => {
  const rscContent = `18:T379d,# Page 1
19:T470c,# Page 2`;

  const markdown = extractMarkdown(rscContent);
  assertEquals(markdown.length, 2);
  assertEquals(markdown[0], "# Page 1");
  assertEquals(markdown[1], "# Page 2");
});

Deno.test("utils - getPageContent", () => {
  const rscContent = `18:T379d,# Test Page
16:["$","$L17",null,{"repoName":"test/repo","wiki":{"metadata":{},"pages":[{"page_plan":{"id":"1","title":"Test Page"},"content":"$18"}]},"children":[]}]`;

  const content = getPageContent(rscContent, "1");
  assertEquals(content, "# Test Page");

  const missing = getPageContent(rscContent, "2");
  assertEquals(missing, null);
});

Deno.test("utils - convertToMarkdownDocument", () => {
  const result: ParseResult = {
    pages: [
      { id: "1", title: "Introduction", content: "# Intro\nWelcome!" },
      { id: "1.1", title: "Getting Started", content: "# Getting Started\nLet's begin." },
    ],
    markdownById: {},
    allMarkdown: [],
    pageStructure: [],
    metadata: {
      repo_name: "test/repo",
      commit_hash: "abc123",
      generated_at: "2025-01-01T00:00:00.000000",
    },
  };

  const doc = convertToMarkdownDocument(result);

  // Check header
  assertEquals(doc.includes("# DeepWiki Documentation"), true);
  assertEquals(doc.includes("**Repository:** test/repo"), true);
  assertEquals(doc.includes("**Commit:** abc123"), true);

  // Check table of contents
  assertEquals(doc.includes("## Table of Contents"), true);
  assertEquals(doc.includes("- [1 Introduction](#1)"), true);
  assertEquals(doc.includes("- [1.1 Getting Started](#11)"), true);

  // Check content sections
  assertEquals(doc.includes("## 1 Introduction"), true);
  assertEquals(doc.includes("Welcome!"), true);
  assertEquals(doc.includes("## 1.1 Getting Started"), true);
  assertEquals(doc.includes("Let's begin."), true);
});

// Note: sanitizeFilename and addGitHubLinks tests removed as these functions
// are not exported from utils.ts after the revert