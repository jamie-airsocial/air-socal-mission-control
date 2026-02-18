'use client';

import { Search, Target, Share2, UserCheck, type LucideProps } from 'lucide-react';

/** Map of service key → Lucide icon component */
export const SERVICE_ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  seo: Search,
  'paid-advertising': Target,
  'social-media': Share2,
  'account-management': UserCheck,
};

/** Renders the appropriate Lucide icon for a service key */
export function ServiceIcon({
  serviceKey,
  size = 12,
  className,
}: {
  serviceKey: string;
  size?: number;
  className?: string;
}) {
  const Icon = SERVICE_ICON_MAP[serviceKey];
  if (!Icon) return null;
  return <Icon size={size} className={className} />;
}
