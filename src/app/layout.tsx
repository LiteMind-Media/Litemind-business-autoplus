import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import React from 'react';
import ThemeProviderClient from '@/components/ThemeProviderClient';
import ConvexClientProvider from '@/components/ConvexClientProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BUSINESS AUTO+",
  description: "Business Auto+ CRM instance (Parlay Proz dashboards)",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico'
  },
  openGraph: {
    title: 'BUSINESS AUTO+',
    description: 'Business Auto+ CRM instance (Parlay Proz dashboards)',
    images: ['/LiteMind Logo.png']
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {/* Instant theme variables (prevents amber flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const raw = localStorage.getItem('parlay-theme'); if (!raw) return; const parsed = JSON.parse(raw); const t = parsed.theme || parsed; if (!t || !t.from || !t.via || !t.to) return; const root = document.documentElement; const set = (k,v)=>{ if(v) root.style.setProperty(k,v); }; set('--brand-from', t.from); set('--brand-via', t.via); set('--brand-to', t.to); set('--brand-text', t.text || '#1a1026'); set('--brand-bg', t.background || '#FFFFFF'); set('--brand-sidebar-text', t.sidebarText || t.text || '#1a1026'); set('--brand-header-text', t.headerText || t.text || '#1a1026'); set('--brand-text-primary', t.primaryText || t.text || '#1a1026'); set('--brand-text-secondary', t.secondaryText || t.sidebarText || '#443850'); set('--brand-border', t.border || '#e5e7eb'); set('--brand-card-bg', t.cardBg || '#FFFFFF'); set('--brand-muted-bg', t.mutedBg || '#F1F5F9'); if (t.backgroundRadialCenter) set('--brand-radial-center', t.backgroundRadialCenter); if (t.backgroundRadialEdge) set('--brand-radial-edge', t.backgroundRadialEdge); if (t.mode) root.dataset.themeMode = t.mode; } catch(_) {} })();`
          }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ConvexClientProvider>
          <ThemeProviderClient>{children}</ThemeProviderClient>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
