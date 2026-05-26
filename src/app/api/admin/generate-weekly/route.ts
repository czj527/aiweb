import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import {
  getWeekRange,
  getWeeklyDigestByWeek,
  createWeeklyDigest,
  createGenerationLog,
  updateGenerationLog,
} from '@/lib/services/db-service';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// POST /api/admin/generate-weekly — AI生成本周周报
export async function POST(request: NextRequest) {
  const cookie = request.cookies.get('admin_token')?.value;
  if (!verifyAdminToken(cookie || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
  const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

  if (!DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: 'DeepSeek API key not configured' }, { status: 500 });
  }

  const { weekStart, weekEnd } = getWeekRange();
  const logId = await createGenerationLog('weekly', weekStart);

  try {
    // 检查本周周报是否已存在
    const existing = await getWeeklyDigestByWeek(weekStart);
    if (existing) {
      await updateGenerationLog(logId, { status: 'skipped', message: '本周周报已存在' });
      return NextResponse.json({
        success: false,
        error: `本周周报已存在 (${weekStart} ~ ${weekEnd})`,
        existingId: existing.id,
      });
    }

    // 获取本周新闻数据
    const client = getSupabaseClient();
    const { data: newsItems, error: newsError } = await client
      .from('news_items')
      .select('title, summary, category, importance_score, published_at')
      .gte('published_at', `${weekStart}T00:00:00+08:00`)
      .lte('published_at', `${weekEnd}T23:59:59+08:00`)
      .order('importance_score', { ascending: false, nullsFirst: false });

    if (newsError) throw new Error(`查询本周新闻失败: ${newsError.message}`);
    if (!newsItems || newsItems.length === 0) {
      await updateGenerationLog(logId, { status: 'skipped', message: '本周没有新闻数据' });
      return NextResponse.json({ success: false, error: '本周没有新闻数据' });
    }

    // 统计分类
    const categoryCount: Record<string, number> = {};
    for (const item of newsItems) {
      const cat = item.category || '未分类';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    }

    // 构建新闻摘要供LLM分析
    const newsDigest = newsItems
      .slice(0, 40)
      .map((n: { title: string; summary?: string; category?: string; importance_score?: number }, i: number) =>
        `${i + 1}. [${n.category || '未分类'}] ${n.title}${n.summary ? ` — ${n.summary.slice(0, 100)}` : ''}`
      )
      .join('\n');

    // 调用DeepSeek生成周报
    const prompt = `你是AI Pulse网站的周报撰写AI。请根据以下本周AI行业新闻，撰写一份周报。

本周时间范围：${weekStart} ~ ${weekEnd}
新闻总数：${newsItems.length}条
分类分布：${Object.entries(categoryCount).map(([k, v]) => `${k}(${v}条)`).join('、')}

本周新闻列表：
${newsDigest}

请输出JSON格式（不要用markdown代码块包裹）：
{
  "title": "周报标题，如「AI Pulse 周报 #N - 一句话总结本周」",
  "summary": "100字以内的本周概要",
  "hotTopics": ["热点话题1", "热点话题2", "热点话题3"],
  "content": "周报正文，Markdown格式，包含：\n- ## 本周概要\n- ## 重要资讯（按分类分组，每条标题+一句话点评）\n- ## 本周趋势\n- ## 下周展望"
}`;

    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    // 解析JSON（容错处理）
    let parsed: {
      title?: string;
      summary?: string;
      hotTopics?: string[];
      content?: string;
    };

    try {
      // 尝试直接解析
      parsed = JSON.parse(rawContent);
    } catch {
      // 尝试提取JSON块
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          // JSON解析失败，用原始内容
          parsed = {
            title: `AI Pulse 周报 - ${weekStart} ~ ${weekEnd}`,
            summary: rawContent.slice(0, 200),
            hotTopics: [],
            content: rawContent,
          };
        }
      } else {
        parsed = {
          title: `AI Pulse 周报 - ${weekStart} ~ ${weekEnd}`,
          summary: rawContent.slice(0, 200),
          hotTopics: [],
          content: rawContent,
        };
      }
    }

    // 创建周报
    const digestId = await createWeeklyDigest({
      weekStart,
      weekEnd,
      title: parsed.title || `AI Pulse 周报 - ${weekStart} ~ ${weekEnd}`,
      summary: parsed.summary || '',
      hotTopics: parsed.hotTopics || [],
      newsCount: newsItems.length,
      categories: Object.keys(categoryCount),
      content: parsed.content || '',
    });

    await updateGenerationLog(logId, {
      status: 'completed',
      message: `周报已生成，${newsItems.length}条新闻`,
    });

    return NextResponse.json({
      success: true,
      message: `周报已生成：${weekStart} ~ ${weekEnd}，共${newsItems.length}条新闻`,
      digestId,
      title: parsed.title,
    });
  } catch (error) {
    console.error('[generate-weekly] Error:', error);
    await updateGenerationLog(logId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
