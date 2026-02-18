'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Zap } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error('Login failed', { description: error.message });
      setLoading(false);
      return;
    }

    toast.success('Welcome back!');
    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap size={16} className="text-primary" />
          </div>
          <span className="text-[17px] font-semibold text-foreground">Air Social</span>
        </div>

        {/* Card */}
        <div className="bg-card border border-border/20 rounded-xl p-6 shadow-xl">
          <div className="mb-6">
            <h1 className="text-[16px] font-semibold text-foreground">Sign in</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Mission Control — Team Portal
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@airsocial.co.uk"
                required
                autoComplete="email"
                className="h-9 text-[13px] bg-secondary border-border/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="h-9 text-[13px] bg-secondary border-border/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-9 text-[13px] mt-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-[12px] text-muted-foreground/40 mt-4">
          Air Social Mission Control · Internal use only
        </p>
      </div>
    </div>
  );
}
