#!/usr/bin/env python3
import hashlib
import hmac
import json
import logging
import os
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.getenv("VATRACK_WEBHOOK_HOST", "127.0.0.1")
PORT = int(os.getenv("VATRACK_WEBHOOK_PORT", "9010"))
SECRET = os.environ["VATRACK_WEBHOOK_SECRET"].encode()
EXPECTED_REPO = os.getenv("VATRACK_WEBHOOK_REPO", "EdmundL1z/vatrack")
EXPECTED_REF = os.getenv("VATRACK_WEBHOOK_REF", "refs/heads/main")
DEPLOY_CMD = os.getenv("VATRACK_DEPLOY_CMD", "/home/edmund/vatrack/scripts/deploy-main.sh")
LOCK_PATH = os.getenv("VATRACK_WEBHOOK_LOCK", "/tmp/vatrack-webhook-deploy.lock")
LOG_PATH = os.getenv("VATRACK_WEBHOOK_LOG", "/var/log/vatrack-webhook/webhook.log")
MAX_BODY = int(os.getenv("VATRACK_WEBHOOK_MAX_BODY", str(2 * 1024 * 1024)))

os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
logging.basicConfig(
    filename=LOG_PATH,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

_deploy_lock = threading.Lock()
_deploy_running = False


def verify_signature(body: bytes, signature: str | None) -> bool:
    if not signature or not signature.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def deploy(delivery: str, after: str):
    global _deploy_running
    try:
        logging.info("deploy start delivery=%s after=%s", delivery, after)
        result = subprocess.run(
            ["/usr/bin/flock", "-n", LOCK_PATH, DEPLOY_CMD],
            cwd="/home/edmund/vatrack",
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=600,
        )
        logging.info("deploy done delivery=%s code=%s\n%s", delivery, result.returncode, result.stdout[-12000:])
    except subprocess.TimeoutExpired as exc:
        logging.error("deploy timeout delivery=%s output=%s", delivery, (exc.stdout or "")[-12000:])
    except Exception:
        logging.exception("deploy crashed delivery=%s", delivery)
    finally:
        with _deploy_lock:
            _deploy_running = False


class Handler(BaseHTTPRequestHandler):
    server_version = "VaTrackWebhook/1.0"

    def log_message(self, fmt, *args):
        logging.info("client=%s " + fmt, self.client_address[0], *args)

    def send_text(self, code: int, text: str):
        body = text.encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self.send_text(200, "ok\n")
        else:
            self.send_text(404, "not found\n")

    def do_POST(self):
        global _deploy_running
        if self.path != "/github/vatrack":
            self.send_text(404, "not found\n")
            return

        event = self.headers.get("X-GitHub-Event", "")
        delivery = self.headers.get("X-GitHub-Delivery", "")
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0 or length > MAX_BODY:
            self.send_text(413, "invalid body size\n")
            return
        body = self.rfile.read(length)

        if not verify_signature(body, self.headers.get("X-Hub-Signature-256")):
            logging.warning("signature rejected event=%s delivery=%s", event, delivery)
            self.send_text(403, "bad signature\n")
            return

        if event == "ping":
            self.send_text(200, "pong\n")
            return
        if event != "push":
            self.send_text(204, "")
            return

        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self.send_text(400, "bad json\n")
            return

        repo = (payload.get("repository") or {}).get("full_name")
        ref = payload.get("ref")
        after = payload.get("after", "")
        if repo != EXPECTED_REPO or ref != EXPECTED_REF:
            logging.info("ignored repo=%s ref=%s delivery=%s", repo, ref, delivery)
            self.send_text(202, "ignored\n")
            return

        with _deploy_lock:
            if _deploy_running:
                self.send_text(202, "deploy already running\n")
                return
            _deploy_running = True

        t = threading.Thread(target=deploy, args=(delivery, after), daemon=True)
        t.start()
        self.send_text(202, "deploy accepted\n")


if __name__ == "__main__":
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    logging.info("starting webhook receiver on %s:%s repo=%s ref=%s", HOST, PORT, EXPECTED_REPO, EXPECTED_REF)
    httpd.serve_forever()
