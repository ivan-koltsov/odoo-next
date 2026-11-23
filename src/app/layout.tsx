import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/providers/auth-provider";
import { getCurrentSession } from "@/lib/odoo/session";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Odoo Next";

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description:
    "Headless Next.js + Odoo 18 application powered by native JSON-RPC and session-based authentication.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await getCurrentSession();

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthProvider initialUser={session?.user ?? null}>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
