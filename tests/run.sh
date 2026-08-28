#!/usr/bin/env bash
# Lance les trois suites de tests contre un serveur local.
# Usage : ./tests/run.sh
set -uo pipefail
cd "$(dirname "$0")/.."

# Playwright peut être installé localement (npm i -D playwright) ou globalement.
# Pour une installation globale, pointer NODE_PATH vers le dossier des modules :
#   NODE_PATH=$(npm root -g) ./tests/run.sh
# CHROMIUM_PATH permet d'utiliser un Chromium déjà présent au lieu d'en télécharger un.
if [ -z "${NODE_PATH:-}" ] && [ ! -d node_modules/playwright ]; then
  export NODE_PATH="$(npm root -g 2>/dev/null || true)"
fi
PORT=${PORT:-8899}
BASE="http://127.0.0.1:${PORT}"

# Serveur statique : le service worker et le manifest ne fonctionnent pas en file://
if ! curl -sSf -o /dev/null "${BASE}/index.html" 2>/dev/null; then
  echo "→ Démarrage du serveur sur le port ${PORT}"
  npx --yes http-server -p "${PORT}" -s . >/dev/null 2>&1 &
  SERVER_PID=$!
  trap 'kill ${SERVER_PID} 2>/dev/null || true' EXIT
  for _ in $(seq 1 20); do
    curl -sSf -o /dev/null "${BASE}/index.html" 2>/dev/null && break
    sleep 0.5
  done
fi

FAILED=0
for suite in scoring ui pwa; do
  echo ""
  echo "═══════════ ${suite} ═══════════"
  if [ "$suite" = "pwa" ]; then TARGET="${BASE}"; else TARGET="${BASE}/index.html"; fi
  node "tests/${suite}.mjs" "${TARGET}" || FAILED=1
done

echo ""
[ "${FAILED}" -eq 0 ] && echo "✅ Toutes les suites passent." || echo "❌ Au moins une suite a échoué."
exit "${FAILED}"
