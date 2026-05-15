import * as cheerio from "cheerio";

// Fetch URL 服务 - 获取网页内容用于深度摘要

export interface FetchResult {
  title: string;
  content: string;
  url: string;
  success: boolean;
  error?: string;
}

/** 浏览器 User-Agent，避免被网站屏蔽 */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/**
 * 获取单个 URL 的文本内容
 * 使用标准 fetch + cheerio 解析
 */
export async function fetchURL(url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(15000), // 15秒超时
    });

    if (!response.ok) {
      return {
        title: "",
        content: "",
        url,
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();

    const $ = cheerio.load(html);

    // 移除无用元素
    $("script, style, nav, footer, header, aside, iframe, noscript").remove();

    // 提取标题
    const title =
      $('meta[property="og:title"]').attr("content") ||
      $("title").text() ||
      $('h1').first().text() ||
      "";

    // 提取正文（优先从 article/main 元素提取）
    const content =
      $("article").text() ||
      $("main").text() ||
      $(".post-content").text() ||
      $(".entry-content").text() ||
      $(".content").text() ||
      $("body").text() ||
      "";

    // 清理空白
    const cleanContent = content
      .replace(/\s+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return {
      title: title.trim(),
      content: cleanContent,
      url,
      success: true,
    };
  } catch (e) {
    return {
      title: "",
      content: "",
      url,
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/**
 * 批量获取多个 URL 的内容（带并发控制）
 */
export async function fetchMultipleURLs(
  urls: string[],
  options: { concurrency?: number; maxLength?: number } = {}
): Promise<FetchResult[]> {
  const { concurrency = 5, maxLength = 5000 } = options;

  const results: FetchResult[] = [];

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((url) => fetchURL(url))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        // 截断过长内容
        if (result.value.success && result.value.content.length > maxLength) {
          result.value.content =
            result.value.content.slice(0, maxLength) + "...";
        }
        results.push(result.value);
      } else {
        results.push({
          title: "",
          content: "",
          url: "",
          success: false,
          error: result.reason?.message || "Unknown error",
        });
      }
    }
  }

  return results;
}
