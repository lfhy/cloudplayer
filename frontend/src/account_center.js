// Entry file only boots the standalone account-center child window.
import "./styles.css";
import { installFrontendErrorLogging } from "./app/helpers/installFrontendErrorLogging.js";
import { bootstrapAccountCenterWindow } from "./windows/accountCenter/controller.js";

installFrontendErrorLogging();
bootstrapAccountCenterWindow();
