import { NextRequest, NextResponse } from "next/server";
import { reviewNews } from "@/lib/services/db-service";

export async function POST(request: NextRequest) {
  try {
    const { newsId, action, reason } = await request.json();
    if (!newsId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Action must be approve or reject" }, { status: 400 });
    }
    await reviewNews(newsId, action, reason);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
