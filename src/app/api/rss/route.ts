import { NextResponse } from "next/server";
import { getLatestDailyReport } from "@/lib/services/db-service";

interface NewsRow {
  title?: string;
  source_url?: string;
  summary?: string;
  category?: string;
  published_at?: string;
}

/**
 * GET /api/rss
 * 生成 RSS 2.0 Feed
 */
export async function GET() {
  try {
    const report = await getLatestDailyReport();

    const siteUrl = process.env.SITE_URL || process.env.COZE_PROJECT_DOMAIN_DEFAULT || "http://localhost:5000";

    const reportDate = report
      ? (report as Record<string, unknown>).report_date as string
      : null;

    const buildDate = reportDate
      ? new Date(reportDate).toUTCString()
      : new Date().toUTCString();

    let items = "";
    if (report && report.news) {
      const newsList = report.news as NewsRow[];
      items = newsList
        .slice(0, 20)
        .map(
          (news) => `
    <item>
      <title><![CDATA[${news.title || ""}]]></title>
      <link>${news.source_url || ""}</link>
      <description><![CDATA[${news.summary || ""}]]></description>
      <category>${news.category || ""}</category>
      <pubDate>${news.published_at ? new Date(news.published_at).toUTCString() : ""}</pubDate>
      <guid isPermaLink="true">${news.source_url || ""}</guid>
    </item>`
        )
        .join("");
    }

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI Pulse - AI日报</title>
    <link>${siteUrl}</link>
    <description>全自动AI资讯日报，每日精选AI领域重要动态</description>
    <language>zh-CN</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${siteUrl}/api/rss" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

    return new NextResponse(rss, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[RSS GET] Error:", errorMessage);
    return NextResponse.json(
      { error: "生成RSS失败", detail: errorMessage },
      { status: 500 }
    );
  }
}
