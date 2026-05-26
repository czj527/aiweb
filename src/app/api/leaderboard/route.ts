import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/services/db-service";

/**
 * GET /api/leaderboard
 * 获取大模型排行榜
 *
 * 查询参数：
 * - source: 数据来源，默认"datalearner-comprehensive"
 */

// 数据来源配置
export const LEADERBOARD_SOURCES: Record<
  string,
  {
    label: string;
    url: string;
    description: string;
    metric: string;
    dbSource: string;
    dbCategory: string;
  }
> = {
  "datalearner-comprehensive": {
    label: "综合排行榜",
    url: "https://www.datalearner.com/leaderboards",
    description: "基于HLE、ARC-AGI-2等多维评测的综合排名",
    metric: "HLE 分数",
    dbSource: "datalearner",
    dbCategory: "comprehensive",
  },
  "datalearner-code": {
    label: "编程能力排行榜",
    url: "https://www.datalearner.com/leaderboards/category/code",
    description: "基于SWE-bench Verified等编程基准评测排名",
    metric: "SWE-bench 分数",
    dbSource: "datalearner",
    dbCategory: "code",
  },
  "datalearner-agent": {
    label: "Agent 能力排行榜",
    url: "https://www.datalearner.com/leaderboards/category/agent",
    description: "基于τ²-Bench等Agent基准评测排名",
    metric: "τ²-Bench 分数",
    dbSource: "datalearner",
    dbCategory: "agent",
  },
};

// 获取所有来源 key 列表
export function getLeaderboardSourceKeys(): string[] {
  return Object.keys(LEADERBOARD_SOURCES);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sourceKey = searchParams.get("source") || "datalearner-comprehensive";

  const sourceConfig = LEADERBOARD_SOURCES[sourceKey];
  if (!sourceConfig) {
    return NextResponse.json(
      {
        error: `未知的数据来源: ${sourceKey}`,
        availableSources: Object.keys(LEADERBOARD_SOURCES),
      },
      { status: 400 }
    );
  }

  try {
    const rows = await getLeaderboard(
      sourceConfig.dbSource,
      sourceConfig.dbCategory
    );

    const rankings = rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      modelName: r.model_name as string,
      developer: r.developer as string,
      parameters: r.parameters as string,
      score: r.score as number,
      rankPosition: r.rank_position as number,
      rankChange: r.rank_change as number,
      description: r.description as string,
      updatedAt: r.updated_at as string,
    }));

    return NextResponse.json({
      success: true,
      data: {
        source: sourceKey,
        sourceLabel: sourceConfig.label,
        sourceUrl: sourceConfig.url,
        sourceDescription: sourceConfig.description,
        metric: sourceConfig.metric,
        rankings,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "获取排行榜数据失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
