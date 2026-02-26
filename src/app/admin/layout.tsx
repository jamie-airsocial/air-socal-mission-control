'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

const ALL_ADMIN_TABS = [
  { href: '/admin/profile', label: 'My Profile', adminOnly: false },
  { href: '/admin/users', label: 'Users', adminOnly: true },
  { href: '/admin/roles', label: 'Roles & Permissions', adminOnly: true },
  { href: '/admin/teams', label: 'Teams', adminOnly: true },
  { href: '/admin/statuses', label: 'Statuses', adminOnly: true },
  { href: '/admin/capacity', label: 'Capacity', adminOnly: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const tabs = ALL_ADMIN_TABS.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-semibold text-foreground">{isAdmin ? 'Admin' : 'Settings'}</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">{isAdmin ? 'Manage users, roles, permissions and teams' : 'Your profile settings'}</p>
      </div>

      {/* Admin tabs */}
      <div className="flex gap-0 border-b border-border/20">
        {tabs.map(tab => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors duration-150 ${
                isActive
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border/40'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
