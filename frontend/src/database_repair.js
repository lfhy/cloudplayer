// Entry file only boots the standalone database-repair child window.
import "./styles.css";
import { installFrontendErrorLogging } from "./app/helpers/installFrontendErrorLogging.js";
import { bootstrapDatabaseRepairWindow } from "./windows/databaseRepair/controller.js";

installFrontendErrorLogging();
bootstrapDatabaseRepairWindow();
