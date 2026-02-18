'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import type { AppUser, Permissions } from '@/lib/auth-types';
import { DEFAULT_PERMISSIONS } from '@/lib/auth-types';

interface AuthContextValue {
  user: User | null;
  appUser: AppUser | null;
  permissions: Permissions;
  roleName: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  appUser: null,
  permissions: DEFAULT_PERMISSIONS,
  roleName: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      if (data.role?.permissions) {
        setPermissions(data.role.permissions as Permissions);
        setRoleName(data.role.name);
      }
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        loadAppUser(user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadAppUser(session.user);
      } else {
        setAppUser(null);
        setPermissions(DEFAULT_PERMISSIONS);
        setRoleName(null);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, appUser, permissions, roleName, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
