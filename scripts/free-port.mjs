#!/usr/bin/env node

// Free one or more listening ports on Windows or macOS so local dev commands can restart cleanly.
import { execFileSync } from "node:child_process";
import os from "node:os";

function parsePort(value) {
  const port = Number.parseInt(String(value || "").trim(), 10);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}

function uniqueIntegers(values) {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))];
}

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function windowsListeningPids(port) {
  const output = run("netstat", ["-ano", "-p", "tcp"]);
  const lines = output.split(/\r?\n/);
  const pids = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("TCP")) continue;
    const columns = trimmed.split(/\s+/);
    if (columns.length < 5) continue;
    const [protocol, localAddress, , state, pidText] = columns;
    if (protocol !== "TCP" || state !== "LISTENING") continue;
    const localPort = localAddress.split(":").pop();
    if (Number.parseInt(localPort, 10) !== port) continue;
    const pid = Number.parseInt(pidText, 10);
    if (Number.isInteger(pid) && pid > 0) pids.push(pid);
  }
  return uniqueIntegers(pids);
}

function unixListeningPids(port) {
  const output = run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  return uniqueIntegers(
    output
      .split(/\r?\n/)
      .map((line) => Number.parseInt(line.trim(), 10))
  );
}

function listeningPids(port) {
  const platform = os.platform();
  if (platform === "win32") return windowsListeningPids(port);
  if (platform === "darwin") return unixListeningPids(port);
  throw new Error(`Unsupported platform: ${platform}. Expected Windows or macOS.`);
}

function killPid(pid) {
  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw error;
  }
  try {
    process.kill(pid, 0);
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if (error?.code === "ESRCH") return true;
    throw error;
  }
  return true;
}

function main() {
  const ports = uniqueIntegers(process.argv.slice(2).map(parsePort));
  if (ports.length === 0) {
    console.error("Usage: node ./scripts/free-port.mjs <port> [more-ports...]");
    process.exit(1);
  }

  let releasedAny = false;
  for (const port of ports) {
    let pids = [];
    try {
      pids = listeningPids(port);
    } catch (error) {
      const stderr = String(error?.stderr || "").trim();
      if (os.platform() === "darwin" && /status 1/.test(String(error?.message || "")) && !stderr) {
        pids = [];
      } else {
        throw error;
      }
    }
    if (pids.length === 0) {
      console.log(`[free-port] ${port} already free`);
      continue;
    }
    for (const pid of pids) {
      const killed = killPid(pid);
      if (killed) {
        releasedAny = true;
        console.log(`[free-port] released ${port} by stopping pid ${pid}`);
      }
    }
  }

  if (!releasedAny) {
    console.log("[free-port] no listening processes needed to be stopped");
  }
}

try {
  main();
} catch (error) {
  const details = error instanceof Error ? error.message : String(error);
  console.error(`[free-port] ${details}`);
  process.exit(1);
}
