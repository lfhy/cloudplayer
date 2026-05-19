// Entry file only boots the desktop lyrics window runtime modules.
import { installFrontendErrorLogging } from "./app/helpers/installFrontendErrorLogging.js";
import { bootstrapDesktopLyricsWindow } from "./windows/desktopLyrics/bootstrap.js";

installFrontendErrorLogging();
bootstrapDesktopLyricsWindow();
