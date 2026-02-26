'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { 
  Building2, 
  ListChecks, 
  UsersRound, 
  Receipt,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Settings,
  BarChart3,
  Eye,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useSidebar } from '@/contexts/sidebar-context';
import { ASSIGNEE_COLORS } from '@/lib/constants';
import type { AppUser } from '@/lib/auth-types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const NAV_ITEMS = [
  { href: '/clients', label: 'Clients', icon: Building2, permKey: 'clients' },
  { href: '/tasks', label: 'Tasks', icon: ListChecks, permKey: 'tasks' },
  { href: '/pipeline', label: 'Pipeline', icon: TrendingUp, permKey: 'pipeline' },
  { href: '/teams', label: 'Teams', icon: UsersRound, permKey: 'teams' },
  { href: '/delivery', label: 'Delivery', icon: BarChart3, permKey: 'teams' },
  { href: '/xero', label: 'Xero', icon: Receipt, permKey: 'xero' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed } = useSidebar();
  const { appUser, permissions, roleName, isAdmin, viewAsUser, setViewAsUser, realUser } = useAuth();
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [viewAsOpen, setViewAsOpen] = useState(false);

  // Fetch all users for "View as" (admin only)
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/users')
      .then(r => r.json())
      .then(data => setAllUsers(data.filter((u: AppUser) => u.is_active)))
      .catch(() => {});
  }, [isAdmin]);

  return (
    <TooltipProvider delayDuration={300}>
      <aside 
        className={`fixed left-0 top-0 h-screen bg-card border-r border-border/20 transition-all duration-300 flex flex-col ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Header */}
        <div className={`h-[72px] flex items-center border-b border-border/20 shrink-0 ${collapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}>
          <svg viewBox="0 0 870 1005" className="w-6 h-6 shrink-0 text-[#25285d] dark:text-white" style={{ transform: 'scaleY(-1)' }} fill="currentColor">
            <path d="M870.047 0L552.605 183.277L552.578 454.656L317.543 318.992L0 502.324L870.059 1004.55L870.047 0Z"/>
          </svg>
          {!collapsed && (
            <h1 className="text-[19px] font-semibold font-[family-name:var(--font-poppins)] tracking-[0.04em] text-[#25285d] dark:text-white">airsocial</h1>
          )}
        </div>

        {/* Navigation */}
        <nav className="p-2 flex-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const hasAccess = permissions[item.permKey as keyof typeof permissions] !== false;
            
            if (!hasAccess) return null;

            return collapsed ? (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-150 justify-center mb-0.5 ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-[13px]">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-150 mb-0.5 ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="text-[13px] font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* Admin section */}
          {isAdmin && (
            <>
              <div className={`my-2 border-t border-border/20 ${collapsed ? 'mx-2' : 'mx-1'}`} />
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href="/admin/users"
                      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-150 justify-center ${
                        pathname.startsWith('/admin')
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                      }`}
                    >
                      <Settings size={18} className="shrink-0" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-[13px]">Admin</TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  href="/admin/users"
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-150 ${
                    pathname.startsWith('/admin')
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  }`}
                >
                  <Settings size={18} className="shrink-0" />
                  <span className="text-[13px] font-medium">Admin</span>
                </Link>
              )}
            </>
          )}
        </nav>

        {/* View as (admin only) */}
        {isAdmin && !collapsed && (
          <div className="px-4 py-2 border-t border-border/20">
            {viewAsUser ? (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                <Eye size={12} className="text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-amber-500 font-medium">Viewing as</p>
                  <p className="text-[11px] truncate">{viewAsUser.full_name}</p>
                </div>
                <button onClick={() => setViewAsUser(null)} className="text-amber-500 hover:text-amber-400 shrink-0">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setViewAsOpen(!viewAsOpen)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20 transition-colors"
                >
                  <Eye size={14} />
                  <span className="text-[11px]">View as...</span>
                </button>
                {viewAsOpen && (
                  <div className="absolute bottom-full left-0 w-full mb-1 bg-popover border border-border/20 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50">
                    {allUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => { setViewAsUser(u); setViewAsOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${ASSIGNEE_COLORS[u.full_name] || 'bg-primary/20 text-primary'}`}>
                          {u.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] truncate">{u.full_name}</p>
                          <p className="text-[9px] text-muted-foreground/50">{u.role?.name || 'No role'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {isAdmin && collapsed && (
          <div className="px-2 py-2 border-t border-border/20">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => viewAsUser ? setViewAsUser(null) : setViewAsOpen(!viewAsOpen)}
                  className={`w-full flex items-center justify-center py-2 rounded-md transition-colors ${
                    viewAsUser ? 'bg-amber-500/10 text-amber-500' : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20'
                  }`}
                >
                  <Eye size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-[13px]">
                {viewAsUser ? `Viewing as ${viewAsUser.full_name} — click to reset` : 'View as...'}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Collapse button */}
        <div className={`border-t border-border/20 ${collapsed ? 'px-2' : 'px-4'}`}>
          <button
            onClick={toggleCollapsed}
            className={`w-full flex items-center py-2.5 rounded-md hover:bg-muted/40 transition-colors text-muted-foreground/60 hover:text-foreground ${collapsed ? 'justify-center' : 'gap-2 px-2'}`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!collapsed && <span className="text-[12px]">Collapse</span>}
          </button>
        </div>

        {/* User area at bottom */}
        <div className={`border-t border-border/20 py-3 ${collapsed ? 'px-2' : 'px-4'}`}>
          {appUser && (() => {
            const userColor = ASSIGNEE_COLORS[appUser.full_name] || 'bg-primary/20 text-primary';
            return (
              <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                {appUser.avatar_url ? (
                  <img
                    src={appUser.avatar_url}
                    alt={appUser.full_name}
                    className="h-8 w-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${userColor}`}>
                    {appUser.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                )}
                {!collapsed && (
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{appUser.full_name}</p>
                    <p className="text-[10px] text-muted-foreground">{roleName || 'Team Member'}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </aside>
    </TooltipProvider>
  );
}
