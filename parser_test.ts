import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { DeepWikiRSCParser } from "./parser.ts";

Deno.test("DeepWikiRSCParser - parse basic T-type entries", () => {
  const parser = new DeepWikiRSCParser();
  const rscContent = `18:T379d,# Test Content
This is test content.
19:T470c,# Another Page
Another content.`;

  const result = parser.parse(rscContent);

  assertEquals(result.allMarkdown.length, 2);
  assertEquals(result.allMarkdown[0], "# Test Content\nThis is test content.");
  assertEquals(result.allMarkdown[1], "# Another Page\nAnother content.");
});

Deno.test("DeepWikiRSCParser - parse inline T-type entries", () => {
  const parser = new DeepWikiRSCParser();
  const rscContent = `18:T379d,# Introduction
This is the introduction.
Sources: [file.md]()19:T470c,# Core Architecture
Core content here.20:T5dc5,# Plugin System
Plugin content.`;

  const result = parser.parse(rscContent);

  assertEquals(result.allMarkdown.length, 3);
  assertEquals(
    result.allMarkdown[0],
    "# Introduction\nThis is the introduction.\nSources: [file.md]()",
  );
  assertEquals(
    result.allMarkdown[1],
    "# Core Architecture\nCore content here.",
  );
  assertEquals(result.allMarkdown[2], "# Plugin System\nPlugin content.");
});

Deno.test("DeepWikiRSCParser - extract wiki metadata and pages", () => {
  const parser = new DeepWikiRSCParser();
  const rscContent = `18:T379d,# Test Page
Test content.
16:["$","$L17",null,{"repoName":"test/repo","wiki":{"metadata":{"repo_name":"test/repo","commit_hash":"abc123","generated_at":"2025-01-01T00:00:00.000000"},"pages":[{"page_plan":{"id":"1","title":"Test Page"},"content":"$18"}]},"children":[]}]`;

  const result = parser.parse(rscContent);

  assertExists(result.metadata);
  assertEquals(result.metadata?.repo_name, "test/repo");
  assertEquals(result.metadata?.commit_hash, "abc123");

  assertEquals(result.pages.length, 1);
  assertEquals(result.pages[0].id, "1");
  assertEquals(result.pages[0].title, "Test Page");
  assertEquals(result.pages[0].content, "# Test Page\nTest content.");
});

Deno.test("DeepWikiRSCParser - handle RSC data appended to markdown", () => {
  const parser = new DeepWikiRSCParser();
  const rscContent = `2e:T35f0,# Documentation System

This is the documentation system content.

The system is designed to be maintainable.16:["$","$L17",null,{"repoName":"test/repo","wiki":{"metadata":{"repo_name":"test/repo","commit_hash":"abc123","generated_at":"2025-01-01T00:00:00.000000"},"pages":[{"page_plan":{"id":"7.2","title":"Documentation System"},"content":"$2e"}]},"children":[]}]`;

  const result = parser.parse(rscContent);

  assertEquals(result.pages.length, 1);
  assertEquals(result.pages[0].id, "7.2");
  assertEquals(result.pages[0].title, "Documentation System");

  // Verify RSC data is not included in markdown content
  const content = result.pages[0].content;
  assertEquals(content.includes('16:["$"'), false);
  assertEquals(content.includes('"repoName"'), false);
  assertEquals(content.trim().endsWith("maintainable."), true);
});

Deno.test("DeepWikiRSCParser - handle empty response", () => {
  const parser = new DeepWikiRSCParser();
  const result = parser.parse("");

  assertEquals(result.pages.length, 0);
  assertEquals(result.allMarkdown.length, 0);
  assertEquals(result.metadata, undefined);
});

Deno.test("DeepWikiRSCParser - getMarkdownById", () => {
  const parser = new DeepWikiRSCParser();
  const rscContent = `18:T379d,# Test Content
19:T470c,# Another Page`;

  parser.parse(rscContent);

  assertEquals(parser.getMarkdownById("18"), "# Test Content");
  assertEquals(parser.getMarkdownById("19"), "# Another Page");
  assertEquals(parser.getMarkdownById("20"), null);
});

Deno.test("DeepWikiRSCParser - getPageMarkdown", () => {
  const parser = new DeepWikiRSCParser();
  const rscContent = `18:T379d,# Test Page
16:["$","$L17",null,{"repoName":"test/repo","wiki":{"metadata":{},"pages":[{"page_plan":{"id":"1","title":"Test Page"},"content":"$18"},{"page_plan":{"id":"2","title":"Missing Page"},"content":"$19"}]},"children":[]}]`;

  parser.parse(rscContent);

  assertEquals(parser.getPageMarkdown("1"), "# Test Page");
  assertEquals(parser.getPageMarkdown("2"), null); // No content for $19
  assertEquals(parser.getPageMarkdown("3"), null); // No such page
});
