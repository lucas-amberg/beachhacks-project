"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import supabase from "@/lib/supabase";

import { PlusSquare, BarChart2, Tag, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StudySet } from "@/lib/supabase";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

// Extend the StudySet type to include made_with_dain flag
type ExtendedStudySet = StudySet & {
    made_with_dain?: boolean;
};

export default function Sidebar() {
    const [studySets, setStudySets] = useState<ExtendedStudySet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    const dainServiceUrl =
        "https://tunnel.dain-local.com/ArSKcDC6EBmHQTm4bFdTHnJqodeKkP1Yh5L9dwhDAXUE";

    const copyToClipboard = async () => {
        await navigator.clipboard.writeText(dainServiceUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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

    const getStudySetDisplayName = (studySet: ExtendedStudySet) => {
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
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs opacity-70 text-foreground">
                                                {new Date(
                                                    studySet.created_at,
                                                ).toLocaleDateString()}
                                            </p>
                                            {studySet.made_with_dain && (
                                                <div className="flex items-center bg-black rounded px-1 py-0.5">
                                                    <Image
                                                        src="/dain-logo.png"
                                                        alt="Dain Logo"
                                                        width={12}
                                                        height={12}
                                                        className="mr-1"
                                                    />
                                                    <span className="text-white text-[10px]">
                                                        Made with Dain
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
            <div className="p-4 border-t border-border mt-auto">
                <div className="flex flex-col gap-3">
                    {/* Use Dain button with dialog */}
                    <Dialog
                        open={dialogOpen}
                        onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full flex items-center justify-center gap-2 bg-black text-white hover:bg-black/80">
                                <Image
                                    src="/dain-logo.png"
                                    alt="Dain Logo"
                                    width={20}
                                    height={20}
                                />
                                <span>Use Dain</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>
                                    Set up Dain Integration
                                </DialogTitle>
                                <DialogDescription>
                                    Follow these steps to integrate Dain with
                                    Study Sets
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <ol className="list-decimal pl-5 space-y-2">
                                    <li>
                                        Go to Dain and turn on Developer Mode in
                                        settings
                                    </li>
                                    <li>
                                        Copy the URL below and add it as a
                                        service
                                    </li>
                                    <li>
                                        Open the BeachHacks Assistant link to
                                        start using Dain
                                    </li>
                                </ol>

                                <div className="bg-slate-100 p-3 rounded-md relative">
                                    <pre className="text-sm overflow-x-auto whitespace-normal break-all">
                                        {dainServiceUrl.length > 40
                                            ? `${dainServiceUrl.substring(0, 40)}...`
                                            : dainServiceUrl}
                                    </pre>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="absolute top-2 right-2"
                                        onClick={copyToClipboard}>
                                        {copied ? (
                                            "Copied!"
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>

                                <div className="flex justify-center pt-4">
                                    <Button
                                        onClick={() =>
                                            window.open(
                                                "https://beachhacks-assistant.dain.org/",
                                                "_blank",
                                            )
                                        }
                                        className="flex items-center gap-2">
                                        <span>Open BeachHacks Assistant</span>
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

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
