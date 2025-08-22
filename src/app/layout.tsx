import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import React from 'react';
import ThemeProviderClient from '@/components/ThemeProviderClient';

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
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProviderClient>{children}</ThemeProviderClient>
      </body>
    </html>
  );
}
