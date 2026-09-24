// Run with: bun tests/visual/serve-claim-editor.mjs
// Rebuild by restarting after editing the real client or fixture files.
import { build, serve, file, write } from "bun";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, basename } from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = resolve(import.meta.dirname, "../..");
const output = await mkdtemp(join(tmpdir(), "sraw-claim-editor-"));
const mockFile = resolve(import.meta.dirname, "claim-editor-mocks.ts");
const result = await build({
  entrypoints: [resolve(import.meta.dirname, "claim-editor-preview.tsx")],
  outdir: output,
  target: "browser",
  define: { "process.env.NODE_ENV": '"development"', "process.env": "{}" },
  plugins: [{
    name: "isolated-claim-editor-fixture",
    setup(builder) {
      for (const filter of [
        /^@\/app\/actions\//,
        /^next\/navigation$/,
        /^@\/lib\/hooks\/use-scoped-permission$/,
      ]) builder.onResolve({ filter }, () => ({ path: mockFile }));
    },
  }],
});
if (!result.success) throw new Error(result.logs.join("\n"));
const cssFile = join(root, "app/globals.css");
const css = await postcss([tailwind({ base: root })]).process(await readFile(cssFile, "utf8"), { from: cssFile });
await write(join(output, "styles.css"), css.css);
const html = '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SRAW claim editor preview</title><style>@layer theme, base, mui, components, utilities;</style><meta name="emotion-insertion-point" content=""><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/claim-editor-preview.js"></script></body></html>';
const server = serve({
  hostname: "127.0.0.1",
  port: Number(process.env.CLAIM_EDITOR_FIXTURE_PORT ?? 4187),
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/") return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    if (["/styles.css", "/claim-editor-preview.js"].includes(path)) return new Response(file(join(output, basename(path))));
    if (["/fonts/manrope-latin.woff2", "/fonts/noto-sans-thai.woff2"].includes(path)) return new Response(file(join(root, "public", path)));
    return new Response("Not found", { status: 404 });
  },
});
console.log("Isolated claim editor preview: " + server.url);
