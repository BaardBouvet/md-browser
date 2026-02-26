#!/usr/bin/env bash
# ─── md-browser dev helper ──────────────────────────────────────────────────
# Runs npm / build commands inside a Docker container so you don't need
# Node.js installed locally.
# Usage:
#   ./dev.sh install            — npm install
#   ./dev.sh build              — build both Chromium (Chrome/Edge) + Firefox
#   ./dev.sh build --firefox    — build Firefox only
#   ./dev.sh build --chromium   — build Chromium only
#   ./dev.sh build --chrome     — build Chromium only (alias)
#   ./dev.sh watch              — watch mode (both targets)
#   ./dev.sh shell              — interactive shell in container
#   ./dev.sh <cmd>              — run arbitrary command
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

IMAGE="node:22-bookworm-slim"
DOCKER_RUN="docker run --rm -v $PWD:/app -w /app"

case "${1:-build}" in
  install)
    $DOCKER_RUN "$IMAGE" npm install
    ;;
  build)
    shift || true
    $DOCKER_RUN "$IMAGE" node build.mjs "$@"
    ;;
  watch)
    shift || true
    $DOCKER_RUN -it "$IMAGE" node build.mjs --watch "$@"
    ;;
  shell)
    $DOCKER_RUN -it "$IMAGE" bash
    ;;
  *)
    $DOCKER_RUN "$IMAGE" "$@"
    ;;
esac
