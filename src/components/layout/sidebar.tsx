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
  const { appUser, permissions, roleName } = useAuth();

  const isAdmin = roleName === 'Admin';

  return (
    <TooltipProvider delayDuration={300}>
      <aside 
        className={`fixed left-0 top-0 h-screen bg-card border-r border-border/20 transition-all duration-300 flex flex-col ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Header */}
        <div className={`h-[72px] flex items-center border-b border-border/20 shrink-0 ${collapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}>
          <svg viewBox="0 0 870 1005" className="w-6 h-6 shrink-0 text-[#25285d] dark:text-white" style={{ transform: 'scaleX(-1) rotate(-30deg)' }} fill="currentColor">
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
          {appUser && (
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-[11px] font-bold text-primary-foreground shadow-lg shadow-primary/20 shrink-0">
                {appUser.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{appUser.full_name}</p>
                  <p className="text-[10px] text-muted-foreground">{roleName || 'Team Member'}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
