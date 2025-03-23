"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import supabase from "@/lib/supabase";

import { PlusSquare, BarChart2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StudySet } from "@/lib/supabase";

export default function Sidebar() {
    const [studySets, setStudySets] = useState<StudySet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const fetchStudySets = async () => {
            try {
                setIsLoading(true);
                const { data, error } = await supabase
                    .from("study_sets")
                    .select("*")
                    .order("created_at", { ascending: false });

                if (error) {
                    throw error;
                }

                setStudySets(data || []);
            } catch (error) {
                console.error("Error fetching study sets:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStudySets();

        // Listen for real-time database changes
        const channel = supabase
            .channel("study_sets_changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "study_sets" },
                () => {
                    fetchStudySets();
                },
            )
            .subscribe();

        // Listen for custom event when a study set is created
        const handleStudySetCreated = (e: any) => {
            fetchStudySets();
        };

        // Listen for custom event when a study set is updated
        const handleStudySetUpdated = (e: any) => {
            fetchStudySets();
        };

        // Listen for custom event when a study set is deleted
        const handleStudySetDeleted = (e: any) => {
            fetchStudySets();
        };

        window.addEventListener("studySetCreated", handleStudySetCreated);
        window.addEventListener("studySetUpdated", handleStudySetUpdated);
        window.addEventListener("studySetDeleted", handleStudySetDeleted);

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener(
                "studySetCreated",
                handleStudySetCreated,
            );
            window.removeEventListener(
                "studySetUpdated",
                handleStudySetUpdated,
            );
            window.removeEventListener(
                "studySetDeleted",
                handleStudySetDeleted,
            );
        };
    }, []);

    const createNewStudySet = async () => {
        // Instead of creating an empty study set, navigate to the upload page
        router.push(`/create-study-set`);
    };

    const getStudySetDisplayName = (studySet: StudySet) => {
        return studySet.name || `Study Set #${studySet.id}`;
    };

    return (
        <div className="w-64 bg-background h-full flex flex-col border-r border-border">
            <div className="p-4 border-b border-border">
                <Link
                    href="/"
                    className="flex items-center gap-3 cursor-pointer">
                    <Image
                        src="/study-sets-logo.png"
                        alt="Study Sets Logo"
                        width={50}
                        height={50}
                        className="rounded-md"
                    />
                    <h2 className="text-xl font-bold text-foreground">
                        Study Sets
                    </h2>
                </Link>
            </div>

            {/* Categories Link */}
            <div className="p-4 border-b border-border">
                <Link
                    href="/categories"
                    className={`flex items-center gap-2 p-2 rounded-md transition-colors hover:bg-card ${
                        pathname === "/categories" ? "bg-card" : ""
                    }`}>
                    <Tag className="h-4 w-4" />
                    <span className="text-foreground">Browse Categories</span>
                </Link>
            </div>

            <div className="flex-1 overflow-auto">
                {isLoading ? (
                    <div className="p-4 space-y-2">
                        <Skeleton className="h-10 w-full bg-muted" />
                        <Skeleton className="h-10 w-full bg-muted" />
                        <Skeleton className="h-10 w-full bg-muted" />
                    </div>
                ) : studySets.length === 0 ? (
                    <div className="p-4 text-center text-foreground opacity-70">
                        <p>No study sets yet</p>
                        <p className="text-sm">Create your first one!</p>
                    </div>
                ) : (
                    <div className="p-2">
                        {studySets.map((studySet) => (
                            <Link
                                key={studySet.id}
                                href={`/study-set/${studySet.id}`}
                                className={`block p-2 rounded-md mb-1 transition-colors hover:bg-card ${
                                    pathname === `/study-set/${studySet.id}`
                                        ? "bg-card"
                                        : ""
                                }`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-foreground">
                                            {getStudySetDisplayName(studySet)}
                                        </p>
                                        <p className="text-xs opacity-70 text-foreground">
                                            {new Date(
                                                studySet.created_at,
                                            ).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
            <div className="p-4 border-t border-border mt-auto">
                <div className="flex flex-col gap-3">
                    <Link href="/stats">
                        <Button
                            className="w-full flex items-center justify-center gap-2 bg-secondary text-foreground hover:bg-secondary/80"
                            variant="secondary">
                            <BarChart2 className="h-5 w-5" />
                            <span>View Stats</span>
                        </Button>
                    </Link>

                    <Button
                        onClick={createNewStudySet}
                        className="w-full flex items-center justify-center gap-2 border-border text-foreground"
                        variant="outline">
                        <PlusSquare className="h-5 w-5" />
                        <span>Create New Set</span>
                    </Button>
                </div>
            </div>
        </div>
    );
}
