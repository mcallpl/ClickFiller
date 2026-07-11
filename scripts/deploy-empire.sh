#!/bin/bash
##############################################################################
# ClickFiller — Reproducible deploy to the DigitalOcean droplet empire-command
#
# Encodes the ONLY procedure that works on this host. Do NOT use
# `docker-compose up` on empire-command: its docker-compose is v1.29.2, which
# is incompatible with the installed Docker Engine — `up` fails with
# `KeyError: 'ContainerConfig'` AND deletes the running container in the
# process (this caused a production outage on 2026-07-02). We build with
# plain `docker build` and run with `docker run`.
#
# Architecture on empire-command:
#   - host nginx terminates TLS for clickfiller.com / .peoplestar.com and
#     serves the static frontend from /opt/clickfiller/dist
#   - the Node API runs in the `clickfiller-app` container, listening on 3001
#     inside, published to 127.0.0.1:3002 (nginx proxies /api + /health there)
#   - /opt/clickfiller is NOT a git repo; it is populated by rsync
#
# Usage:  ./scripts/deploy-empire.sh
# Prereqs: local `npm run build` succeeds; SSH access to the droplet; the
#          server-side /opt/clickfiller/.env already holds GEMINI_API_KEY.
##############################################################################
set -euo pipefail

HOST="root@64.227.108.128"
REMOTE_DIR="/opt/clickfiller"
CONTAINER="clickfiller-app"
IMAGE="clickfiller_app:latest"
HOST_PORT="127.0.0.1:3002"
CONTAINER_PORT="3001"

green() { printf '\033[0;32m==>\033[0m %s\n' "$1"; }
red()   { printf '\033[0;31m[ERROR]\033[0m %s\n' "$1" >&2; }

green "1/6  Running tests + lint locally"
npm test --silent
npm run lint

green "2/6  Building frontend bundle"
npm run build

green "3/6  Syncing source to ${REMOTE_DIR} (excluding secrets, node_modules, git)"
rsync -az --exclude node_modules --exclude .git --exclude .env ./ "${HOST}:${REMOTE_DIR}/"
green "     Syncing dist with --delete to purge stale assets"
rsync -az --delete ./dist/ "${HOST}:${REMOTE_DIR}/dist/"

green "4/6  Rebuilding the API image on the droplet"
# `docker-compose build` still works (only `up` is broken); use plain build to
# avoid any dependence on compose.
ssh "${HOST}" "cd ${REMOTE_DIR} && docker build -t ${IMAGE} ."

green "5/6  Restarting the container via docker run (NOT compose up)"
ssh "${HOST}" "docker rm -f ${CONTAINER} >/dev/null 2>&1 || true; \
  docker run -d --name ${CONTAINER} --restart unless-stopped \
    --env-file ${REMOTE_DIR}/.env \
    -e NODE_ENV=production -e PORT=${CONTAINER_PORT} \
    -p ${HOST_PORT}:${CONTAINER_PORT} ${IMAGE} >/dev/null"

green "6/6  Verifying health"
sleep 3
if ssh "${HOST}" "curl -sf ${HOST_PORT/127.0.0.1/127.0.0.1}/health >/dev/null"; then
  ssh "${HOST}" "curl -s ${HOST_PORT/127.0.0.1/127.0.0.1}/health"
  echo
  green "Deploy complete and healthy."
else
  red "Health check failed. Inspect: ssh ${HOST} 'docker logs ${CONTAINER} --tail 50'"
  exit 1
fi
