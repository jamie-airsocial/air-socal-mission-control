'use client';

import { Search, Target, Share2, UserCheck, Tag, type LucideProps } from 'lucide-react';

/** Map of service key → Lucide icon component */
export const SERVICE_ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  seo: Search,
  'paid-advertising': Target,
  'social-media': Share2,
  'account-management': UserCheck,
  // Known icon name overrides (for custom services stored in DB)
  Search,
  Target,
  Share2,
  UserCheck,
  Tag,
};

/** Renders the appropriate Lucide icon for a service key */
export function ServiceIcon({
  serviceKey,
  iconName,
  size = 12,
  className,
}: {
  serviceKey?: string;
  iconName?: string;
  size?: number;
  className?: string;
}) {
  // Try iconName first, then serviceKey, then Tag fallback
  const Icon =
    (iconName && SERVICE_ICON_MAP[iconName]) ||
    (serviceKey && SERVICE_ICON_MAP[serviceKey]) ||
    Tag;
  return <Icon size={size} className={className} />;
}
