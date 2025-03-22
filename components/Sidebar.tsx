"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import supabase from "@/lib/supabase";
import { PlusSquare } from "lucide-react";
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
        try {
            const { data, error } = await supabase
                .from("study_sets")
                .insert({ name: "New Study Set" })
                .select();

            if (error) {
                throw error;
            }

            if (data && data.length > 0) {
                // Force a sidebar refresh by dispatching a custom event
                window.dispatchEvent(
                    new CustomEvent("studySetCreated", {
                        detail: data[0],
                    }),
                );

                // Navigate to the new study set
                router.push(`/study-set/${data[0].id}`);
            }
        } catch (error) {
            console.error("Error creating study set:", error);
        }
    };

    const getStudySetDisplayName = (studySet: StudySet) => {
        return studySet.name || `Study Set #${studySet.id}`;
    };

    return (
        <div className="w-64 bg-slate-100 dark:bg-slate-900 h-full flex flex-col border-r">
            <div className="p-4 border-b">
                <h2 className="text-xl font-bold">Study Sets</h2>
            </div>
            <div className="flex-1 overflow-auto">
                {isLoading ? (
                    <div className="p-4 space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : studySets.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                        <p>No study sets yet</p>
                        <p className="text-sm">Create your first one!</p>
                    </div>
                ) : (
                    <div className="p-2">
                        {studySets.map((studySet) => (
                            <Link
                                key={studySet.id}
                                href={`/study-set/${studySet.id}`}
                                className={`block p-2 rounded-md mb-1 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800 ${
                                    pathname === `/study-set/${studySet.id}`
                                        ? "bg-slate-200 dark:bg-slate-800"
                                        : ""
                                }`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">
                                            {getStudySetDisplayName(studySet)}
                                        </p>
                                        <p className="text-xs text-gray-500">
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
            <div className="p-4 border-t mt-auto">
                <Button
                    onClick={createNewStudySet}
                    className="w-full flex items-center justify-center gap-2"
                    variant="outline">
                    <PlusSquare className="h-5 w-5" />
                    <span>Create New Set</span>
                </Button>
            </div>
        </div>
    );
}
