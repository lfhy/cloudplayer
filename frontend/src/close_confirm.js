// Entry file only boots the standalone close-confirm child window.
import "./styles.css";
import { installFrontendErrorLogging } from "./app/helpers/installFrontendErrorLogging.js";
import { bootstrapCloseConfirmWindow } from "./windows/closeConfirm/controller.js";

installFrontendErrorLogging();
bootstrapCloseConfirmWindow();
