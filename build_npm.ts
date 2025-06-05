import { build, emptyDir } from "https://deno.land/x/dnt@0.40.0/mod.ts";
import denoJson from "./deno.json" with { type: "json" };
await emptyDir("./npm");
await build({
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  shims: { deno: true },
  package: {
    name: denoJson.name,
    version: denoJson.version,
    license: "MIT",
  },
});
