const CDP = require("chrome-remote-interface");
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const net = require("net");

const SERVER_URL = process.env.SERVER_URL;
const SYNC_TOKEN = process.env.COOKIE_SYNC_TOKEN;
const WEGAME_DOMAIN = "www.wegame.com.cn";
const DEBUG_PORT = 9222;

if (!SERVER_URL || !SYNC_TOKEN) {
  console.error("Missing SERVER_URL or COOKIE_SYNC_TOKEN environment variables");
  process.exit(1);
}

function findChrome() {
  const candidates = [
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error("Chrome not found. Make sure Google Chrome is installed.");
}

function isChromeRunning() {
  try {
    const out = execSync(
      'powershell -NonInteractive -Command "(Get-Process chrome -ErrorAction SilentlyContinue) -ne $null"',
      { encoding: "utf8" }
    );
    return out.trim() === "True";
  } catch {
    return false;
  }
}

function killChrome() {
  try {
    execSync("taskkill /F /IM chrome.exe /T", { stdio: "ignore" });
  } catch {}
  // Wait until all chrome.exe processes are gone
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!isChromeRunning()) return;
    execSync("ping -n 1 127.0.0.1 > nul", { stdio: "ignore" });
  }
}

async function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection(port, "127.0.0.1");
    socket.setTimeout(500);
    socket.on("connect", () => { socket.destroy(); resolve(true); });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => { socket.destroy(); resolve(false); });
  });
}

async function waitForPort(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("Chrome did not start within 15 seconds");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureChromeWithDebugPort() {
  if (await isPortOpen(DEBUG_PORT)) {
    return { weStartedChrome: false };
  }

  const wasRunning = isChromeRunning();
  if (wasRunning) {
    console.log("Chrome is running without debug port — restarting it...");
    killChrome();
    await sleep(1500);
  } else {
    console.log("Chrome is not running — launching it...");
  }

  const chromePath = findChrome();
  const userDataDir = `${process.env.LOCALAPPDATA}\\Google\\Chrome\\User Data`;

  spawn(
    chromePath,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
    { detached: true, stdio: "ignore" }
  ).unref();

  await waitForPort(DEBUG_PORT);
  await sleep(1000); // let Chrome fully initialise

  return { weStartedChrome: !wasRunning };
}

async function extractCookies() {
  const { weStartedChrome } = await ensureChromeWithDebugPort();

  let client;
  try {
    client = await CDP({ port: DEBUG_PORT });
    const { Network } = client;
    await Network.enable();
    const { cookies } = await Network.getCookies({ urls: [`https://${WEGAME_DOMAIN}`] });
    await client.close();
    return { cookies, weStartedChrome };
  } catch (err) {
    if (client) await client.close().catch(() => {});
    throw err;
  }
}

async function pushCookies(cookies) {
  const res = await fetch(`${SERVER_URL}/api/cookies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sync-token": SYNC_TOKEN,
    },
    body: JSON.stringify({ cookies }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Server responded ${res.status}: ${body}`);
  }
  return res.json();
}

async function main() {
  const { cookies, weStartedChrome } = await extractCookies();

  if (cookies.length === 0) {
    console.warn("No cookies found for WeGame — is the account logged in on this Chrome profile?");
    process.exit(1);
  }

  console.log(`Extracted ${cookies.length} cookies from ${WEGAME_DOMAIN}`);
  const result = await pushCookies(cookies);
  console.log(`Server stored ${result.count} cookies.`);

  // If we launched Chrome just for the sync, close it again
  if (weStartedChrome) {
    killChrome();
    console.log("Chrome closed (was not running before sync).");
  }
}

main().catch((err) => {
  console.error("Sync failed:", err.message);
  process.exit(1);
});
