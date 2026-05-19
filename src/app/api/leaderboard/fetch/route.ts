import { NextResponse } from "next/server";
import { chatJSON, LLMMessage } from "@/lib/services/ai-service";
import { replaceLeaderboard } from "@/lib/services/db-service";
import { fetchURL } from "@/lib/services/fetch-service";

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
    scoreField: "HLE",
    description: "基于HLE、ARC-AGI-2等多维评测的综合排名",
  },
  "datalearner-code": {
    name: "编程能力排行榜",
    metric: "SWE-bench 分数",
    scoreField: "SWE-bench Verified",
    description: "基于SWE-bench Verified等编程基准评测排名",
  },
  "datalearner-agent": {
    name: "Agent 能力排行榜",
    metric: "τ²-Bench 分数",
    scoreField: "τ²-Bench",
    description: "基于τ²-Bench等Agent基准评测排名",
  },
};

// 数据源到数据库source/category的映射
const SOURCE_DB_MAP: Record<string, { dbSource: string; dbCategory: string }> = {
  "datalearner-comprehensive": { dbSource: "datalearner", dbCategory: "comprehensive" },
  "datalearner-code": { dbSource: "datalearner", dbCategory: "code" },
  "datalearner-agent": { dbSource: "datalearner", dbCategory: "agent" },
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
    // Step 1: 从 DataLearner 主页面抓取
    const fetchResult = await fetchURL("https://www.datalearner.com/leaderboards");

    if (!fetchResult.success || !fetchResult.content) {
      return NextResponse.json(
        {
          success: false,
          error: `无法获取 DataLearner 页面: ${fetchResult.error || "内容为空"}`,
        },
        { status: 500 }
      );
    }

    const pageContent = fetchResult.content;

    // Step 2: 用 LLM 从页面内容中提取排行榜数据
    const systemPrompt = `你是AI大模型排行榜数据提取专家。以下是从 DataLearner.com 网站抓取的排行榜页面内容。

请从中提取"${config.name}"的排行榜数据，使用"${config.scoreField}"作为评分指标。

规则：
1. 提取前10名的模型（按${config.scoreField}分数从高到低排序）
2. 每条字段:
   - model_name: 模型全称含版本号
   - developer: 开发公司/组织（中文或英文原名）
   - parameters: 参数量（如"1.8T"、"685B MoE"、"未知"），页面无此信息填"未知"
   - score: ${config.scoreField}评分字符串（如"64.70"、"58.70"）
   - rank_position: 排名数字（1-10）
   - rank_change: 与上次排名变化（正数=上升，负数=下降，无法判断填0）
   - description: 简短特点描述（8字内）
3. 严格按照页面数据提取，不要编造模型和分数
4. 如果某个模型缺少${config.scoreField}分数，跳过该模型
5. 只返回有${config.scoreField}分数的模型

返回紧凑JSON：
{"entries":[...]}`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `请从以下页面内容中提取${config.name}的排行榜数据，只返回有${config.scoreField}分数的模型：\n\n${pageContent.slice(0, 25000)}`,
      },
    ];

    const result = await chatJSON<{ entries: LeaderboardEntry[] }>(messages, {
      temperature: 0.05,
    });

    const entries: LeaderboardEntry[] = result.entries || [];
    if (entries.length === 0) {
      return NextResponse.json(
        { success: false, error: "未能从页面提取排行榜数据" },
        { status: 404 }
      );
    }

    // Step 3: 写入数据库
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
