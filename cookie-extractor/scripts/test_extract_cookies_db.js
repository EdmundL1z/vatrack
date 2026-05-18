/**
 * Extract WeGame cookies directly from Edge/Chrome SQLite database.
 * No browser restart or debug port required — Edge can be open normally.
 *
 * Usage:
 *   node scripts/test_extract_cookies_db.js           (Edge)
 *   BROWSER=chrome node scripts/test_extract_cookies_db.js
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { execSync } = require("child_process");
const Database = require("better-sqlite3");

const BROWSER = (process.env.BROWSER || "edge").toLowerCase();
const WEGAME_HOST = "wegame.com.cn";

const PROFILE_DIRS = {
  edge:   path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "User Data"),
  chrome: path.join(process.env.LOCALAPPDATA, "Google",    "Chrome", "User Data"),
};

const profileDir = PROFILE_DIRS[BROWSER];
if (!profileDir) {
  console.error(`Unknown BROWSER "${BROWSER}". Use "edge" or "chrome".`);
  process.exit(1);
}

// ── Step 1: Read the AES key from Local State (encrypted with Windows DPAPI) ──

function getDecryptionKey() {
  const localStatePath = path.join(profileDir, "Local State");
  if (!fs.existsSync(localStatePath)) {
    throw new Error(`Local State not found at: ${localStatePath}\nIs ${BROWSER} installed?`);
  }
  const localState = JSON.parse(fs.readFileSync(localStatePath, "utf8"));
  const encryptedKeyB64 = localState?.os_crypt?.encrypted_key;
  if (!encryptedKeyB64) throw new Error("os_crypt.encrypted_key not found in Local State");

  // Strip the 5-byte "DPAPI" magic prefix, then decrypt with Windows DPAPI via PowerShell
  const encryptedKey = Buffer.from(encryptedKeyB64, "base64").slice(5);
  const psScript = `
Add-Type -AssemblyName System.Security
$enc = [System.Convert]::FromBase64String('${encryptedKey.toString("base64")}')
$dec = [System.Security.Cryptography.ProtectedData]::Unprotect($enc, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
[System.Convert]::ToBase64String($dec)
`.trim();

  const tmpPs = path.join(os.tmpdir(), "vatrack_dpapi.ps1");
  fs.writeFileSync(tmpPs, psScript, "utf8");
  try {
    const result = execSync(`powershell -NonInteractive -File "${tmpPs}"`, { encoding: "utf8" }).trim();
    return Buffer.from(result, "base64");
  } finally {
    fs.unlinkSync(tmpPs);
  }
}

// ── Step 2: Decrypt a single cookie value (AES-256-GCM, v10 format) ──

function decryptValue(encryptedBuf, key) {
  // Format: "v10" (3 bytes) + nonce (12 bytes) + ciphertext + auth tag (16 bytes)
  if (!encryptedBuf || encryptedBuf.length < 31) return "";
  const prefix = encryptedBuf.slice(0, 3).toString();
  if (prefix !== "v10" && prefix !== "v11") return encryptedBuf.toString("utf8"); // old unencrypted
  const nonce      = encryptedBuf.slice(3, 15);
  const tag        = encryptedBuf.slice(encryptedBuf.length - 16);
  const ciphertext = encryptedBuf.slice(15, encryptedBuf.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext, null, "utf8") + decipher.final("utf8");
}

// ── Step 3: Read cookies from SQLite (copy first — Edge may hold a WAL lock) ──

function readCookies(aesKey) {
  // Newer Edge/Chrome (v96+) stores cookies under Default/Network/Cookies
  const cookiesPath = [
    path.join(profileDir, "Default", "Network", "Cookies"),
    path.join(profileDir, "Default", "Cookies"),
  ].find(p => fs.existsSync(p));
  if (!cookiesPath) {
    throw new Error(`Cookies database not found in ${profileDir}/Default/[Network/]Cookies`);
  }

  // Edge holds an exclusive lock on the Cookies file while running.
  // Copy main + WAL + SHM files using FileShare.ReadWrite to bypass the lock.
  const tmpDb = path.join(os.tmpdir(), "vatrack_cookies_snapshot.sqlite");

  function copyLocked(src, dst) {
    if (!fs.existsSync(src)) return;
    const psScript = [
      `$s=[System.IO.File]::Open('${src.replace(/'/g, "''")}', [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)`,
      `$d=[System.IO.File]::Create('${dst.replace(/'/g, "''")}')`,
      `$s.CopyTo($d); $s.Close(); $d.Close()`,
    ].join("; ");
    const tmpPs = path.join(os.tmpdir(), "vatrack_copy.ps1");
    fs.writeFileSync(tmpPs, psScript, "utf8");
    try {
      execSync(`powershell -NonInteractive -File "${tmpPs}"`, { stdio: "pipe" });
    } finally {
      try { fs.unlinkSync(tmpPs); } catch {}
    }
  }

  copyLocked(cookiesPath,           tmpDb);
  copyLocked(cookiesPath + "-wal",  tmpDb + "-wal");
  copyLocked(cookiesPath + "-shm",  tmpDb + "-shm");

  let rows;
  try {
    const db = new Database(tmpDb, { readonly: true });
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
    console.log("[debug] Tables in DB:", tables.map(t => t.name).join(", "));
    rows = db.prepare(`
      SELECT name, encrypted_value, host_key, path, expires_utc, is_secure, is_httponly
      FROM cookies
      WHERE host_key LIKE ?
      ORDER BY name
    `).all(`%${WEGAME_HOST}%`);
    db.close();
  } finally {
    try { fs.unlinkSync(tmpDb); } catch {}
  }

  return rows.map(r => {
    const value = decryptValue(r.encrypted_value, aesKey);
    // Chrome epoch: microseconds since 1601-01-01; convert to Unix seconds
    const expires = r.expires_utc > 0
      ? r.expires_utc / 1_000_000 - 11_644_473_600
      : -1;
    return { name: r.name, value, domain: r.host_key, path: r.path, expires, httpOnly: !!r.is_httponly, secure: !!r.is_secure };
  });
}

// ── Main ──

try {
  console.log(`[test-db] Browser: ${BROWSER}`);
  console.log(`[test-db] Decrypting AES key via DPAPI...`);
  const aesKey = getDecryptionKey();
  console.log(`[test-db] Key decrypted (${aesKey.length} bytes). Reading cookies...`);

  const cookies = readCookies(aesKey);

  if (cookies.length === 0) {
    console.log(`\n[result] No cookies found for ${WEGAME_HOST}.`);
    console.log(`         Log into wegame.com.cn in ${BROWSER} first.`);
    process.exit(0);
  }

  console.log(`\n[result] Found ${cookies.length} cookies for ${WEGAME_HOST}:\n`);
  for (const c of cookies) {
    const exp = c.expires > 0
      ? new Date(c.expires * 1000).toISOString()
      : "(session)";
    const preview = c.value.length > 20 ? c.value.slice(0, 20) + "…" : c.value;
    console.log(`  ${c.name.padEnd(30)} expires: ${exp.padEnd(32)} value: ${preview}`);
  }
} catch (err) {
  console.error("[error]", err.message);
  process.exit(1);
}
