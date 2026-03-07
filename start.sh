#!/bin/bash
# Start Paperclip server with Claude env vars stripped
# Safe to run from inside Claude Code sessions

cd /home/clawdbot/paperclip

env -u CLAUDECODE -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS -u CLAUDE_CODE_ENTRYPOINT \
  BETTER_AUTH_SECRET=01f5f8bf4cfb187bdfb583a7be1bf534ca4000abbc7bd5942156ff0033fd888d \
  PAPERCLIP_AGENT_JWT_SECRET=d823358ccb547be89472ae52d95da5f9ecfc0b279280cb2ebcddfcc2e8a7a2e3 \
  pnpm dev > /tmp/paperclip.log 2>&1 &

echo "Paperclip starting (PID: $!)..."
sleep 10

if curl -sf http://localhost:3100/api/health | jq -r .status 2>/dev/null | grep -q ok; then
  echo "Paperclip is healthy."
else
  echo "Paperclip failed to start. Check /tmp/paperclip.log"
  exit 1
fi
