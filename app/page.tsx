"use client";

import { ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { toast } from "sonner";

export default function Home() {
    const router = useRouter();

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
                router.push(`/study-set/${data[0].id}`);
            }
        } catch (error) {
            console.error("Error creating study set:", error);
            toast.error("Failed to create study set");
        }
    };

    return (
        <div className="flex flex-col justify-center items-center h-[calc(100vh-80px)]">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle className="text-3xl text-center">
                        Study Materials Manager
                    </CardTitle>
                    <CardDescription className="text-center text-lg mt-2">
                        Organize your learning resources in one place
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center space-y-4 text-center">
                        <BookOpen className="h-16 w-16 text-primary" />
                        <p className="text-lg">
                            Select a study set from the sidebar to view and
                            manage your study materials.
                        </p>
                        <p>
                            You can upload PDFs, PowerPoint presentations, Word
                            documents, and images to keep all your study
                            materials organized.
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Button
                        className="mt-2 gap-2 items-center"
                        onClick={createNewStudySet}>
                        <span>Create Your First Study Set</span>
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
