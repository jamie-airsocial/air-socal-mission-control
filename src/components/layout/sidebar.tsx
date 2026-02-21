'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Users, 
  ListChecks, 
  UsersRound, 
  Receipt,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useSidebar } from '@/contexts/sidebar-context';
import { ASSIGNEE_COLORS } from '@/lib/constants';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const NAV_ITEMS = [
  { href: '/clients', label: 'Clients', icon: Users, permKey: 'clients' },
  { href: '/tasks', label: 'Tasks', icon: ListChecks, permKey: 'tasks' },
  { href: '/pipeline', label: 'Pipeline', icon: TrendingUp, permKey: 'pipeline' },
  { href: '/teams', label: 'Teams', icon: UsersRound, permKey: 'teams' },
  { href: '/xero', label: 'Xero', icon: Receipt, permKey: 'xero' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed } = useSidebar();
  const { appUser, permissions, roleName, signOut } = useAuth();

  const isAdmin = roleName === 'Admin';

  return (
    <TooltipProvider delayDuration={300}>
      <aside 
        className={`fixed left-0 top-0 h-screen bg-card border-r border-border/20 transition-all duration-300 flex flex-col ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Header */}
        <div className={`h-[72px] flex items-center border-b border-border/20 shrink-0 ${collapsed ? 'justify-center px-0' : 'px-4'}`}>
          {!collapsed && (
            <h1 className="text-[15px] font-semibold text-foreground">Air Social</h1>
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
        <div className="p-2 border-t border-border/20 shrink-0">
          {appUser && (
            <div className={`flex items-center gap-2.5 px-2 py-2 rounded-md ${collapsed ? 'justify-center' : ''}`}>
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 ${ASSIGNEE_COLORS[appUser.full_name] || 'bg-primary/20 text-primary'}`}>
                {appUser.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-foreground truncate">{appUser.full_name}</p>
                  <p className="text-[11px] text-muted-foreground/60 truncate">{roleName || 'Team Member'}</p>
                </div>
              )}
            </div>
          )}

          {/* Settings + Logout row */}
          {collapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/admin/users"
                    className="w-full flex items-center justify-center p-2 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors duration-150 mt-0.5"
                  >
                    <Settings size={16} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-[13px]">Settings</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={signOut}
                    className="w-full flex items-center justify-center p-2 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors duration-150"
                  >
                    <LogOut size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-[13px]">Sign out</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <div className="flex items-center gap-1 mt-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/admin/users"
                    className="flex items-center justify-center p-2 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors duration-150"
                  >
                    <Settings size={16} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[13px]">Settings</TooltipContent>
              </Tooltip>
              <button
                onClick={signOut}
                className="flex-1 flex items-center gap-2 px-2 py-2 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors duration-150"
              >
                <LogOut size={16} className="shrink-0" />
                <span className="text-[13px]">Sign out</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
