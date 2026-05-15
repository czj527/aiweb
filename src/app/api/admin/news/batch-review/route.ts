import { NextRequest, NextResponse } from "next/server";
import { batchReviewNews } from "@/lib/services/db-service";

export async function POST(request: NextRequest) {
  try {
    const { newsIds, action, reason } = await request.json();
    if (!newsIds?.length || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Action must be approve or reject" }, { status: 400 });
    }
    await batchReviewNews(newsIds, action, reason);
    return NextResponse.json({ success: true, count: newsIds.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
