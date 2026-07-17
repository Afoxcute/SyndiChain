import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { Providers } from './providers';
import Header from '@/components/layout/Header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SyndiChain — Multi-Agent DAO Treasury Swarm',
  description: 'Autonomous multi-agent AI swarm that manages crypto treasuries with collaborative debate, risk veto, and human-in-the-loop approval on Somnia.',
  keywords: 'blockchain, multi-agent, AI, treasury, DAO, DeFi, somnia, swarm',
  authors: [{ name: 'SyndiChain Team' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#a855f7',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto py-8">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
