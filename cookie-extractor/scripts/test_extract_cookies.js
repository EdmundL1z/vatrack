/**
 * Minimal test: extract WeGame cookies from Edge (or Chrome) via CDP.
 * Does NOT push to server. Just prints what cookies were found.
 *
 * Usage:
 *   node scripts/test_extract_cookies.js           (uses Edge)
 *   BROWSER=chrome node scripts/test_extract_cookies.js
 */

const CDP = require("chrome-remote-interface");
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const net = require("net");

const BROWSER = (process.env.BROWSER || "edge").toLowerCase();
const WEGAME_DOMAIN = "www.wegame.com.cn";
const DEBUG_PORT = 9222;

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

function findBrowser() {
  for (const p of cfg.exePaths) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error(`${BROWSER} executable not found.`);
}

function isBrowserRunning() {
  try {
    const out = execSync(
      `powershell -NonInteractive -Command "(Get-Process ${cfg.processName.replace(".exe", "")} -ErrorAction SilentlyContinue) -ne $null"`,
      { encoding: "utf8" }
    );
    return out.trim() === "True";
  } catch { return false; }
}

async function isPortOpen(port) {
  return new Promise((resolve) => {
    const s = net.createConnection(port, "127.0.0.1");
    s.setTimeout(500);
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error", () => resolve(false));
    s.on("timeout", () => { s.destroy(); resolve(false); });
  });
}

async function waitForPort(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("Browser did not open debug port in time.");
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  console.log(`[test] Browser: ${BROWSER}`);

  if (await isPortOpen(DEBUG_PORT)) {
    console.log(`[test] Debug port ${DEBUG_PORT} already open — attaching to running ${BROWSER}`);
  } else if (isBrowserRunning()) {
    console.log(`[test] ${BROWSER} is running but debug port is closed.`);
    console.log(`[test] Please close ${BROWSER} and re-run, OR restart it manually with:`);
    console.log(`[test]   --remote-debugging-port=${DEBUG_PORT} --user-data-dir="${cfg.userDataDir}"`);
    process.exit(1);
  } else {
    console.log(`[test] ${BROWSER} not running — launching with debug port...`);
    const exePath = findBrowser();
    spawn(exePath, [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${cfg.userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
    ], { detached: true, stdio: "ignore" }).unref();
    await waitForPort(DEBUG_PORT);
    await sleep(1000);
    console.log(`[test] ${BROWSER} launched.`);
  }

  let client;
  try {
    client = await CDP({ port: DEBUG_PORT });
    const { Network } = client;
    await Network.enable();
    const { cookies } = await Network.getCookies({ urls: [`https://${WEGAME_DOMAIN}`] });
    await client.close();

    if (cookies.length === 0) {
      console.log(`\n[result] No cookies found for ${WEGAME_DOMAIN}.`);
      console.log(`         Make sure you are logged into WeGame in ${BROWSER} first.`);
      return;
    }

    console.log(`\n[result] Found ${cookies.length} cookies for ${WEGAME_DOMAIN}:\n`);
    for (const c of cookies) {
      const expiry = c.expires > 0
        ? new Date(c.expires * 1000).toISOString()
        : "(session)";
      console.log(`  ${c.name.padEnd(30)} expires: ${expiry}  httpOnly:${c.httpOnly}  secure:${c.secure}`);
    }
  } catch (err) {
    if (client) await client.close().catch(() => {});
    throw err;
  }
}

main().catch((err) => {
  console.error("[error]", err.message);
  process.exit(1);
});
