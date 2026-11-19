// Bundles view.html + view.ts into one file: dist/view.html
// That single file is what the ui:// resource serves.
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    rollupOptions: { input: "view.html" },
    outDir: "dist",
    emptyOutDir: true,
  },
});
