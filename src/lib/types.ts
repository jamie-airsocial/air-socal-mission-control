export interface Project {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

/** Air Social uses clients instead of projects */
export interface Client {
  id: string;
  name: string;
  team?: string;
  status?: string;
  services?: string[];
  monthly_retainer?: number;
  assigned_members?: string[];
  color?: string;
  created_at: string;
  updated_at?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'backlog' | 'todo' | 'doing' | 'review' | 'done';
  priority: 'P1' | 'P2' | 'P3' | 'P4' | null;
  assignee: string | null;
  project_id: string | null;
  client_id?: string | null;
  service?: string | null;
  due_date?: string | null;
  labels?: string[];
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  parent_id: string | null;
  subtask_count?: number;
  subtasks_done_count?: number;
  project?: Project | null;
  client_name?: string;
  client_color?: string;
  client_team?: string;
}

export interface Comment {
  id: string;
  task_id: string;
  content: string;
  author: string;
  created_at: string;
}

export interface DocFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: DocFile[];
}

export interface ActivityLog {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, unknown> | string | null;
  created_at: string;
}

export interface AgentStatus {
  id: string;
  name: string;
  emoji: string;
  role: string;
  model: string | null;
  status: 'active' | 'idle';
  current_task: string | null;
  current_session_key: string | null;
  last_active_at: string;
  created_at: string;
  updated_at: string;
}

// FALLBACK: Hardcoded statuses — components should fetch from /api/statuses and fall back to these
// 'backlog' intentionally excluded — merged into 'todo' in UI
export const STATUSES = ['todo', 'doing', 'review', 'done'] as const;
export type TaskStatusAll = 'backlog' | 'todo' | 'doing' | 'review' | 'done';
export const PRIORITIES = ['P1', 'P2', 'P3', 'P4'] as const;

export type PipelineStage =
  | 'manager-review'
  | 'assigned'
  | 'in-progress'
  | 'qa-review'
  | 'approved'
  | 'rejected';

export const PIPELINE_STAGES: PipelineStage[] = [
  'manager-review',
  'assigned',
  'in-progress',
  'qa-review',
  'approved',
  'rejected',
];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  'manager-review': 'Manager Review',
  assigned: 'Assigned',
  'in-progress': 'In Progress',
  'qa-review': 'QA Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export interface TokenUsageRecord {
  id: string;
  session_id: string | null;
  agent: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  project_id: string | null;
  task_id: string | null;
  context: string | null;
  created_at: string;
}

export interface TokenUsageBreakdown {
  agent?: string;
  model?: string;
  project_id?: string;
  project_name?: string;
  date?: string;
  provider?: string;
  total_tokens: number;
  total_cost: number;
  is_claude_max?: boolean;
}

export interface TokenUsageResponse {
  total_tokens: number;
  total_cost: number;
  breakdown_by_agent: TokenUsageBreakdown[];
  breakdown_by_project: TokenUsageBreakdown[];
  breakdown_by_model: TokenUsageBreakdown[];
  breakdown_by_provider: TokenUsageBreakdown[];
  breakdown_by_day: TokenUsageBreakdown[];
}

// ── Air Social-specific types ────────────────────────────────────────────────
/** Team is now a free-form string (slug from the teams table, e.g. 'synergy'). */
export type Team = string;
export type ClientStatus = 'active' | 'paused' | 'churned';
export type Service = 'seo' | 'paid-ads' | 'social-media' | 'account-management';

/** A team member conceptually treated as a user who can log in */
export interface User {
  id: string;
  name: string;
  role: string;
  team: Team;
  email: string;
}

/** Extended client detail fields (optional — may not yet be in DB) */
export interface ClientExtended {
  id: string;
  name: string;
  team?: string;
  status?: string;
  services?: string[];
  monthly_retainer?: number;
  assigned_members?: string[];
  color?: string;
  created_at: string;
  updated_at?: string;
  // Contract fields
  contract_value?: number;
  contract_start?: string;
  contract_end?: string;
  contract_renewal?: string;
  // Sale details
  sale_source?: string;
  sold_by?: string;
  sale_closed_at?: string;
  // Other
  notes?: string;
  signup_date?: string;
  churned_at?: string;
}
