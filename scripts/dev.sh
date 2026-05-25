#!/bin/bash
set -Eeuo pipefail

PORT="${PORT:-5000}"

echo "Installing dependencies..."
pnpm install

echo "Building the Next.js project..."
pnpm next build

echo "Build completed successfully!"
