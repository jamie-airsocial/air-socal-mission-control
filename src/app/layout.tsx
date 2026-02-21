import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/auth-context';
import { SidebarProvider } from '@/contexts/sidebar-context';
import { AppShell } from '@/components/layout/app-shell';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });
const poppins = Poppins({ 
  subsets: ['latin'], 
  weight: ['600'],
  variable: '--font-poppins'
});

export const metadata: Metadata = {
  title: 'Air Social Mission Control',
  description: 'Team task and client management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${poppins.variable}`}>
      <body className={inter.className}>
        <AuthProvider>
          <SidebarProvider>
            <AppShell>
              {children}
            </AppShell>
            <Toaster
              position="bottom-right"
              toastOptions={{
                className: '!bg-card !border !border-border/20 !text-foreground !text-[13px] !shadow-xl !rounded-lg',
                style: { borderColor: 'hsl(var(--border) / 0.2)' },
              }}
            />
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
