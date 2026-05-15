import { NextRequest, NextResponse } from "next/server";
import { getPendingNews, getPendingNewsCount } from "@/lib/services/db-service";

export async function GET(request: NextRequest) {
  try {
    const [news, count] = await Promise.all([
      getPendingNews(),
      getPendingNewsCount(),
    ]);
    return NextResponse.json({ news, count });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
