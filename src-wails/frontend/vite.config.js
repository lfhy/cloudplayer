import { defineConfig } from "vite";
import wails from "@wailsio/runtime/plugins/vite";
import { resolve } from "node:path";

export default defineConfig({
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
