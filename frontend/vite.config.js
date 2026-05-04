// Vite wiring keeps Wails bindings aliases stable across the multi-window frontend build.
import { defineConfig } from "vite";
import wails from "@wailsio/runtime/plugins/vite";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@bindings": resolve(__dirname, "bindings"),
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
        lyrics_replace: resolve(__dirname, "lyrics_replace.html"),
        tray_player: resolve(__dirname, "tray_player.html"),
      },
    },
  },
});
