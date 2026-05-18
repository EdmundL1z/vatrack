const CDP = require("chrome-remote-interface");
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const net = require("net");

const SERVER_URL = process.env.SERVER_URL;
const SYNC_TOKEN = process.env.COOKIE_SYNC_TOKEN;
// Set BROWSER=chrome to use Chrome instead; defaults to Edge
const BROWSER = (process.env.BROWSER || "edge").toLowerCase();
const WEGAME_DOMAIN = "www.wegame.com.cn";
const DEBUG_PORT = 9222;

if (!SERVER_URL || !SYNC_TOKEN) {
  console.error("Missing SERVER_URL or COOKIE_SYNC_TOKEN environment variables");
  process.exit(1);
}

const BROWSER_CONFIG = {
  edge: {
    processName: "msedge.exe",
    exePaths: [
      `${process.env["PROGRAMFILES(X86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ],
    userDataDir: `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\User Data`,
  },
  chrome: {
    processName: "chrome.exe",
    exePaths: [
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
    ],
    userDataDir: `${process.env.LOCALAPPDATA}\\Google\\Chrome\\User Data`,
  },
};

const cfg = BROWSER_CONFIG[BROWSER];
if (!cfg) {
  console.error(`Unknown BROWSER value "${BROWSER}". Use "edge" or "chrome".`);
  process.exit(1);
}

function findBrowser() {
  for (const p of cfg.exePaths) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error(
    `${BROWSER} not found. Check installation or set BROWSER=chrome to use Chrome instead.`
  );
}

function isBrowserRunning() {
  try {
    const out = execSync(
      `powershell -NonInteractive -Command "(Get-Process ${cfg.processName.replace(".exe", "")} -ErrorAction SilentlyContinue) -ne $null"`,
      { encoding: "utf8" }
    );
    return out.trim() === "True";
  } catch {
    return false;
  }
}

function killBrowser() {
  try {
    execSync(`taskkill /F /IM ${cfg.processName} /T`, { stdio: "ignore" });
  } catch {}
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!isBrowserRunning()) return;
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
  throw new Error(`${BROWSER} did not start within 15 seconds`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureBrowserWithDebugPort() {
  if (await isPortOpen(DEBUG_PORT)) {
    return { weStartedBrowser: false };
  }

  const wasRunning = isBrowserRunning();
  if (wasRunning) {
    console.log(`${BROWSER} is running without debug port — restarting it...`);
    killBrowser();
    await sleep(1500);
  } else {
    console.log(`${BROWSER} is not running — launching it...`);
  }

  const exePath = findBrowser();
  spawn(
    exePath,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${cfg.userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
    { detached: true, stdio: "ignore" }
  ).unref();

  await waitForPort(DEBUG_PORT);
  await sleep(1000);

  return { weStartedBrowser: !wasRunning };
}

async function extractCookies() {
  const { weStartedBrowser } = await ensureBrowserWithDebugPort();

  let client;
  try {
    client = await CDP({ port: DEBUG_PORT });
    const { Network } = client;
    await Network.enable();
    const { cookies } = await Network.getCookies({ urls: [`https://${WEGAME_DOMAIN}`] });
    await client.close();
    console.log(`Using ${BROWSER} — found ${cookies.length} cookies for ${WEGAME_DOMAIN}`);
    return { cookies, weStartedBrowser };
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
  console.log(`Extracting cookies from ${BROWSER}...`);
  const { cookies, weStartedBrowser } = await extractCookies();

  if (cookies.length === 0) {
    console.warn(
      `No cookies found for WeGame — is the account logged in on this ${BROWSER} profile?\n` +
      `Tip: open ${BROWSER} and log into wegame.com.cn first, then run this script again.`
    );
    process.exit(1);
  }

  const result = await pushCookies(cookies);
  console.log(`Server stored ${result.count} cookies.`);

  if (weStartedBrowser) {
    killBrowser();
    console.log(`${BROWSER} closed (was not running before sync).`);
  }
}

main().catch((err) => {
  console.error("Sync failed:", err.message);
  process.exit(1);
});
