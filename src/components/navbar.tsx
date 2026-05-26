'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Newspaper, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface NavLink {
  href: string;
  label: string;
  className?: string;
  group?: 'main' | 'secondary';
}

const links: NavLink[] = [
  { href: '/', label: '首页', group: 'main' },
  { href: '/daily', label: '日报', group: 'main' },
  { href: '/weekly', label: '周报', group: 'main' },
  { href: '/leaderboard', label: '排行榜', group: 'main' },
  { href: '/tools', label: '工具', group: 'main' },
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
    <header className="bg-card/80 backdrop-blur-md sticky top-0 z-40 border-b border-border/30">
      <div className="max-w-7xl mx-auto h-14 flex items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
          <Newspaper className="text-primary w-5 h-5 transition-transform duration-300 group-hover:rotate-12" />
          <span className="font-bold text-lg tracking-tight font-display">AI Pulse</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                  active
                    ? 'text-primary bg-primary/10 nav-link-active'
                    : link.className || 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="sm:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="菜单"
        >
          <span className="relative w-5 h-5 flex items-center justify-center">
            <Menu className={`w-5 h-5 absolute transition-all duration-300 ${mobileOpen ? 'opacity-0 rotate-90 scale-75' : 'opacity-100 rotate-0 scale-100'}`} />
            <X className={`w-5 h-5 absolute transition-all duration-300 ${mobileOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-75'}`} />
          </span>
        </button>
      </div>

      {/* Mobile Nav */}
      <div className={`sm:hidden overflow-hidden transition-all duration-300 ease-out ${mobileOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
        <nav className="border-t border-border/30 bg-card/95 backdrop-blur-sm">
          <div className="px-4 py-3 space-y-1">
            {links.map((link, i) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 animate-stagger-fade stagger-${i + 1} ${
                    active
                      ? 'text-primary bg-primary/10'
                      : link.className || 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
