#!/bin/bash
set -e
cd /home/clawdbot/paperclip

echo "[start-with-build] Installing dependencies..."
pnpm install

echo "[start-with-build] Building UI..."
cd ui && pnpm build && cd ..

echo "[start-with-build] Starting server..."
exec pnpm dev
