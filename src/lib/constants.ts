/** Shared style constants — single source of truth for status/priority styling */

export const STATUS_STYLES: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  // backlog mapped to todo styles for graceful fallback
  backlog: { dot: 'var(--status-warning)', bg: 'bg-status-warning/10', text: 'text-amber-400', label: 'To Do' },
  todo: { dot: 'var(--status-warning)', bg: 'bg-status-warning/10', text: 'text-amber-400', label: 'To Do' },
  doing: { dot: 'var(--status-doing)', bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'In Progress' },
  done: { dot: 'var(--status-success)', bg: 'bg-status-success/10', text: 'text-status-success', label: 'Done' },
};

export const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string; border: string }> = {
  P1: { bg: 'bg-destructive/10', text: 'text-destructive', label: 'Critical', border: 'border-destructive/20' },
  P2: { bg: 'bg-orange-500/15', text: 'text-orange-400', label: 'High', border: 'border-orange-500/20' },
  P3: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Medium', border: 'border-blue-500/20' },
  P4: { bg: 'bg-status-success/15', text: 'text-status-success', label: 'Low', border: 'border-status-success/20' },
};

export const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
  P1: { label: 'CRITICAL', className: 'bg-destructive/20 text-destructive border-destructive/20' },
  P2: { label: 'HIGH', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  P3: { label: 'MEDIUM', className: 'bg-blue-500/20 text-blue-400 border-primary/20' },
  P4: { label: 'LOW', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
};

export const ASSIGNEE_COLORS: Record<string, string> = {
  // Display names
  'Jamie Ludlow': 'bg-green-500/20 text-green-400',
  'Jamie': 'bg-green-500/20 text-green-400',
  'Casper': 'bg-primary/20 text-primary',
  'Developer': 'bg-blue-500/20 text-blue-400',
  'UI/UX Designer': 'bg-purple-500/20 text-purple-400',
  'QA Tester': 'bg-destructive/20 text-destructive',
  'Copywriter': 'bg-amber-500/20 text-amber-400',
  'Analyst': 'bg-cyan-500/20 text-cyan-400',
  'Manager': 'bg-muted-foreground/20 text-slate-400',
  'Trainer': 'bg-orange-500/20 text-orange-400',
  'Heartbeat': 'bg-pink-500/20 text-pink-400',
  // DB slugs (same colours)
  'jamie': 'bg-green-500/20 text-green-400',
  'casper': 'bg-primary/20 text-primary',
  'developer': 'bg-blue-500/20 text-blue-400',
  'ui-designer': 'bg-purple-500/20 text-purple-400',
  'qa-tester': 'bg-destructive/20 text-destructive',
  'copywriter': 'bg-amber-500/20 text-amber-400',
  'analyst': 'bg-cyan-500/20 text-cyan-400',
  'manager': 'bg-muted-foreground/20 text-slate-400',
  'trainer': 'bg-orange-500/20 text-orange-400',
  'heartbeat': 'bg-pink-500/20 text-pink-400',
};

/** Assignee name ↔ slug mappings — single source of truth */
export const NAME_TO_SLUG: Record<string, string> = {
  'Jamie Ludlow': 'jamie',
  'Casper': 'casper',
  'Developer': 'developer',
  'UI/UX Designer': 'ui-designer',
  'QA Tester': 'qa-tester',
  'Copywriter': 'copywriter',
  'Analyst': 'analyst',
  'Manager': 'manager',
  'Trainer': 'trainer',
  'Heartbeat': 'heartbeat',
};

export const SLUG_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(NAME_TO_SLUG).map(([name, slug]) => [slug, name])
);

export function toSlug(nameOrSlug: string): string {
  if (NAME_TO_SLUG[nameOrSlug]) return NAME_TO_SLUG[nameOrSlug];
  if (SLUG_TO_NAME[nameOrSlug]) return nameOrSlug; // already a slug
  return nameOrSlug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function toDisplayName(slugOrName: string): string {
  return SLUG_TO_NAME[slugOrName] || slugOrName;
}

/** Get 2-character initials from a display name or slug */
export function getInitials(nameOrSlug: string): string {
  const name = toDisplayName(nameOrSlug);
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 1);
}

/** Normalise priority values — DB may have mixed formats like "HIGH", "CRITICAL" etc. */
export function normalisePriority(raw: string): 'P1' | 'P2' | 'P3' | 'P4' {
  if (!raw) return 'P3';
  const upper = raw.toUpperCase().trim();
  if (upper === 'P1' || upper === 'P2' || upper === 'P3' || upper === 'P4') return upper;
  const map: Record<string, 'P1' | 'P2' | 'P3' | 'P4'> = {
    CRITICAL: 'P1', URGENT: 'P1',
    HIGH: 'P2',
    MEDIUM: 'P3', NORMAL: 'P3', DEFAULT: 'P3',
    LOW: 'P4', MINOR: 'P4',
  };
  return map[upper] || 'P3';
}

// ── Air Social-specific constants ────────────────────────────────────────────
import type { Team, Service } from './types';

export const TEAM_STYLES: Record<Team, { color: string; bg: string; text: string; label: string }> = {
  synergy: { color: '#3b82f6', bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Synergy' },
  ignite: { color: '#f97316', bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Ignite' },
  alliance: { color: '#a855f7', bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'Alliance' },
};

export const SERVICE_STYLES: Record<string, { icon: string; bg: string; text: string; label: string }> = {
  seo: { icon: 'Search', bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'SEO' },
  'paid-advertising': { icon: 'Target', bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Paid Advertising' },
  'social-media': { icon: 'Share2', bg: 'bg-pink-500/10', text: 'text-pink-400', label: 'Social Media' },
  'account-management': { icon: 'UserCheck', bg: 'bg-indigo-500/10', text: 'text-indigo-400', label: 'Account Management' },
};

export const LOSS_REASONS = [
  { id: 'budget', label: 'Budget constraints' },
  { id: 'competitor', label: 'Went with competitor' },
  { id: 'timing', label: 'Bad timing / not ready' },
  { id: 'no-response', label: 'No response / ghosted' },
  { id: 'scope', label: 'Scope mismatch' },
  { id: 'internal', label: 'Handling internally' },
  { id: 'relationship', label: 'Existing agency relationship' },
  { id: 'other', label: 'Other' },
] as const;

export const PIPELINE_STAGES = [
  { id: 'lead', label: 'Lead', color: 'var(--status-warning)', dotClass: 'bg-amber-400' },
  { id: 'contacted', label: 'Contacted', color: '#60a5fa', dotClass: 'bg-blue-400' },
  { id: 'proposal', label: 'Proposal', color: '#a78bfa', dotClass: 'bg-purple-400' },
  { id: 'negotiation', label: 'Negotiation', color: '#f97316', dotClass: 'bg-orange-400' },
  { id: 'won', label: 'Won', color: 'var(--status-success)', dotClass: 'bg-emerald-400' },
  { id: 'lost', label: 'Lost', color: '#ef4444', dotClass: 'bg-red-400' },
] as const;

export const MEMBER_COLORS: Record<string, string> = {
  'Jamie Ludlow': 'bg-green-500/20 text-green-400',
  'Alex Vinall': 'bg-blue-500/20 text-blue-400',
  'Sarah Mitchell': 'bg-purple-500/20 text-purple-400',
  'Tom Carter': 'bg-amber-500/20 text-amber-400',
  'Emily Chen': 'bg-pink-500/20 text-pink-400',
  'David Park': 'bg-cyan-500/20 text-cyan-400',
};
