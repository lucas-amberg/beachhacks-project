import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Study Materials Manager",
    description: "Manage your study materials easily",
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
