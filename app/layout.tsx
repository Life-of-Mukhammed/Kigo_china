import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#071a2c" };

export const metadata: Metadata = {
  title: "KiGo — Sport va turnirlar",
  description: "Turnir toping, jamoangizni ro‘yxatdan o‘tkazing va sport hamjamiyatiga qo‘shiling.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz">
      <body className="antialiased">{children}</body>
    </html>
  );
}
