/** Python in the browser (CPython compiled to WebAssembly). Packages such as numpy always come from the jsDelivr CDN. */
export const PYODIDE_VERSION = "314.0.7";
export const PYODIDE_CDN_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/**
 * Where Pyodide's core loads from. The website uses the CDN; the Anna app bundles the core next to its workers
 * (vite.config.ts copies it to pyodide/), because Anna's CSP only lets the bundle's own scripts run.
 * Built from parts so Vite doesn't try to resolve the folder as an asset.
 */
export const PYODIDE_INDEX_URL =
  import.meta.env.VITE_PYODIDE_BUNDLED === "true" ? new URL(["..", "pyodide", ""].join("/"), import.meta.url).href : PYODIDE_CDN_URL;
