// Air Social Mission Control - Type Definitions

export type Team = 'synergy' | 'ignite' | 'alliance';
export type ClientStatus = 'active' | 'paused' | 'churned';
export type Service = 'seo' | 'paid-advertising' | 'social-media' | 'account-management';
export type TaskStatus = 'todo' | 'doing' | 'review' | 'done';
export type TaskPriority = 'P1' | 'P2' | 'P3' | 'P4';

export interface Client {
  id: string;
  name: string;
  team: Team;
  status: ClientStatus;
  services: Service[];
  monthly_retainer: number;
  assigned_members: string[];
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  team: Team;
  avatar?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  client_id: string | null;
  service: Service | null;
  due_date: string | null;
  is_recurring: boolean;
  recurrence_rule: RecurrenceRule | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  day_of_week?: number; // 0 = Sunday, 6 = Saturday
  day_of_month?: number | 'first_working_day' | 'last_working_day';
  end_date?: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  service: Service;
  tasks: Omit<Task, 'id' | 'client_id' | 'created_at' | 'updated_at'>[];
}

export interface Comment {
  id: string;
  task_id: string;
  content: string;
  author: string;
  created_at: string;
}

export interface Activity {
  id: string;
  task_id?: string;
  client_id?: string;
  action: string;
  author: string;
  details: string | null;
  created_at: string;
}

export const STATUSES: TaskStatus[] = ['todo', 'doing', 'review', 'done'];
export const PRIORITIES: TaskPriority[] = ['P1', 'P2', 'P3', 'P4'];
export const SERVICES: Service[] = ['seo', 'paid-advertising', 'social-media', 'account-management'];
export const TEAMS: Team[] = ['synergy', 'ignite', 'alliance'];
