# DeepWiki RSC Parser

A Deno/TypeScript library for parsing React Server Components (RSC) responses
from DeepWiki. This parser extracts Markdown documentation from DeepWiki's RSC
format with dynamic RSC ID detection.

## Features

- 🚀 Dynamic RSC ID detection
- 📄 Full Markdown extraction from RSC responses (all pages in single request)
- 🔧 TypeScript with full type definitions
- 🦕 Built for Deno with Web standard APIs
- 📦 Can be compiled to npm package
- ⚡ Efficient parsing with streaming support
- ✅ Extract metadata (repository name, commit hash, generation time)
- ✅ Support for individual page output with proper naming (e.g.,
  `1.overview.md`)
- ✅ Combined markdown document generation with metadata header
- ✅ Automatic metadata file generation (`.deepwiki-meta.json`)

## Installation

### Deno

```typescript
import { DeepWikiClient } from "https://deno.land/x/deepwiki_rsc_parser/mod.ts";
```

### Node.js (after building)

```bash
npm install @r74tech/deepwiki-rsc-parser
```

## Usage

### Basic Usage

```typescript
import { DeepWikiClient } from "./mod.ts";

// Create client instance
const client = new DeepWikiClient();

// Fetch and parse wiki documentation
const result = await client.fetchWiki("vitejs", "vite");

// Access parsed pages
for (const page of result.pages) {
  console.log(`${page.id}: ${page.title}`);
  console.log(page.content);
}
```

### Parse RSC Response Directly

```typescript
import { parseRSCResponse } from "./mod.ts";

const rscContent = `...RSC response string...`;
const result = parseRSCResponse(rscContent);

console.log(result.pages);
```

### Get Specific Page

```typescript
import { DeepWikiClient } from "./mod.ts";

const client = new DeepWikiClient();
const page = await client.fetchWikiPage("vitejs", "vite", "1.overview");
```

### Download All Documentation

```typescript
import { downloadAllDocs } from "./mod.ts";

// Download all docs to a directory
await downloadAllDocs("vitejs", "vite", "./output");
```

## API Reference

### DeepWikiClient

```typescript
class DeepWikiClient {
  constructor(options?: DeepWikiOptions);

  // Fetch entire wiki
  fetchWiki(org: string, repo: string): Promise<ParseResult>;

  // Fetch specific page
  fetchWikiPage(
    org: string,
    repo: string,
    pageId: string,
  ): Promise<ParseResult>;

  // Get all pages
  getAllPages(org: string, repo: string): Promise<PageInfo[]>;

  // Get combined markdown
  getAllMarkdown(org: string, repo: string): Promise<string>;

  // Clear cache
  clearCache(): void;
}
```

### DeepWikiRSCParser

```typescript
class DeepWikiRSCParser {
  // Parse RSC content
  parse(rscContent: string): ParseResult;

  // Get markdown by ID
  getMarkdownById(id: string): string | null;

  // Get page markdown
  getPageMarkdown(pageId: string): string | null;

  // Get all markdown combined
  getAllMarkdownCombined(): string;
}
```

## Development

### Prerequisites

- Deno 1.40 or higher

### Setup

```bash
git clone https://github.com/r74tech/deepwiki-rsc-parser.git
cd deepwiki-rsc-parser
```

### Running Tests

```bash
deno test --allow-net
```

### Format Code

```bash
deno fmt
```

### Lint

```bash
deno lint
```

### Build for npm

```bash
deno task build
```

## Building for npm

To use this library with npm/pnpm/yarn, you can build it using DNT (Deno to Node
Transform):

1. Create `scripts/build_npm.ts`:

```typescript
import { build, emptyDir } from "https://deno.land/x/dnt/mod.ts";

await emptyDir("./npm");

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  shims: {
    deno: true,
  },
  package: {
    name: "@r74tech/deepwiki-rsc-parser",
    version: Deno.args[0] || "0.1.0",
    description: "Parser for DeepWiki RSC responses",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/r74tech/deepwiki-rsc-parser.git",
    },
  },
  postBuild() {
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
```

2. Build:

```bash
deno run -A scripts/build_npm.ts 0.1.0
```

3. Publish:

```bash
cd npm
npm publish
```

## Examples

### CLI Tool Examples

Save all pages to individual files:

```bash
deno run --allow-net --allow-write cli.ts vitejs vite -o ./docs
```

This will create:

```
docs/
├── .deepwiki-meta.json       # Metadata file
├── 1.overview.md
├── 1.1.installation-and-setup.md
├── 1.2.project-architecture.md
└── ... (all other pages)
```

Create a combined markdown file:

```bash
deno run --allow-net --allow-write cli.ts vitejs vite -o ./docs --combined
```

Export as JSON:

```bash
deno run --allow-net cli.ts vitejs vite --json > wiki.json
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
