import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
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
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
