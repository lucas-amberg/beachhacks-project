import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Study Sets - AI-Powered Learning",
    description: "Create AI-generated quiz questions from your study materials",
    icons: {
        icon: "/study-sets-logo.png",
        apple: "/study-sets-logo.png",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <div className="flex h-screen">
                    <Sidebar />
                    <main className="flex-1 overflow-auto p-6">
                        {children}
                        <Toaster position="bottom-right" />
                    </main>
                </div>
            </body>
        </html>
    );
}
