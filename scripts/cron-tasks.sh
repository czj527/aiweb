#!/bin/bash
# AI Pulse 定时任务脚本
# 每天 07:00 生成日报 + 更新排行榜
# 每周一 07:30 生成周报

BASE_URL="${SITE_URL:-http://localhost:5000}"
LOG_DIR="${CRON_LOG_DIR:-./logs}"
DATE=$(date +"%Y-%m-%d %H:%M:%S")

mkdir -p "$LOG_DIR"

log() {
  echo "[$DATE] $1" >> "$LOG_DIR/cron.log"
  echo "[$DATE] $1"
}

# 收集资讯（搜索+入库，不生成日报）
collect_news() {
  log "cron: 开始收集资讯..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' --max-time 600 "$BASE_URL/api/news/collect" 2>&1)
  log "cron: 资讯收集完成 (HTTP $HTTP_CODE)"
}

# 生成日报
generate_daily() {
  log "cron: 开始生成日报..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' --max-time 600 "$BASE_URL/api/daily/generate" 2>&1)
  log "cron: 日报生成完成 (HTTP $HTTP_CODE)"
}

# 生成周报
generate_weekly() {
  log "cron: 开始生成周报..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' --max-time 600 "$BASE_URL/api/weekly/generate" 2>&1)
  log "cron: 周报生成完成 (HTTP $HTTP_CODE)"
}

# 更新排行榜
update_leaderboard() {
  log "cron: 开始更新排行榜..."
  local sources=("datalearner-aa" "datalearner-lmarena" "datalearner-comprehensive" "datalearner-math" "datalearner-code" "datalearner-agent")
  for src in "${sources[@]}"; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' --max-time 120 "$BASE_URL/api/leaderboard/fetch" -d "{\"source\":\"$src\"}" 2>&1)
    log "cron: 排行榜 $src 更新完成 (HTTP $HTTP_CODE)"
  done
  log "cron: 排行榜全部更新完成"
}

# 根据参数执行
case "$1" in
  daily)
    collect_news
    generate_daily
    ;;
  weekly)
    generate_weekly
    ;;
  leaderboard)
    update_leaderboard
    ;;
  all)
    collect_news
    generate_daily
    update_leaderboard
    ;;
  collect)
    collect_news
    ;;
  *)
    echo "Usage: $0 {daily|weekly|leaderboard|collect|all}"
    exit 1
    ;;
esac
