import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const directories: string[] = [];

function fixture(includeWorker = true) {
  const root = mkdtempSync(join(tmpdir(), "sraw-pdf-worker-test-"));
  directories.push(root);
  const scripts = join(root, "scripts");
  const packageDir = join(root, "node_modules/pdfjs-dist");
  const destination = join(root, "public/pdfjs");
  for (const directory of [scripts, join(packageDir, "build"), destination]) {
    mkdirSync(directory, { recursive: true });
  }
  const script = join(scripts, "prepare-pdf-worker.mjs");
  copyFileSync(new URL("../scripts/prepare-pdf-worker.mjs", import.meta.url), script);
  writeFileSync(join(packageDir, "package.json"), JSON.stringify({ version: "6.2.108" }));
  if (includeWorker) writeFileSync(join(packageDir, "build/pdf.worker.min.mjs"), "patched worker");
  writeFileSync(join(destination, "pdf.worker-5.6.205.min.mjs"), "obsolete worker");
  return { script, destination };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("PDF worker preparation", () => {
  it("replaces obsolete generated workers and preserves unrelated assets on repeated runs", () => {
    const { script, destination } = fixture();
    writeFileSync(join(destination, "README.md"), "keep");
    writeFileSync(join(destination, "pdf.worker-custom.min.mjs"), "keep");
    mkdirSync(join(destination, "pdf.worker-1.0.0.min.mjs"));

    execFileSync(process.execPath, [script]);
    execFileSync(process.execPath, [script]);

    expect(readFileSync(join(destination, "pdf.worker-6.2.108.min.mjs"), "utf8")).toBe("patched worker");
    expect(readdirSync(destination).sort()).toEqual([
      "README.md", "pdf.worker-1.0.0.min.mjs", "pdf.worker-6.2.108.min.mjs", "pdf.worker-custom.min.mjs",
    ]);
  });

  it("fails without deleting existing workers when the replacement cannot be copied", () => {
    const { script, destination } = fixture(false);

    expect(() => execFileSync(process.execPath, [script], { stdio: "pipe" })).toThrow();
    expect(readFileSync(join(destination, "pdf.worker-5.6.205.min.mjs"), "utf8")).toBe("obsolete worker");
  });
});
