#!/bin/bash
# AI Pulse 定时任务脚本
# 基于橘鸦RSS的自动化方案

BASE_URL="${SITE_URL:-http://localhost:5000}"
CRON_SECRET="${CRON_SECRET:-}"
LOG_DIR="${CRON_LOG_DIR:-./logs}"
DATE=$(date +"%Y-%m-%d %H:%M:%S")

mkdir -p "$LOG_DIR"

log() {
  echo "[$DATE] $1" >> "$LOG_DIR/cron.log"
  echo "[$DATE] $1"
}

call_api() {
  local url="$1"
  local max_time="${2:-600}"
  if [ -n "$CRON_SECRET" ]; then
    curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" --max-time "$max_time" "$url" 2>&1
  else
    curl -s -X POST --max-time "$max_time" "$url" 2>&1
  fi
}

daily_sync() {
  log "cron: 开始每日同步..."
  RESPONSE=$(call_api "$BASE_URL/api/cron/daily-sync" 600)
  log "cron: 每日同步完成 - $RESPONSE"
}

collect_rss() {
  log "cron: 开始采集橘鸦RSS..."
  RESPONSE=$(call_api "$BASE_URL/api/cron/collect" 120)
  log "cron: RSS采集完成 - $RESPONSE"
}

generate_daily() {
  log "cron: 开始生成日报..."
  RESPONSE=$(call_api "$BASE_URL/api/cron/daily-sync" 600)
  log "cron: 日报生成完成 - $RESPONSE"
}

generate_weekly() {
  log "cron: 开始生成周报..."
  RESPONSE=$(call_api "$BASE_URL/api/admin/generate-weekly" 600)
  log "cron: 周报生成完成 - $RESPONSE"
}

fetch_leaderboard() {
  local src=$1
  log "cron: 开始更新排行榜 $src..."
  RESPONSE=$(call_api "$BASE_URL/api/cron/daily-sync" 120)
  log "cron: 排行榜 $src 更新完成 - $RESPONSE"
}

update_leaderboard() {
  log "cron: 开始更新所有排行榜..."
  RESPONSE=$(call_api "$BASE_URL/api/admin/sync" 120)
  log "cron: 排行榜全部更新完成 - $RESPONSE"
}

case "$1" in
  daily)
    daily_sync
    ;;
  collect)
    collect_rss
    ;;
  daily-only)
    generate_daily
    ;;
  weekly)
    generate_weekly
    ;;
  leaderboard)
    update_leaderboard
    ;;
  all)
    daily_sync
    update_leaderboard
    ;;
  *)
    echo "Usage: $0 {daily|collect|daily-only|weekly|leaderboard|all}"
    echo ""
    echo "Commands:"
    echo "  daily             - 每日同步（采集RSS + 生成日报）"
    echo "  collect           - 仅采集橘鸦RSS"
    echo "  daily-only        - 仅生成日报（使用已有数据）"
    echo "  weekly            - 生成周报"
    echo "  leaderboard       - 更新所有排行榜"
    echo "  all               - 每日同步 + 更新排行榜"
    exit 1
    ;;
esac
