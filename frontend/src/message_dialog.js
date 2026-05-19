// Entry file only boots the standalone reusable message child window.
import "./styles.css";
import { installFrontendErrorLogging } from "./app/helpers/installFrontendErrorLogging.js";
import { bootstrapMessageDialogWindow } from "./windows/messageDialog/controller.js";

installFrontendErrorLogging();
bootstrapMessageDialogWindow();
