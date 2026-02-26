export interface AppUser {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  role_id: string | null;
  team: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_admin?: boolean;
  permission_overrides?: Partial<Permissions> | null;
  created_at: string;
  updated_at: string;
  last_active_at?: string | null;
  role?: Role;
  // Merged from Supabase Auth
  last_sign_in_at?: string | null;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permissions;
  category?: string | null;  // 'delivery' | 'management' | 'admin' | 'sales'
  created_at: string;
}

export interface Permissions {
  // Page access
  dashboard?: boolean;
  tasks: boolean;
  clients: boolean;
  pipeline: boolean;
  teams: boolean;
  xero?: boolean;
  settings: boolean;
  // Action permissions
  manage_users?: boolean;
  manage_clients?: boolean;
  manage_tasks?: boolean;
  manage_prospects?: boolean;
  manage_billing?: boolean;
}

export const DEFAULT_PERMISSIONS: Permissions = {
  dashboard: true,
  tasks: true,
  clients: true,
  pipeline: true,
  teams: true,
  xero: true,
  settings: true,
  manage_users: true,
  manage_clients: true,
  manage_tasks: true,
  manage_prospects: true,
  manage_billing: true,
};
