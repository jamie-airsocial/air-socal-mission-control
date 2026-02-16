// Air Social Mission Control - Style Constants

import type { Team, Service, TaskStatus, TaskPriority } from './types';

export const TEAM_STYLES: Record<Team, { color: string; bg: string; text: string; label: string }> = {
  synergy: { color: '#3b82f6', bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Synergy' },
  ignite: { color: '#f97316', bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Ignite' },
  alliance: { color: '#a855f7', bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'Alliance' },
};

export const SERVICE_STYLES: Record<Service, { icon: string; bg: string; text: string; label: string }> = {
  seo: { icon: '🔍', bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'SEO' },
  'paid-ads': { icon: '💰', bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Paid Ads' },
  'social-media': { icon: '📱', bg: 'bg-pink-500/10', text: 'text-pink-400', label: 'Social Media' },
  'account-management': { icon: '👤', bg: 'bg-indigo-500/10', text: 'text-indigo-400', label: 'Account Management' },
};

export const STATUS_STYLES: Record<TaskStatus, { dot: string; bg: string; text: string; label: string }> = {
  todo: { dot: '#f59e0b', bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'To Do' },
  doing: { dot: '#a855f7', bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'In Progress' },
  review: { dot: '#3b82f6', bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Review' },
  done: { dot: '#22c55e', bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Done' },
};

export const PRIORITY_STYLES: Record<TaskPriority, { bg: string; text: string; label: string; border: string }> = {
  P1: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Urgent', border: 'border-red-500/20' },
  P2: { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'High', border: 'border-orange-500/20' },
  P3: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Medium', border: 'border-blue-500/20' },
  P4: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Low', border: 'border-emerald-500/20' },
};

export const PRIORITY_BORDER_COLORS: Record<TaskPriority, string> = {
  P1: '#ef4444',
  P2: '#f97316',
  P3: '#3b82f6',
  P4: '#22c55e',
};

export const MEMBER_COLORS: Record<string, string> = {
  'Sarah Chen': 'bg-blue-500/20 text-blue-400',
  'Marcus Johnson': 'bg-green-500/20 text-green-400',
  'Emily Rodriguez': 'bg-purple-500/20 text-purple-400',
  'David Kim': 'bg-orange-500/20 text-orange-400',
  'Rachel Foster': 'bg-pink-500/20 text-pink-400',
  'James Taylor': 'bg-cyan-500/20 text-cyan-400',
  'Olivia Brown': 'bg-indigo-500/20 text-indigo-400',
  'Tom Wilson': 'bg-amber-500/20 text-amber-400',
  'Sophie Davies': 'bg-red-500/20 text-red-400',
};
