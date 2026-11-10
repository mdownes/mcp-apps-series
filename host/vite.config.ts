// Builds the two host pages: index.html (the page you open) and sandbox.html (the proxy iframe).
// Run from this directory (`npm run build`). root is this file's folder so a path with spaces works.
//
// Slimmed down from the official ext-apps basic-host (MIT OR Apache-2.0):
// https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: { input: ["index.html", "sandbox.html"] },
  },
});
