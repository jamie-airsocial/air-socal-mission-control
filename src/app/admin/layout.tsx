'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ADMIN_TABS = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/roles', label: 'Roles & Permissions' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-semibold text-foreground">Admin</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Manage users, roles and permissions</p>
      </div>

      {/* Admin tabs */}
      <div className="flex gap-0 border-b border-border/20">
        {ADMIN_TABS.map(tab => {
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
