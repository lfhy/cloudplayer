import { defineConfig } from "vite";
import wails from "@wailsio/runtime/plugins/vite";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "./bindings/github.com/wailsapp/wails/v3/internal/eventcreate": resolve(
        __dirname,
        "bindings/github.com/wailsapp/wails/v3/internal/eventcreate.js"
      ),
    },
  },
  plugins: [wails("./bindings")],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        desktop_lyrics: resolve(__dirname, "desktop_lyrics.html"),
      },
    },
  },
});
