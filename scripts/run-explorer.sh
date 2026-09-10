#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
: "${RPC_URL:?Set RPC_URL in .env}"
: "${ENTRY_POINT:?Set ENTRY_POINT in .env}"
export PORT=3001
exec node explorer/server.mjs
