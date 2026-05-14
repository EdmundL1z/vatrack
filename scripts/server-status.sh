#!/usr/bin/env bash
set -euo pipefail
cd /home/edmund/vatrack

echo "== Git =="
git status --short --branch
git remote -v

echo
printf 'HEAD: '
git log -1 --oneline

echo
printf 'Upstream: '
git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo '(none)'

echo
printf 'Service: '
systemctl is-active vatrack.service || true
systemctl --no-pager --full status vatrack.service | sed -n '1,14p'

echo
printf 'Nginx: '
systemctl is-active nginx || true
/usr/sbin/nginx -t 2>&1 || true

echo
printf 'API: '
curl -fsS --max-time 5 'http://127.0.0.1/api/battles?limit=1' >/dev/null && echo ok || echo fail
