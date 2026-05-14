"""
Local-only script: extracts WeGame cookies from Chrome and pushes to server.
Copies only the cookie files to a temp profile to bypass Chrome's default-dir debug restriction.

Setup: pip install playwright python-dotenv
"""
import json
import os
import shutil
import socket
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

SERVER_URL = os.environ["SERVER_URL"]
SYNC_TOKEN = os.environ["COOKIE_SYNC_TOKEN"]
WEGAME_URL = "https://www.wegame.com.cn"
DEBUG_PORT = 9222

CHROME_PROFILE = Path(os.environ["LOCALAPPDATA"]) / "Google" / "Chrome" / "User Data"
DEBUG_PROFILE = Path(os.environ["TEMP"]) / "vatrack-debug-profile"


def is_debug_port_open() -> bool:
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", DEBUG_PORT)) == 0


def prepare_debug_profile() -> Path:
    """Copy cookie files to a temp dir — avoids Chrome's default-dir debug ban."""
    if DEBUG_PROFILE.exists():
        shutil.rmtree(DEBUG_PROFILE, ignore_errors=True)
    DEBUG_PROFILE.mkdir(parents=True)
    (DEBUG_PROFILE / "Default").mkdir()

    # Local State holds the App-Bound Encryption key
    shutil.copy2(CHROME_PROFILE / "Local State", DEBUG_PROFILE / "Local State")

    # Chrome 117+ stores cookies in Default/Network/
    network_src = CHROME_PROFILE / "Default" / "Network"
    if network_src.exists():
        shutil.copytree(network_src, DEBUG_PROFILE / "Default" / "Network")
    else:
        # Older layout: Default/Cookies
        cookies_src = CHROME_PROFILE / "Default" / "Cookies"
        if cookies_src.exists():
            shutil.copy2(cookies_src, DEBUG_PROFILE / "Default" / "Cookies")

    return DEBUG_PROFILE


def extract_cookies() -> list:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Run: pip install playwright")
        sys.exit(1)

    with sync_playwright() as p:
        if is_debug_port_open():
            print("Using existing Chrome debug port...")
            browser = p.chromium.connect_over_cdp(f"http://localhost:{DEBUG_PORT}")
            cookies = browser.contexts[0].cookies(WEGAME_URL)
            browser.close()
        else:
            print("Preparing temp Chrome profile...")
            debug_profile = prepare_debug_profile()
            try:
                print("Launching Chrome with debug port (your main Chrome is unaffected)...")
                ctx = p.chromium.launch_persistent_context(
                    user_data_dir=str(debug_profile),
                    channel="chrome",
                    headless=False,
                    no_viewport=True,
                    args=[f"--remote-debugging-port={DEBUG_PORT}"],
                )
                cookies = ctx.cookies(WEGAME_URL)
                ctx.close()
            finally:
                shutil.rmtree(debug_profile, ignore_errors=True)

    return cookies


def push_cookies(cookies: list) -> dict:
    import urllib.request

    payload = json.dumps({"cookies": [
        {
            "name": c["name"],
            "value": c["value"],
            "domain": c.get("domain", ""),
            "path": c.get("path", "/"),
            "expires": c.get("expires", -1),
            "httpOnly": c.get("httpOnly", False),
            "secure": c.get("secure", False),
        }
        for c in cookies
    ]}).encode()

    req = urllib.request.Request(
        f"{SERVER_URL}/api/cookies",
        data=payload,
        headers={"Content-Type": "application/json", "x-sync-token": SYNC_TOKEN},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def main():
    cookies = extract_cookies()
    if not cookies:
        print("No WeGame cookies found — is WeGame logged in on this Chrome profile?")
        sys.exit(1)

    print(f"Extracted {len(cookies)} cookies")
    result = push_cookies(cookies)
    print(f"Server stored {result['count']} cookies.")


if __name__ == "__main__":
    main()
