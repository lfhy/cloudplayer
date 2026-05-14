#!/usr/bin/env node

// Dev wrapper picks a free Vite port first, then launches wails3 dev with the same port for frontend and app.
import net from "node:net";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PORT = 9245;
const MAX_PORT_SPAN = 30;
const STARTUP_GRACE_MS = 3500;
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extraArgs = process.argv.slice(2);

function parsePort(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function portInUse(text, port) {
  return text.includes(`Port ${port} is already in use`);
}

function canBind(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function pickPort() {
  const basePort = parsePort(process.env.WAILS_VITE_PORT, DEFAULT_PORT);
  for (let offset = 0; offset <= MAX_PORT_SPAN; offset += 1) {
    const port = basePort + offset;
    if (await canBind(port)) return port;
  }
  throw new Error(`No free Vite port found in range ${basePort}-${basePort + MAX_PORT_SPAN}`);
}

function forward(stream, target, onChunk) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    target.write(chunk);
    onChunk(chunk);
  });
}

function launchWailsDev(port) {
  return new Promise((resolve) => {
    const env = { ...process.env, WAILS_VITE_PORT: String(port) };
    const child = spawn("wails3", ["dev", "-config", "./build/config.yml", "-port", String(port), ...extraArgs], {
      cwd: rootDir,
      env,
      stdio: ["inherit", "pipe", "pipe"],
    });
    let output = "";
    let handedOff = false;

    const remember = (chunk) => {
      output = `${output}${chunk}`.slice(-4000);
    };
    forward(child.stdout, process.stdout, remember);
    forward(child.stderr, process.stderr, remember);

    const handoffTimer = setTimeout(() => {
      handedOff = true;
      resolve({ type: "running", child, exitPromise });
    }, STARTUP_GRACE_MS);

    const exitPromise = new Promise((exitResolve) => {
      child.once("exit", (code, signal) => {
        clearTimeout(handoffTimer);
        exitResolve({ code, signal });
        if (handedOff) return;
        if (portInUse(output, port)) {
          resolve({ type: "retry" });
          return;
        }
        resolve({ type: "failed", code, signal });
      });
    });
  });
}

async function main() {
  const chosenPort = await pickPort();
  if (chosenPort !== DEFAULT_PORT) {
    console.error(`[dev-port] ${DEFAULT_PORT} occupied, using ${chosenPort} for Vite.`);
  } else {
    console.error(`[dev-port] using ${chosenPort} for Vite.`);
  }

  const result = await launchWailsDev(chosenPort);
  if (result.type === "retry") {
    process.env.WAILS_VITE_PORT = String(chosenPort + 1);
    return main();
  }
  if (result.type === "failed") {
    process.exitCode = result.code ?? 1;
    return;
  }
  const { code, signal } = await result.exitPromise;
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 0;
}

main().catch((error) => {
  console.error(`[dev-port] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
