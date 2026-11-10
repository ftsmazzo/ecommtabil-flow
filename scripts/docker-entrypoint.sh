#!/bin/sh
set -e
if [ "${SKIP_DB_INIT:-}" != "1" ]; then
  echo "Inicializando banco (se necessário)..."
  node scripts/init-db.mjs || echo "Aviso: init-db falhou (app sobe mesmo assim)."
fi
exec node server.js
