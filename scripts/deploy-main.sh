#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/edmund/vatrack"
SERVICE="vatrack.service"
REMOTE="origin"
BRANCH="main"

echo "== VaTrack deploy guard =="
cd "$APP_DIR"

current_branch="$(git branch --show-current)"
if [[ "$current_branch" != "$BRANCH" ]]; then
  echo "ERROR: deployment worktree must be on $BRANCH; current: $current_branch" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: worktree is dirty. Commit/stash changes before deploy:" >&2
  git status --short >&2
  exit 1
fi

echo "Fetching $REMOTE/$BRANCH..."
git fetch "$REMOTE" "$BRANCH"

local_sha="$(git rev-parse "$BRANCH")"
remote_sha="$(git rev-parse "$REMOTE/$BRANCH")"
base_sha="$(git merge-base "$BRANCH" "$REMOTE/$BRANCH")"

if [[ "$local_sha" != "$remote_sha" ]]; then
  if [[ "$local_sha" != "$base_sha" ]]; then
    echo "ERROR: local $BRANCH has commits not in $REMOTE/$BRANCH. Resolve manually." >&2
    exit 1
  fi
  echo "Fast-forwarding to $remote_sha"
  git merge --ff-only "$REMOTE/$BRANCH"
else
  echo "Already up to date: $local_sha"
fi

if [[ -f backend/requirements.txt ]]; then
  echo "Installing backend dependencies..."
  .venv/bin/pip install -r backend/requirements.txt
fi

if [[ -f frontend/package-lock.json ]]; then
  echo "Building frontend..."
  (cd frontend && npm ci && npm run build)
fi

echo "Restarting $SERVICE..."
systemctl restart "$SERVICE"
systemctl --no-pager --full status "$SERVICE" | sed -n '1,18p'

echo "Deploy complete. Commit: $(git rev-parse --short HEAD)"
