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
        close_confirm: resolve(__dirname, "close_confirm.html"),
        online_mode_confirm: resolve(__dirname, "online_mode_confirm.html"),
        database_repair: resolve(__dirname, "database_repair.html"),
        message_dialog: resolve(__dirname, "message_dialog.html"),
        account_center: resolve(__dirname, "account_center.html"),
        desktop_lyrics: resolve(__dirname, "desktop_lyrics.html"),
        lyrics_replace: resolve(__dirname, "lyrics_replace.html"),
        tray_player: resolve(__dirname, "tray_player.html"),
      },
    },
  },
});
