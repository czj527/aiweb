#!/bin/sh
echo "=== AI Pulse Start Debug ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "HOSTNAME: $HOSTNAME"
echo "SUPABASE_URL: ${SUPABASE_URL:-NOT_SET}"
echo "SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:+SET}"
echo "SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:+SET}"
echo "CRON_SECRET: ${CRON_SECRET:+SET}"
echo "DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:+SET}"
echo "ADMIN_PASSWORD: ${ADMIN_PASSWORD:+SET}"
echo "=== Starting Server ==="
exec node server.js
