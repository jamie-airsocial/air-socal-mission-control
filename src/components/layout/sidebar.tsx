'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Users, 
  ListChecks, 
  UsersRound, 
  Receipt,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/teams', label: 'Teams', icon: UsersRound },
  { href: '/xero', label: 'Xero', icon: Receipt },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside 
      className={`fixed left-0 top-0 h-screen bg-card border-r border-border/20 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Header */}
      <div className="h-14 flex items-center px-4 border-b border-border/20">
        {!collapsed && (
          <h1 className="text-[15px] font-semibold text-foreground">Air Social</h1>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1.5 rounded-md hover:bg-muted/40 transition-colors text-muted-foreground/60 hover:text-foreground"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-150 ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && (
                <span className="text-[13px] font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
