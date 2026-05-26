'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Newspaper, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface NavLink {
  href: string;
  label: string;
  icon?: string;
  className?: string;
  group?: 'main' | 'secondary';
}

const links: NavLink[] = [
  { href: '/', label: '首页', group: 'main' },
  { href: '/daily', label: '日报', group: 'main' },
  { href: '/weekly', label: '周报', group: 'main' },
  { href: '/leaderboard', label: '排行榜', group: 'main' },
  { href: '/admin/workspace', label: '管理', className: 'text-muted-foreground/60 text-xs', group: 'secondary' },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="bg-card sticky top-0 z-40 border-b border-border/30">
      <div className="max-w-7xl mx-auto h-14 flex items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <Newspaper className="text-primary w-5 h-5" />
          <span className="font-bold text-lg tracking-tight font-display">AI Pulse</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                isActive(link.href)
                  ? 'text-primary bg-primary/10'
                  : link.className || 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="sm:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="菜单"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav className="sm:hidden border-t border-border/30 bg-card">
          <div className="px-4 py-3 space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive(link.href)
                    ? 'text-primary bg-primary/10'
                    : link.className || 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
