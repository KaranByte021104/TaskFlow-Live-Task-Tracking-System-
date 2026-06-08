import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthInit from "../components/auth-init";
import Providers from "../components/providers";
import ToastContainer from "@/components/ui/toast-container";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Task Tracker - Live Collaboration",
  description: "A real-time lightweight project management and task tracking application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <AuthInit>
            {children}
            <ToastContainer />
          </AuthInit>
        </Providers>
      </body>
    </html>
  );
}
