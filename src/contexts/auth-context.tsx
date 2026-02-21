'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import type { AppUser, Permissions } from '@/lib/auth-types';
import { DEFAULT_PERMISSIONS } from '@/lib/auth-types';

interface AuthContextValue {
  user: User | null;
  appUser: AppUser | null;
  permissions: Permissions;
  roleName: string | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  appUser: null,
  permissions: DEFAULT_PERMISSIONS,
  roleName: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
});

const ADMIN_USER_IDS = ['83983bb2-3d05-4be3-97f3-fdac36929560']; // Jamie

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const loadAppUser = async (authUser: User) => {
    const { data } = await supabase
      .from('app_users')
      .select('*, role:roles(*)')
      .eq('auth_user_id', authUser.id)
      .single();

    if (data) {
      setAppUser(data);
      
      // Check if user is admin via role name OR hardcoded ID list
      const userIsAdmin = data.role?.name === 'Admin' || ADMIN_USER_IDS.includes(data.id);
      setIsAdmin(userIsAdmin);
      
      if (data.role?.permissions) {
        // Admin always has full access — override all permissions to true
        if (userIsAdmin) {
          const fullPerms: Permissions = {
            dashboard: true, tasks: true, clients: true, pipeline: true,
            teams: true, xero: true, settings: true,
            manage_users: true, manage_clients: true, manage_tasks: true,
            manage_prospects: true, manage_billing: true,
          };
          setPermissions(fullPerms);
        } else {
          setPermissions({
            ...DEFAULT_PERMISSIONS,
            ...data.role.permissions,
          } as Permissions);
        }
        setRoleName(data.role.name);
      }
    }
  };

  // Send heartbeat (updates last_active_at) every 60s when tab is visible
  const sendHeartbeat = () => {
    if (document.visibilityState === 'visible') {
      fetch('/api/users/heartbeat', { method: 'POST' }).catch(() => {});
    }
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    sendHeartbeat(); // immediate call
    heartbeatRef.current = setInterval(sendHeartbeat, 60_000);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        loadAppUser(user).finally(() => setLoading(false));
        startHeartbeat();
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadAppUser(session.user);
        startHeartbeat();
      } else {
        setAppUser(null);
        setPermissions(DEFAULT_PERMISSIONS);
        setRoleName(null);
        setIsAdmin(false);
        stopHeartbeat();
      }
    });

    // Handle visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      subscription.unsubscribe();
      stopHeartbeat();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    stopHeartbeat();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, appUser, permissions, roleName, isAdmin, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
