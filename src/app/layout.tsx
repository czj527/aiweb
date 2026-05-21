import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AI Pulse - 橘鸦AI早报',
    template: '%s | AI Pulse',
  },
  description:
    'AI Pulse 每日自动聚合橘鸦AI早报，5分钟掌握AI动态。附带大模型多维度排行榜。',
  keywords: [
    'AI日报',
    'AI新闻',
    'AI资讯',
    '大模型排行榜',
    'AI Pulse',
    '橘鸦AI早报',
    '人工智能',
  ],
  authors: [{ name: 'AI Pulse' }],
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
