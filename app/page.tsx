"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { motion } from "framer-motion";
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
        // Instead of creating an empty study set immediately, navigate to the create page
        router.push(`/create-study-set`);
    };

    return (
        <motion.div
            className="flex flex-col justify-center items-center h-[calc(100vh-80px)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}>
                <Card className="w-full max-w-lg">
                    <CardHeader>
                        <motion.div
                            className="flex flex-col items-center"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.4 }}>
                            <Image
                                src="/study-sets-logo.png"
                                alt="Study Sets Logo"
                                width={80}
                                height={80}
                                className="rounded-md mb-4"
                            />
                            <CardTitle className="text-3xl text-center">
                                Study Sets
                            </CardTitle>
                            <CardDescription className="text-center text-lg mt-2">
                                AI-powered learning from your study materials
                            </CardDescription>
                        </motion.div>
                    </CardHeader>
                    <CardContent>
                        <motion.div
                            className="flex flex-col items-center space-y-4 text-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.6 }}>
                            <p className="text-lg">
                                Select a study set from the sidebar to view and
                                manage your study materials.
                            </p>
                            <p>
                                Upload PDFs, PowerPoint presentations, Word
                                documents, and images to generate AI quiz
                                questions automatically.
                            </p>
                        </motion.div>
                    </CardContent>
                    <CardFooter className="flex justify-center">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.8 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}>
                            <Button
                                className="mt-2 gap-2 items-center"
                                onClick={createNewStudySet}>
                                <span>Create New Study Set</span>
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </motion.div>
                    </CardFooter>
                </Card>
            </motion.div>
        </motion.div>
    );
}
