"use client";

import { ArrowRight, Copy, ExternalLink } from "lucide-react";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { toast } from "sonner";
import { useState } from "react";

export default function Home() {
    const router = useRouter();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const dainServiceUrl =
        "https://tunnel.dain-local.com/ArSKcDC6EBmHQTm4bFdTHnJqodeKkP1Yh5L9dwhDAXUE";

    const copyToClipboard = async () => {
        await navigator.clipboard.writeText(dainServiceUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                <Card className="w-full max-w-lg bg-card border-border">
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
                            <CardTitle className="text-3xl text-center text-foreground">
                                Study Sets
                            </CardTitle>
                            <CardDescription className="text-center text-lg mt-2 text-foreground opacity-70">
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
                            <p className="text-lg text-foreground">
                                Select a study set from the sidebar to view and
                                manage your study materials.
                            </p>
                            <p className="text-foreground">
                                Upload PDFs, PowerPoint presentations, Word
                                documents, and images to generate AI quiz
                                questions automatically.
                            </p>
                        </motion.div>
                    </CardContent>
                    <CardFooter className="flex flex-col items-center gap-3">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.8 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}>
                            <Button
                                className="mt-2 gap-2 items-center bg-primary hover:bg-primary/80 text-white"
                                onClick={createNewStudySet}>
                                <span>Create New Study Set</span>
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 1.0 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}>
                            <Dialog
                                open={dialogOpen}
                                onOpenChange={setDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="gap-2 items-center bg-black hover:bg-black/80 text-white">
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
                                            Follow these steps to integrate Dain
                                            with Study Sets
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <ol className="list-decimal pl-5 space-y-2">
                                            <li>
                                                Go to Dain and turn on Developer
                                                Mode in settings
                                            </li>
                                            <li>
                                                Copy the URL below and add it as
                                                a service
                                            </li>
                                            <li>
                                                Open the BeachHacks Assistant
                                                link to start using Dain
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
                                                <span>
                                                    Open BeachHacks Assistant
                                                </span>
                                                <ExternalLink className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </motion.div>
                    </CardFooter>
                </Card>
            </motion.div>
        </motion.div>
    );
}
