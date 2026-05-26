#!/bin/bash
# 启动 cron 定时服务
# 在项目 dev 环境启动后执行

/etc/init.d/cron start 2>/dev/null
echo "[$(date)] Cron service started" >> /app/work/logs/bypass/cron.log
