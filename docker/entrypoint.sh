#!/bin/sh
set -e

echo "[entrypoint] applying database migrations…"
node ./node_modules/drizzle-kit/bin.cjs migrate --config=drizzle.config.ts

echo "[entrypoint] starting application…"
exec "$@"
