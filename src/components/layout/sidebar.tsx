"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, CheckSquare, UsersRound } from 'lucide-react'

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Teams', href: '/teams', icon: UsersRound },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border/20 bg-card">
      <div className="flex h-16 items-center border-b border-border/20 px-6">
        <h1 className="text-xl font-semibold text-foreground">Air Social</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors duration-150 ${
                isActive
                  ? 'bg-indigo-500/10 text-indigo-400'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
