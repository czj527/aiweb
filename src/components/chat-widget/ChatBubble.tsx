'use client';

import { cn } from '@/lib/utils';

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  link?: string;
  loading?: boolean;
}

interface ChatBubbleProps {
  message: ChatMessageData;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2.5 px-4 py-1', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
          🤖
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-surface-container text-foreground rounded-bl-sm'
        )}
      >
        {message.loading ? (
          <span className="flex items-center gap-1.5">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
            <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
          </span>
        ) : (
          <>
            {message.content}
            {message.link && (
              <a
                href={message.link}
                className="block mt-1.5 text-xs opacity-70 hover:opacity-100 transition-opacity underline underline-offset-2"
              >
                查看详情 →
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
