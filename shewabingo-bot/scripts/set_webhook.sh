#!/bin/sh
set -e
if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$WEBHOOK_BASE_URL" ]; then
  echo "Set TELEGRAM_BOT_TOKEN and WEBHOOK_BASE_URL"; exit 1; fi
curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -F "url=$WEBHOOK_BASE_URL/webhook/$TELEGRAM_BOT_TOKEN"
echo
