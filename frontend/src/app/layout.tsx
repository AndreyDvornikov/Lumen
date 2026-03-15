import type { Metadata, Viewport } from "next";
import { Navbar } from "@/components/Navbar";

import "./globals.css";

export const metadata: Metadata = {
  title: "Lumen Protocol",
  description: "Campaign portal for tabletop RPG sessions.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-lumen-bg text-slate-100">
          <Navbar />
          {children}
        </div>
      </body>
    </html>
  );
}
