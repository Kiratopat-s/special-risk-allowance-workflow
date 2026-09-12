// Run with: bun tests/visual/serve-ui-alignment.mjs
// The preview is separate from Next routes and can never call live server actions.
import { build, serve, file, write } from "bun";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, basename } from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = resolve(import.meta.dirname, "../..");
const output = await mkdtemp(join(tmpdir(), "sraw-ui-alignment-"));
const mockFile = resolve(import.meta.dirname, "ui-alignment-mocks.ts");
const result = await build({
  entrypoints: [resolve(import.meta.dirname, "ui-alignment-preview.tsx")],
  outdir: output,
  target: "browser",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{
    name: "isolated-ui-fixtures",
    setup(builder) {
      for (const filter of [
        /^@\/app\/actions\//,
        /^next\/navigation$/,
        /^@\/lib\/hooks\/(use-notifications|use-push-subscription|use-scoped-permission|use-url-filter)$/,
      ]) builder.onResolve({ filter }, () => ({ path: mockFile }));
    },
  }],
});
if (!result.success) throw new Error(result.logs.join("\n"));
const cssFile = join(root, "app/globals.css");
const css = await postcss([tailwind({ base: root })]).process(await readFile(cssFile, "utf8"), { from: cssFile });
await write(join(output, "styles.css"), css.css);
const html = '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SRAW isolated UI fixtures</title><style>@layer theme, base, mui, components, utilities;</style><meta name="emotion-insertion-point" content=""><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/ui-alignment-preview.js"></script></body></html>';
const server = serve({
  hostname: "127.0.0.1",
  port: 4186,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/") return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    if (["/styles.css", "/ui-alignment-preview.js"].includes(path)) return new Response(file(join(output, basename(path))));
    if (/^\/pdfjs\/pdf\.worker-[\d.]+\.min\.mjs$/.test(path)) return new Response(file(join(root, "public", path)), { headers: { "Content-Type": "text/javascript" } });
    if (["/fonts/manrope-latin.woff2", "/fonts/noto-sans-thai.woff2"].includes(path)) return new Response(file(join(root, "public", path)));
    return new Response("Not found", { status: 404 });
  },
});
console.log("Isolated UI fixtures: " + server.url);
