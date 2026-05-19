// Entry file only boots the standalone online-mode confirm child window.
import "./styles.css";
import { installFrontendErrorLogging } from "./app/helpers/installFrontendErrorLogging.js";
import { bootstrapOnlineModeConfirmWindow } from "./windows/onlineModeConfirm/controller.js";

installFrontendErrorLogging();
bootstrapOnlineModeConfirmWindow();
