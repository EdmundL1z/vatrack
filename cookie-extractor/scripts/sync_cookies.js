/**
 * WeGame Cookie Sync — full flow:
 *   kill browser → launch with debug port → open WeGame → wait for login
 *   → extract cookies → push to server → close browser
 *
 * Config (env vars or .env two levels up):
 *   SERVER_URL         e.g. https://vatrack.edmund1z.cc
 *   COOKIE_SYNC_TOKEN  secret token
 *   BROWSER            edge (default) | chrome
 *
 * Usage:
 *   node scripts/sync_cookies.js
 *   npm run sync
 */

const CDP = require("chrome-remote-interface");
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");

// ── Config ────────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(__dirname, "..", "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const SERVER_URL  = process.env.SERVER_URL;
const SYNC_TOKEN  = process.env.COOKIE_SYNC_TOKEN;
const BROWSER     = (process.env.BROWSER || "edge").toLowerCase();
const WEGAME_URL  = "https://www.wegame.com.cn/home/valorant/index.html";
const WEGAME_HOST = "www.wegame.com.cn";
const DEBUG_PORT  = 9222;
// Auth cookies that only appear after a successful WeGame login
const AUTH_COOKIE_NAMES = new Set(["p_skey", "tgp_ticket", "pt4_token"]);
const LOGIN_TIMEOUT_MS  = 3 * 60 * 1000; // 3 minutes

if (!SERVER_URL || !SYNC_TOKEN) {
  console.error(
    "Missing SERVER_URL or COOKIE_SYNC_TOKEN.\n" +
    "Set them in .env (project root) or as environment variables."
  );
  process.exit(1);
}

// ── Browser config ────────────────────────────────────────────────────────────

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
  console.error(`Unknown BROWSER "${BROWSER}". Use "edge" or "chrome".`);
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findBrowser() {
  for (const p of cfg.exePaths) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error(`${BROWSER} executable not found. Is it installed?`);
}

function killBrowser() {
  try { execSync(`taskkill /F /IM ${cfg.processName} /T`, { stdio: "ignore" }); } catch {}
  // Wait up to 6 s for all processes to die
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    try {
      const out = execSync(
        `powershell -NonInteractive -Command "(Get-Process ${cfg.processName.replace(".exe", "")} -ErrorAction SilentlyContinue) -ne $null"`,
        { encoding: "utf8" }
      );
      if (out.trim() !== "True") return;
    } catch { return; }
    execSync("ping -n 1 127.0.0.1 > nul", { stdio: "ignore" });
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function isPortOpen(port) {
  return new Promise(resolve => {
    const s = net.createConnection(port, "127.0.0.1");
    s.setTimeout(500);
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error",   () => resolve(false));
    s.on("timeout", () => { s.destroy(); resolve(false); });
  });
}

async function waitForPort(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) return;
    await sleep(400);
  }
  throw new Error(`${BROWSER} did not open debug port in time.`);
}

// ── Core ──────────────────────────────────────────────────────────────────────

async function launchBrowser() {
  console.log(`[1/4] Killing existing ${BROWSER} processes...`);
  killBrowser();
  await sleep(800);

  console.log(`[2/4] Launching ${BROWSER} with debug port ${DEBUG_PORT}...`);
  const exePath = findBrowser();
  spawn(
    exePath,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${cfg.userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      WEGAME_URL,   // open WeGame directly
    ],
    { detached: true, stdio: "ignore" }
  ).unref();

  await waitForPort(DEBUG_PORT);
  await sleep(1200); // let browser fully initialise
}

async function waitForLogin() {
  console.log(`[3/4] Waiting for WeGame login (timeout: 3 min)...`);
  console.log(`      → ${WEGAME_URL}`);
  console.log(`      Please scan the QR code in the browser window.`);

  let client;
  try {
    client = await CDP({ port: DEBUG_PORT });
    const { Network } = client;
    await Network.enable();

    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    let dotCount = 0;

    while (Date.now() < deadline) {
      const { cookies } = await Network.getCookies({ urls: [`https://${WEGAME_HOST}`] });
      const hasAuth = cookies.some(c => AUTH_COOKIE_NAMES.has(c.name));
      if (hasAuth) {
        process.stdout.write("\n");
        console.log(`      Login detected (${cookies.length} cookies).`);
        await client.close();
        return cookies;
      }
      // Animated waiting indicator
      process.stdout.write("\r      Waiting" + ".".repeat((dotCount++ % 3) + 1) + "   ");
      await sleep(2000);
    }

    process.stdout.write("\n");
    throw new Error("Login timed out after 3 minutes. Run the script again after logging in.");
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await launchBrowser();
  const cookies = await waitForLogin();

  console.log(`[4/4] Pushing ${cookies.length} cookies to server...`);
  const result = await pushCookies(cookies);
  console.log(`      Server stored ${result.count} cookies. ✓`);

  console.log(`      Closing ${BROWSER}...`);
  killBrowser();
  console.log(`\nDone. WeGame session is now active on the server.`);
}

main().catch(err => {
  console.error("\nSync failed:", err.message);
  // Always try to close the browser on error
  try { killBrowser(); } catch {}
  process.exit(1);
});
