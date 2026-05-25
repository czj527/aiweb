#!/bin/bash
set -Eeuo pipefail

PORT="${PORT:-5000}"

echo "Starting production server on port ${PORT}..."
PORT="$PORT" pnpm next start -p "$PORT"
