'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { X, MessageCircle } from 'lucide-react';
import { ChatBubble, ChatMessageData } from './ChatBubble';
import { ChatInput } from './ChatInput';
import { QuickActions } from './QuickActions';
import {
  executePublicIntent,
  executeAdminIntent,
  PublicIntent,
  AdminIntent,
} from './intent-matcher';

// ── Recommend 缓存 ──

let cachedRecommend: { text: string; link: string } | null = null;
let recommendTimestamp = 0;
const RECOMMEND_TTL = 60 * 60 * 1000; // 1小时

export function ChatWidget() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [recommend, setRecommend] = useState<string>('AI Pulse 助手');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── 加载一句话推荐 ──

  useEffect(() => {
    if (isAdmin) {
      setRecommend('AI管理员 · 需要帮忙吗？');
      return;
    }

    // 公开页面：加载推荐语
    if (cachedRecommend && Date.now() - recommendTimestamp < RECOMMEND_TTL) {
      setRecommend(cachedRecommend.text);
      return;
    }

    fetch('/api/chat/recommend')
      .then((res) => res.json())
      .then((data) => {
        if (data?.text) {
          cachedRecommend = { text: data.text, link: data.link || '/daily' };
          recommendTimestamp = Date.now();
          setRecommend(data.text);
        }
      })
      .catch(() => {
        setRecommend('AI资讯助手 · 问我点什么');
      });
  }, [isAdmin]);

  // ── 初始欢迎语 ──

  useEffect(() => {
    if (open && messages.length === 0) {
      const welcomeMsg: ChatMessageData = isAdmin
        ? {
            id: 'welcome',
            role: 'assistant',
            content: '管理员你好，今天需要我做什么？',
          }
        : {
            id: 'welcome',
            role: 'assistant',
            content: '嗨～有什么AI问题问我吧！🤖',
          };
      setMessages([welcomeMsg]);
    }
  }, [open, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 自动滚动到底部 ──

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── 发送消息 ──

  // ── 快捷操作（走模板API，不走LLM） ──

  const handleQuickAction = useCallback(
    async (intent: string) => {
      const intentLabels: Record<string, string> = {
        'today-news': '今日要闻',
        'hot-models': '热门模型',
        tools: 'AI工具',
        weekly: '本周周报',
        'sync-juya': '同步资讯',
        'gen-daily': '生成日报',
        'gen-weekly': '撰写周报',
        status: '系统状态',
      };
      const label = intentLabels[intent] || intent;

      const userMsg: ChatMessageData = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: label,
      };
      const loadingMsg: ChatMessageData = {
        id: 'loading',
        role: 'assistant',
        content: '',
        loading: true,
      };

      setMessages((prev) => [...prev, userMsg, loadingMsg]);
      setLoading(true);

      try {
        let result: { text: string; link?: string } = { text: '' };
        if (isAdmin) {
          result = await executeAdminIntent(intent as AdminIntent);
        } else {
          result = await executePublicIntent(intent as PublicIntent);
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === 'loading'
              ? { id: `bot-${Date.now()}`, role: 'assistant', content: result.text, link: result.link }
              : m
          )
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === 'loading'
              ? { id: `bot-${Date.now()}`, role: 'assistant', content: '操作失败，请稍后再试 😅' }
              : m
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [isAdmin]
  );

  // ── 用户输入消息（一律走DeepSeek对话，流式输出） ──

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsgId = `user-${Date.now()}`;
      const botMsgId = `bot-${Date.now()}`;
      const userMsg: ChatMessageData = {
        id: userMsgId,
        role: 'user',
        content: text,
      };
      const streamingMsg: ChatMessageData = {
        id: botMsgId,
        role: 'assistant',
        content: '',
        loading: true,
      };

      setMessages((prev) => [...prev, userMsg, streamingMsg]);
      setLoading(true);

      try {
        const history = messages
          .filter((m) => m.id !== 'welcome' && !m.loading)
          .map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          }));

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history,
            role: isAdmin ? 'admin' : 'public',
          }),
        });

        if (!res.ok) {
          // 非 SSE 响应（错误）
          const data = await res.json().catch(() => ({}));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMsgId
                ? { ...m, content: data.error || '请求失败，请稍后再试 😅', loading: false }
                : m
            )
          );
          setLoading(false);
          return;
        }

        // SSE 流式读取
        const reader = res.body?.getReader();
        if (!reader) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMsgId
                ? { ...m, content: '流读取失败，请稍后再试 😅', loading: false }
                : m
            )
          );
          setLoading(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                fullContent = parsed.error;
                break;
              }
              if (parsed.content) {
                fullContent += parsed.content;
                // 逐字更新消息
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botMsgId
                      ? { ...m, content: fullContent, loading: false }
                      : m
                  )
                );
              }
            } catch { /* skip */ }
          }
        }

        // 最终确保 loading 状态关闭
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? { ...m, content: fullContent || '抱歉，没有收到回复', loading: false }
              : m
          )
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? { ...m, content: '网络错误，请稍后再试 😅', loading: false }
              : m
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [isAdmin, messages]
  );

  // ── 渲染 ──

  const role = isAdmin ? 'admin' : 'public';
  const headerTitle = isAdmin ? 'AI管理员' : 'AI Pulse 助手';
  const headerSub = isAdmin ? '网站运维助手' : '你的AI资讯伙伴';
  const inputPlaceholder = isAdmin ? '输入指令...' : '问我点什么...';

  return (
    <>
      {/* 折叠态：浮动按钮 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-card pl-3.5 pr-4 py-2.5 rounded-full shadow-float hover:shadow-dialog transition-all hover:-translate-y-0.5 border border-border/30 group"
        >
          <MessageCircle className="w-4.5 h-4.5 text-primary flex-shrink-0" />
          <span className="text-sm text-foreground/80 max-w-[200px] truncate group-hover:text-foreground transition-colors">
            {recommend}
          </span>
        </button>
      )}

      {/* 展开态：对话框 */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-h-[520px] bg-card rounded-2xl shadow-dialog border border-border/30 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                🤖
              </div>
              <div>
                <div className="text-sm font-semibold">{headerTitle}</div>
                <div className="text-[11px] text-muted-foreground">{headerSub}</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2 min-h-0">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* 快捷按钮 */}
          <QuickActions role={role} onAction={handleQuickAction} disabled={loading} />

          {/* 输入框 */}
          <ChatInput onSend={sendMessage} disabled={loading} placeholder={inputPlaceholder} />
        </div>
      )}
    </>
  );
}
