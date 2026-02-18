export interface AppUser {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  role_id: string | null;
  team: 'synergy' | 'ignite' | 'alliance' | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  role?: Role;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permissions;
  created_at: string;
}

export interface Permissions {
  dashboard: boolean;
  tasks: boolean;
  clients: boolean;
  pipeline: boolean;
  teams: boolean;
  xero: boolean;
  settings: boolean;
}

export const DEFAULT_PERMISSIONS: Permissions = {
  dashboard: true,
  tasks: true,
  clients: true,
  pipeline: true,
  teams: true,
  xero: true,
  settings: true,
};
