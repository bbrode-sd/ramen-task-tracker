import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tomobodo",
  description: "Bilingual Kanban board with English/Japanese support",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tomobodo",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Script to apply theme before page renders to prevent flash
// Also registers service worker for offline support
const themeScript = `
  (function() {
    try {
      const stored = localStorage.getItem('tomobodo-theme');
      const theme = stored === 'light' || stored === 'dark' ? stored : 'system';
      
      if (theme === 'system') {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.add(systemDark ? 'dark' : 'light');
      } else {
        document.documentElement.classList.add(theme);
      }
    } catch (e) {}
  })();
`;

// Service worker registration script - skip in development to avoid refresh issues
const swScript = `
  (function() {
    // Skip service worker in development mode to avoid refresh loops
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('[SW] Skipping service worker registration in development');
      // Unregister any existing service workers in development
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
          registrations.forEach(function(registration) {
            registration.unregister();
            console.log('[SW] Unregistered service worker in development');
          });
        });
      }
      return;
    }
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
          .then(function(registration) {
            console.log('[SW] Service worker registered:', registration.scope);
          })
          .catch(function(error) {
            console.log('[SW] Service worker registration failed:', error);
          });
      });
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: 'var(--background)' }}
      >
        {/* Skip to main content link for keyboard/screen reader users */}
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        {/* 
          Accessibility: Live region for screen reader announcements 
          This region is used to announce dynamic changes like drag operations,
          card moves, and filter results to screen reader users.
          Test with VoiceOver (Mac) or NVDA (Windows)
        */}
        <div 
          id="aria-live-announcer"
          aria-live="polite"
          aria-atomic="true"
          className="aria-live-region"
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
