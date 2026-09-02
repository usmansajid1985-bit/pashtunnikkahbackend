import type { Metadata } from "next";
import { Fraunces, Inter, Geist_Mono } from "next/font/google";
import { AdminShell } from "@/components/admin-shell";
import { getAdminSession } from "@/lib/admin-auth";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pashtun Nikah Admin",
  description: "Admin panel for users, profiles, and payments",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAdminSession();
  return (
    <html lang="en">
      <body className={`${inter.variable} ${fraunces.variable} ${geistMono.variable} antialiased`}>
        <AdminShell adminEmail={session?.email}>{children}</AdminShell>
      </body>
    </html>
  );
}
