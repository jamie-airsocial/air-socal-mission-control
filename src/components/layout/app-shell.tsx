'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { useSidebar } from '@/contexts/sidebar-context';
import { cn } from '@/lib/utils';

const AUTH_PATHS = ['/login'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const isAuthPage = AUTH_PATHS.includes(pathname);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <TopBar />
      <main className={cn(
        'min-h-screen bg-background p-6 pt-[60px] transition-all duration-300',
        collapsed ? 'ml-16' : 'ml-56'
      )}>
        {children}
      </main>
    </>
  );
}
