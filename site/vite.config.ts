import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** Pyodide's core, copied into the Anna bundle (Anna caps each file at 10 MB; the biggest is about 9.6 MB). */
const PYODIDE_FILES = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];

/**
 * The Anna bundle: anna.html becomes index.html (Anna's default entry) and Pyodide's core ships inside it.
 * The tokenizer worker imports transformers.js, which drags in onnxruntime's WASM (14–27 MB, over Anna's 10 MB
 * file limit). Tokenizers never run ONNX, and the Anna build uses Anna's models instead, so that WASM is dropped.
 */
function annaBundle(): Plugin {
  const pyodideDir = dirname(createRequire(import.meta.url).resolve("pyodide/package.json"));
  return {
    name: "arena-anna-bundle",
    enforce: "post",
    generateBundle(_options, bundle) {
      const page = bundle["anna.html"];
      if (page) page.fileName = "index.html";
      for (const name of Object.keys(bundle)) {
        if (/ort-wasm[^/]*\.wasm$/.test(name)) delete bundle[name];
      }
      for (const file of PYODIDE_FILES) {
        this.emitFile({ type: "asset", fileName: `pyodide/${file}`, source: readFileSync(join(pyodideDir, file)) });
      }
    },
  };
}

export default defineConfig(({ mode }) =>
  mode === "anna"
    ? {
        // The Arena as an Anna app (see anna/README.md): relative paths, written straight into the app's bundle/.
        base: "./",
        plugins: [react(), annaBundle()],
        build: {
          outDir: "../anna/bundle",
          emptyOutDir: true,
          rollupOptions: { input: { anna: "anna.html", callback: "auth-callback.html" } },
        },
      }
    : {
        // Served from https://carthavate.github.io/ai-engineering-arena/
        base: "/ai-engineering-arena/",
        plugins: [react()],
      },
);
