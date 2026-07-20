#!/bin/sh
set -e

# Replace placeholder strings with real values from environment variables.
# These were baked in as __SYNDICHAIN_*__ during the Docker build so that
# no secrets are needed in CI. The server's .env.app file supplies the real
# values at container startup via --env-file.

replace() {
  local placeholder="$1"
  local value="$2"
  local target="$3"
  if [ -n "$value" ]; then
    find "$target" -type f \( -name "*.js" -o -name "*.html" -o -name "*.json" \) \
      -exec sed -i "s|${placeholder}|${value}|g" {} +
  fi
}

replace "__SYNDICHAIN_APP_URL__"  "$NEXT_PUBLIC_APP_URL"                  /srv/standalone
replace "__SYNDICHAIN_WC_ID__"    "$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID" /srv/standalone

# ── Start keeper bot in the background ───────────────────────────────────────
# keeper-dist/keeper/intelligent-keeper.js is the compiled output of
# keeper/intelligent-keeper.ts. It loops every 10 s calling batchUpdateStreams
# so on-chain stream balances stay current and recipients can withdraw.
if [ -f "/srv/keeper-dist/keeper/intelligent-keeper.js" ]; then
  echo "[keeper] Starting keeper bot..."
  node /srv/keeper-dist/keeper/intelligent-keeper.js &
  KEEPER_PID=$!
  echo "[keeper] Running as PID $KEEPER_PID"
else
  echo "[keeper] WARNING: keeper-dist not found, skipping keeper bot"
fi

# ── Start Next.js ─────────────────────────────────────────────────────────────
echo "[next] Starting Next.js server..."
exec node /srv/standalone/server.js
