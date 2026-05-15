import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AI Pulse - AI日报与大模型排行榜',
    template: '%s | AI Pulse',
  },
  description:
    'AI Pulse 每日自动聚合全球AI领域热点新闻，AI生成中文摘要，5分钟掌握AI动态。附带大模型多维度排行榜。',
  keywords: [
    'AI日报',
    'AI周报',
    'AI新闻',
    'AI资讯',
    '大模型排行榜',
    'AI Pulse',
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
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
