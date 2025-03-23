"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TopNavbar() {
    const pathname = usePathname();
    
    return (
        <div className="w-full bg-white dark:bg-slate-900 border-b">
            <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold">Study Materials</h1>
                </div>
            </div>
        </div>
    );
} 