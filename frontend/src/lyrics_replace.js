// Entry file only boots the lyrics replace window and its shared stylesheet.
import "./styles.css";
import { installFrontendErrorLogging } from "./app/helpers/installFrontendErrorLogging.js";
import { bootstrapLyricsReplaceWindow } from "./windows/lyricsReplace/controller.js";

installFrontendErrorLogging();
bootstrapLyricsReplaceWindow();
