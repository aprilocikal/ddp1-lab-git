import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata = {
  metadataBase: new URL(siteUrl),
  manifest: "/manifest.json",
  title: "SCELE Notif — Notifikasi Akademik",
  description:
    "PWA untuk notifikasi akademik SCELE Universitas Indonesia. Pantau nilai, deadline tugas, dan upcoming events langsung dari HP.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SCELE Notif",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "SCELE Notif — Notifikasi Akademik",
    description: "Pantau nilai, deadline tugas, dan notifikasi SCELE UI langsung dari HP kamu.",
    siteName: "SCELE Notif",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#111111",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={inter.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SCELE Notif" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
