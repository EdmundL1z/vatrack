const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Load .env two levels up (cookie-extractor/../.env)
const envPath = path.join(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([^#\s][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}

const SERVER_URL = process.env.SERVER_URL;
const SYNC_THRESHOLD_DAYS = 3;
const LOG_FILE = path.join(__dirname, "../sync.log");
const SYNC_SCRIPT = path.join(__dirname, "../sync_cookies.py");

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  fs.appendFileSync(LOG_FILE, line);
}

async function checkStatus() {
  const res = await fetch(`${SERVER_URL}/api/cookies/status`);
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  return res.json();
}

function syncDecision(status) {
  if (!status.valid) return { needed: true, reason: "cookies invalid or not synced" };
  if (!status.expires_at) return { needed: false, reason: "no expiry info, assuming OK" };
  const daysLeft = (status.expires_at - Date.now() / 1000) / 86400;
  if (daysLeft <= SYNC_THRESHOLD_DAYS) {
    return { needed: true, reason: `expires in ${daysLeft.toFixed(1)} days` };
  }
  return { needed: false, reason: `${daysLeft.toFixed(1)} days until expiry` };
}

async function main() {
  if (!SERVER_URL) {
    log("ERROR: SERVER_URL not set in .env");
    process.exit(1);
  }

  const status = await checkStatus();
  const { needed, reason } = syncDecision(status);

  if (!needed) {
    log(`OK — ${reason}`);
    return;
  }

  log(`Sync needed — ${reason}`);
  execSync(`python "${SYNC_SCRIPT}"`, { stdio: "inherit" });
  log("Sync complete");
}

main().catch((err) => {
  log(`ERROR: ${err.message}`);
  process.exit(1);
});
