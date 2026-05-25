#!/bin/bash
set -Eeuo pipefail

PORT="${PORT:-5000}"

echo "Installing dependencies..."
pnpm install

echo "Starting dev server on port ${PORT}..."
PORT="$PORT" pnpm run dev
