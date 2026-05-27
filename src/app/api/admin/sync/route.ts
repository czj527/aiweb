import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin-auth";
import {
  syncJuyaCheck,
  syncDailyGenerate,
  syncLeaderboard,
} from "@/lib/services/juya-sync-service";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action;

  try {
    let result;

    switch (action) {
      case "juya-check":
        result = await syncJuyaCheck();
        break;
      case "daily":
        result = await syncDailyGenerate();
        break;
      case "leaderboard":
        result = await syncLeaderboard();
        break;
      case "weekly":
        return NextResponse.redirect(new URL("/api/admin/generate-weekly", request.url));
      case "cleanup":
        return NextResponse.redirect(new URL("/api/admin/cleanup", request.url));
      default:
        return NextResponse.json(
          { error: "未知操作，支持: juya-check, daily, leaderboard, weekly, cleanup" },
          { status: 400 }
        );
    }

    const statusCode = result.success ? 200 : 500;
    return NextResponse.json(result, { status: statusCode });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error(`[AdminSync] ${action} failed:`, errorMessage);
    return NextResponse.json(
      { error: "操作失败", detail: errorMessage },
      { status: 500 }
    );
  }
}
