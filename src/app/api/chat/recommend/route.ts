import { NextResponse } from 'next/server';

// GET /api/chat/recommend — 一句话推荐
// 从今日新闻中取热度最高的一条，用DeepSeek生成个性化推荐语
// 缓存1小时避免频繁调API

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 内存缓存
let cachedRecommend: { text: string; link: string; timestamp: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1小时

// 默认推荐（API不可用时）
const FALLBACK_RECOMMENDS = [
  { text: '来看看今天的AI资讯吧 📰', link: '/daily' },
  { text: '大模型排行榜已更新 🏆', link: '/leaderboard' },
  { text: 'AI世界变化太快，别掉队 🚀', link: '/' },
];

export async function GET() {
  // 缓存命中
  if (cachedRecommend && Date.now() - cachedRecommend.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedRecommend);
  }

  try {
    // 1. 从Supabase获取今日最热新闻
    const topNews = await fetchTopNews();

    if (!topNews) {
      return NextResponse.json(pickFallback());
    }

    // 2. 如果没有API key，用模板生成推荐
    if (!DEEPSEEK_API_KEY) {
      const result = {
        text: `${topNews.title} 🔥`,
        link: '/daily',
        timestamp: Date.now(),
      };
      cachedRecommend = result;
      return NextResponse.json(result);
    }

    // 3. 用DeepSeek生成个性化推荐语
    const prompt = `请用一句话（不超过30字，含emoji）推荐这条AI新闻，要有个性、会玩梗，不要用引号包裹：
标题：${topNews.title}
${topNews.summary ? `摘要：${topNews.summary}` : ''}

示例风格：
- "DeepSeek宣布永久降价，梁圣的恩情还不完😭"
- "Claude Opus 4.7来了，Anthropic终于不再挤牙膏"
- "Llama 4开源了，Meta是真·开源先锋"`;

    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const result = {
        text: `${topNews.title} 🔥`,
        link: '/daily',
        timestamp: Date.now(),
      };
      cachedRecommend = result;
      return NextResponse.json(result);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || `${topNews.title} 🔥`;

    const result = {
      text: text.replace(/^["'「」『』]|["'「」『』]$/g, ''), // 去掉首尾引号
      link: '/daily',
      timestamp: Date.now(),
    };

    cachedRecommend = result;
    return NextResponse.json(result);
  } catch (error) {
    console.error('[recommend] Error:', error);
    return NextResponse.json(pickFallback());
  }
}

async function fetchTopNews(): Promise<{ title: string; summary?: string } | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/news_items?select=title,summary&order=importance_score.desc.nullslast&limit=1&published_at=gte.${today}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0] || null;
  } catch {
    return null;
  }
}

function pickFallback() {
  const idx = Math.floor(Math.random() * FALLBACK_RECOMMENDS.length);
  return FALLBACK_RECOMMENDS[idx];
}
