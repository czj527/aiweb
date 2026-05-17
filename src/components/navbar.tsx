'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Newspaper } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: '今日热点' },
    { href: '/daily', label: '日报' },
    { href: '/news', label: '全部资讯' },
    { href: '/leaderboard', label: '排行榜' },
    { href: '/admin/workspace', label: 'AI工作台', className: 'text-muted-foreground/60 text-xs' },
    { href: '/admin', label: '管理', className: 'text-muted-foreground/60 text-xs' },
  ];

  return (
    <header className="bg-card sticky top-0 z-40 border-b border-border/30">
      <div className="max-w-5xl mx-auto h-14 flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Newspaper className="text-primary w-5 h-5" />
          <span className="font-bold text-lg tracking-tight font-display">AI Pulse</span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'text-primary bg-primary/10'
                    : link.className || 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
