import { NextResponse } from "next/server";
import { replaceLeaderboard } from "@/lib/services/db-service";

interface LeaderboardEntry {
  model_name: string;
  developer: string;
  parameters: string;
  score: string;
  rank_position: number;
  rank_change: number;
  description: string;
}

// 排行榜配置
const SOURCE_CONFIG: Record<
  string,
  {
    name: string;
    metric: string;
    scoreField: string;
    description: string;
  }
> = {
  "datalearner-comprehensive": {
    name: "综合排行榜",
    metric: "HLE 分数",
    scoreField: "hle",
    description: "基于HLE、ARC-AGI-2等多维评测的综合排名",
  },
  "datalearner-code": {
    name: "编程能力排行榜",
    metric: "SWE-bench 分数",
    scoreField: "swe_bench_verified",
    description: "基于SWE-bench Verified等编程基准评测排名",
  },
  "datalearner-agent": {
    name: "Agent 能力排行榜",
    metric: "τ²-Bench 分数",
    scoreField: "tau2_bench",
    description: "基于τ²-Bench等Agent基准评测排名",
  },
};

// 数据源到数据库source/category的映射
const SOURCE_DB_MAP: Record<string, { dbSource: string; dbCategory: string }> = {
  "datalearner-comprehensive": { dbSource: "datalearner", dbCategory: "comprehensive" },
  "datalearner-code": { dbSource: "datalearner", dbCategory: "code" },
  "datalearner-agent": { dbSource: "datalearner", dbCategory: "agent" },
};

// 预置的排行榜数据（定期手动更新）
const LEADERBOARD_DATA: Record<string, LeaderboardEntry[]> = {
  "datalearner-comprehensive": [
    { model_name: "Claude Mythos Preview", developer: "Anthropic", parameters: "未知", score: "64.70", rank_position: 1, rank_change: 0, description: "SOTA" },
    { model_name: "GPT-5.4 Pro", developer: "OpenAI", parameters: "未知", score: "58.70", rank_position: 2, rank_change: 0, description: "推理强" },
    { model_name: "Muse Spark", developer: "未知", parameters: "未知", score: "58.00", rank_position: 3, rank_change: 0, description: "新模型" },
    { model_name: "GPT-5.5 Pro", developer: "OpenAI", parameters: "未知", score: "57.20", rank_position: 4, rank_change: 0, description: "旗舰" },
    { model_name: "Opus 4.7", developer: "Anthropic", parameters: "未知", score: "54.70", rank_position: 5, rank_change: 0, description: "全能" },
    { model_name: "Kimi K2.6", developer: "Moonshot", parameters: "未知", score: "54.00", rank_position: 6, rank_change: 0, description: "最佳开源" },
    { model_name: "Claude Opus 4.6", developer: "Anthropic", parameters: "未知", score: "53.00", rank_position: 7, rank_change: 0, description: "稳定" },
    { model_name: "GLM 5.1", developer: "智谱AI", parameters: "未知", score: "52.30", rank_position: 8, rank_change: 0, description: "最佳国产" },
    { model_name: "GPT-5.5", developer: "OpenAI", parameters: "未知", score: "52.20", rank_position: 9, rank_change: 0, description: "通用" },
    { model_name: "GPT-5.4", developer: "OpenAI", parameters: "未知", score: "52.10", rank_position: 10, rank_change: 0, description: "均衡" },
  ],
  "datalearner-code": [
    { model_name: "Claude Mythos Preview", developer: "Anthropic", parameters: "未知", score: "93.90", rank_position: 1, rank_change: 0, description: "编程SOTA" },
    { model_name: "Claude Sonnet 4.5", developer: "Anthropic", parameters: "未知", score: "82.00", rank_position: 2, rank_change: 0, description: "高效" },
    { model_name: "Opus 4.5", developer: "Anthropic", parameters: "未知", score: "80.90", rank_position: 3, rank_change: 0, description: "稳定" },
    { model_name: "DeepSeek-V4-Pro", developer: "DeepSeek", parameters: "未知", score: "80.60", rank_position: 4, rank_change: 0, description: "开源强" },
    { model_name: "Gemini 3.1 Pro Preview", developer: "Google", parameters: "未知", score: "80.60", rank_position: 5, rank_change: 0, description: "多模态" },
    { model_name: "Claude Opus 4.6", developer: "Anthropic", parameters: "未知", score: "80.84", rank_position: 6, rank_change: 0, description: "全能" },
    { model_name: "Claude Sonnet 4.6", developer: "Anthropic", parameters: "未知", score: "79.60", rank_position: 7, rank_change: 0, description: "新版" },
    { model_name: "GPT-5.2", developer: "OpenAI", parameters: "未知", score: "80.00", rank_position: 8, rank_change: 0, description: "均衡" },
    { model_name: "DeepSeek-V4-Flash", developer: "DeepSeek", parameters: "未知", score: "79.00", rank_position: 9, rank_change: 0, description: "快速" },
    { model_name: "Qwen 3.6 Plus Preview", developer: "阿里云", parameters: "未知", score: "78.80", rank_position: 10, rank_change: 0, description: "国产" },
  ],
  "datalearner-agent": [
    { model_name: "Claude Opus 4.6", developer: "Anthropic", parameters: "未知", score: "91.89", rank_position: 1, rank_change: 0, description: "Agent SOTA" },
    { model_name: "Gemini 3.1 Pro Preview", developer: "Google", parameters: "未知", score: "90.80", rank_position: 2, rank_change: 0, description: "多模态" },
    { model_name: "Gemini 3.0 Flash", developer: "Google", parameters: "未知", score: "90.20", rank_position: 3, rank_change: 0, description: "快速" },
    { model_name: "GLM-5", developer: "智谱AI", parameters: "未知", score: "89.70", rank_position: 4, rank_change: 0, description: "国产强" },
    { model_name: "GLM-4.7", developer: "智谱AI", parameters: "未知", score: "87.40", rank_position: 5, rank_change: 0, description: "稳定" },
    { model_name: "Qwen3.5-397B-A17B", developer: "阿里云", parameters: "未知", score: "86.70", rank_position: 6, rank_change: 0, description: "MoE" },
    { model_name: "Gemini 3.0 Pro", developer: "Google", parameters: "未知", score: "85.40", rank_position: 7, rank_change: 0, description: "通用" },
    { model_name: "Claude Sonnet 4.5", developer: "Anthropic", parameters: "未知", score: "84.70", rank_position: 8, rank_change: 0, description: "高效" },
    { model_name: "GPT-5.2", developer: "OpenAI", parameters: "未知", score: "82.00", rank_position: 9, rank_change: 0, description: "均衡" },
    { model_name: "Opus 4.5", developer: "Anthropic", parameters: "未知", score: "81.99", rank_position: 10, rank_change: 0, description: "旧版" },
  ],
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const source = body.source || "datalearner-comprehensive";

  const config = SOURCE_CONFIG[source];
  if (!config) {
    return NextResponse.json(
      { error: `不支持的数据源: ${source}` },
      { status: 400 }
    );
  }

  const dbMapping = SOURCE_DB_MAP[source];
  console.log(`[Leaderboard Fetch] 开始抓取 ${source} (${config.scoreField})`);

  try {
    // 使用预置数据
    const entries = LEADERBOARD_DATA[source];
    if (!entries || entries.length === 0) {
      return NextResponse.json(
        { success: false, error: `没有 ${source} 的预置数据` },
        { status: 404 }
      );
    }

    // 写入数据库
    await replaceLeaderboard(dbMapping.dbSource, dbMapping.dbCategory, entries);

    console.log(
      `[Leaderboard Fetch] 完成 ${source}: ${entries.length} 条`
    );
    return NextResponse.json({
      success: true,
      data: { source, count: entries.length },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Leaderboard Fetch] 失败:`, msg);
    return NextResponse.json(
      { success: false, error: `抓取失败: ${msg}` },
      { status: 500 }
    );
  }
}
