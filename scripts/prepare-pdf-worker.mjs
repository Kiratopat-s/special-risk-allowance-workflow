import { copyFile, mkdir, readFile, readdir, unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const packagePath = require.resolve("pdfjs-dist/package.json");
const { version } = JSON.parse(await readFile(packagePath, "utf8"));
const destination = new URL("../public/pdfjs/", import.meta.url);
const workerName = `pdf.worker-${version}.min.mjs`;
await mkdir(destination, { recursive: true });
await copyFile(join(dirname(packagePath), "build/pdf.worker.min.mjs"), new URL(workerName, destination));

// Remove only obsolete generated workers after the current worker is ready.
for (const entry of await readdir(destination, { withFileTypes: true })) {
  if (entry.isFile() && /^pdf\.worker-\d+\.\d+\.\d+\.min\.mjs$/.test(entry.name) && entry.name !== workerName) {
    await unlink(new URL(entry.name, destination));
  }
}
