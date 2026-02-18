import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

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
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Sidebar />
        <TopBar />
        <main className="ml-56 min-h-screen bg-background p-6 pt-[60px]">
          {children}
        </main>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
