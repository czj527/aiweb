#!/bin/bash
# AI Pulse 定时任务脚本
# 基于橘鸦RSS的自动化方案

BASE_URL="${SITE_URL:-http://localhost:5000}"
LOG_DIR="${CRON_LOG_DIR:-./logs}"
DATE=$(date +"%Y-%m-%d %H:%M:%S")

mkdir -p "$LOG_DIR"

log() {
  echo "[$DATE] $1" >> "$LOG_DIR/cron.log"
  echo "[$DATE] $1"
}

# 每日同步（采集RSS + 生成日报）
daily_sync() {
  log "cron: 开始每日同步..."
  RESPONSE=$(curl -s -X POST -H 'Content-Type: application/json' --max-time 600 "$BASE_URL/api/cron/daily-sync" 2>&1)
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  log "cron: 每日同步完成 - $RESPONSE"
}

# 仅采集RSS（不生成日报）
collect_rss() {
  log "cron: 开始采集橘鸦RSS..."
  RESPONSE=$(curl -s -X POST -H 'Content-Type: application/json' --max-time 120 "$BASE_URL/api/rss/collect" 2>&1)
  log "cron: RSS采集完成 - $RESPONSE"
}

# 生成日报（使用已有数据）
generate_daily() {
  log "cron: 开始生成日报..."
  RESPONSE=$(curl -s -X POST -H 'Content-Type: application/json' --max-time 600 "$BASE_URL/api/daily/generate" 2>&1)
  log "cron: 日报生成完成 - $RESPONSE"
}

# 生成周报
generate_weekly() {
  log "cron: 开始生成周报..."
  RESPONSE=$(curl -s -X POST -H 'Content-Type: application/json' --max-time 600 "$BASE_URL/api/weekly/generate" 2>&1)
  log "cron: 周报生成完成 - $RESPONSE"
}

# 更新排行榜（单个源）
fetch_leaderboard() {
  local src=$1
  log "cron: 开始更新排行榜 $src..."
  RESPONSE=$(curl -s -X POST -H 'Content-Type: application/json' --max-time 120 "$BASE_URL/api/leaderboard/fetch" -d "{\"source\":\"$src\"}" 2>&1)
  log "cron: 排行榜 $src 更新完成 - $RESPONSE"
}

# 更新所有排行榜
update_leaderboard() {
  log "cron: 开始更新所有排行榜..."
  local sources=("datalearner-comprehensive" "datalearner-code" "datalearner-agent")
  for src in "${sources[@]}"; do
    fetch_leaderboard "$src"
    sleep 3  # 避免请求过快
  done
  log "cron: 排行榜全部更新完成"
}

# 根据参数执行
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
  leaderboard-one)
    if [ -z "$2" ]; then
      echo "Usage: $0 leaderboard-one <source>"
      echo "Sources: datalearner-aa, datalearner-lmarena"
      exit 1
    fi
    fetch_leaderboard "$2"
    ;;
  all)
    daily_sync
    update_leaderboard
    ;;
  *)
    echo "Usage: $0 {daily|collect|daily-only|weekly|leaderboard|leaderboard-one|all}"
    echo ""
    echo "Commands:"
    echo "  daily             - 每日同步（采集RSS + 生成日报）"
    echo "  collect           - 仅采集橘鸦RSS"
    echo "  daily-only        - 仅生成日报（使用已有数据）"
    echo "  weekly            - 生成周报"
    echo "  leaderboard       - 更新所有排行榜"
    echo "  leaderboard-one   - 更新单个排行榜（需要指定源）"
    echo "  all               - 每日同步 + 更新排行榜"
    exit 1
    ;;
esac
