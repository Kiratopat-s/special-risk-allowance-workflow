// Run with: bun tests/visual/serve-email-history.mjs
// This standalone preview replaces every server action before bundling.
import { build, serve, file, write } from "bun";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, basename } from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = resolve(import.meta.dirname, "../..");
const output = await mkdtemp(join(tmpdir(), "sraw-email-history-"));
const mockFile = resolve(import.meta.dirname, "email-history-mocks.ts");
const result = await build({
  entrypoints: [resolve(import.meta.dirname, "email-history-preview.tsx")],
  outdir: output, target: "browser",
  define: { "process.env.NODE_ENV": '"development"', "process.env": "{}" },
  plugins: [{ name: "isolated-email-history", setup(builder) {
    builder.onResolve({ filter: /^@\/app\/actions\// }, () => ({ path: mockFile }));
    builder.onResolve({ filter: /^@\/lib\/(auth|db|domains\/email-delivery)(\/|$)/ }, () => {
      throw new Error("Server modules must never load in the email history fixture");
    });
  } }],
});
if (!result.success) throw new Error(result.logs.join("\n"));
const cssFile = join(root, "app/globals.css");
const css = await postcss([tailwind({ base: root })]).process(await readFile(cssFile, "utf8"), { from: cssFile });
await write(join(output, "styles.css"), css.css);
const html = '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email history isolated preview</title><style>@layer theme,base,mui,components,utilities;</style><meta name="emotion-insertion-point" content=""><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/email-history-preview.js"></script></body></html>';
const server = serve({ hostname: "127.0.0.1", port: Number(process.env.EMAIL_HISTORY_FIXTURE_PORT ?? 4188),
  fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/") return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    if (["/styles.css", "/email-history-preview.js"].includes(path)) return new Response(file(join(output, basename(path))));
    if (["/fonts/manrope-latin.woff2", "/fonts/noto-sans-thai.woff2"].includes(path)) return new Response(file(join(root, "public", path)));
    return new Response("Fixture route unavailable", { status: 404 });
  },
});
console.log("Email history fixture: " + server.url);
