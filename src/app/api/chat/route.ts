import { NextRequest, NextResponse } from 'next/server';
import { getSystemPrompt } from '@/components/chat-widget/prompts';

// POST /api/chat — 自由聊天接口
// role=admin → AI管理员人设, role=public → AI助手人设
// 快捷查询由前端意图匹配处理，这里只处理 free-chat

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [], role = 'public' } = body as {
      message: string;
      history: ChatMessage[];
      role: 'admin' | 'public';
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      );
    }

    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json(
        { error: 'DeepSeek API key not configured' },
        { status: 500 }
      );
    }

    const systemPrompt = getSystemPrompt(role);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10), // 保留最近10条对话历史
      { role: 'user', content: message },
    ];

    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[chat] DeepSeek API error:', response.status, errText);
      return NextResponse.json(
        { error: 'LLM service error' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '抱歉，我暂时无法回答';

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('[chat] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
