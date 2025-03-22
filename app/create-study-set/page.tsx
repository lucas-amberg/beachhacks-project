"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import { UploadCloud, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import axios from "axios";

const ACCEPTED_FILE_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function CreateStudySetPage() {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const [studySetName, setStudySetName] = useState("New Study Set");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];

        if (!selectedFile) return;

        if (!ACCEPTED_FILE_TYPES.includes(selectedFile.type)) {
            toast.error(
                "Invalid file type. Please upload PDF, PPTX, PNG, or DOCX files only.",
            );
            return;
        }

        setFile(selectedFile);
    };

    const handleSubmit = async () => {
        if (!file) {
            toast.error("Please select a file to upload");
            return;
        }

        if (!studySetName.trim()) {
            toast.error("Please enter a name for your study set");
            return;
        }

        try {
            setIsUploading(true);

            // Step 1: Create the study set
            const { data: studySetData, error: studySetError } = await supabase
                .from("study_sets")
                .insert({ name: studySetName })
                .select();

            if (studySetError) {
                throw new Error(
                    `Failed to create study set: ${studySetError.message}`,
                );
            }

            if (!studySetData || studySetData.length === 0) {
                throw new Error("Failed to create study set");
            }

            const studySetId = studySetData[0].id;

            // Step 2: Process the file (convert if needed)
            let fileToUpload = file;
            let fileName = file.name;

            // Convert PPTX or DOCX to PDF if needed
            if (
                file.type ===
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
                file.type ===
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ) {
                setIsConverting(true);
                toast.info("Converting file to PDF...");

                const formData = new FormData();
                formData.append("file", file);

                try {
                    const response = await axios.post(
                        "/api/convert",
                        formData,
                        {
                            responseType: "blob",
                        },
                    );

                    const fileNameWithoutExt = fileName.substring(
                        0,
                        fileName.lastIndexOf("."),
                    );
                    fileName = `${fileNameWithoutExt}-converted-to-pdf.pdf`;

                    fileToUpload = new File([response.data], fileName, {
                        type: "application/pdf",
                    });

                    toast.success("File converted successfully!");
                } catch (conversionError: any) {
                    // Handle conversion errors
                    let errorMessage =
                        "Conversion failed. Please try uploading a PDF file directly.";

                    if (conversionError.response) {
                        try {
                            const blob = conversionError.response.data;
                            const text = await blob.text();
                            const data = JSON.parse(text);

                            if (data.notInstalled) {
                                errorMessage =
                                    "LibreOffice is not installed on the server. Please install LibreOffice or upload PDFs directly.";

                                if (data.installInstructions) {
                                    toast.info(
                                        <div className="space-y-2">
                                            <p className="font-medium">
                                                Installation commands:
                                            </p>
                                            <ul className="text-sm space-y-1">
                                                <li>
                                                    <strong>Ubuntu:</strong>{" "}
                                                    {
                                                        data.installInstructions
                                                            .ubuntu
                                                    }
                                                </li>
                                                <li>
                                                    <strong>Mac:</strong>{" "}
                                                    {
                                                        data.installInstructions
                                                            .mac
                                                    }
                                                </li>
                                                <li>
                                                    <strong>Windows:</strong>{" "}
                                                    {
                                                        data.installInstructions
                                                            .windows
                                                    }
                                                </li>
                                            </ul>
                                        </div>,
                                        { duration: 10000 },
                                    );
                                }
                            }
                        } catch (e) {
                            // If parsing fails, use the default error message
                        }
                    }

                    toast.error(errorMessage);

                    // Delete the study set since we had an error
                    await supabase
                        .from("study_sets")
                        .delete()
                        .eq("id", studySetId);

                    setIsUploading(false);
                    setIsConverting(false);
                    return;
                } finally {
                    setIsConverting(false);
                }
            }

            // Step 3: Upload the file
            const materialId = uuidv4();
            const filePath = `${materialId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("study-materials")
                .upload(filePath, fileToUpload);

            if (uploadError) {
                // Clean up the study set if upload fails
                await supabase.from("study_sets").delete().eq("id", studySetId);

                throw new Error(`Upload failed: ${uploadError.message}`);
            }

            // Step 4: Create study material record
            const { error: studyMaterialError } = await supabase
                .from("study_materials")
                .insert({
                    id: materialId,
                    study_set: studySetId,
                });

            if (studyMaterialError) {
                // Clean up if creating study material record fails
                await supabase.storage
                    .from("study-materials")
                    .remove([filePath]);

                await supabase.from("study_sets").delete().eq("id", studySetId);

                throw new Error(
                    `Failed to create study material: ${studyMaterialError.message}`,
                );
            }

            // Notify sidebar about the new study set
            window.dispatchEvent(
                new CustomEvent("studySetCreated", {
                    detail: studySetData[0],
                }),
            );

            toast.success("Study set created successfully!");

            // Navigate to the new study set
            router.push(`/study-set/${studySetId}`);
        } catch (error) {
            console.error(error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : "An unknown error occurred",
            );
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="flex flex-col justify-center items-center h-[calc(100vh-80px)]">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.back()}
                            className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <CardTitle>Create New Study Set</CardTitle>
                    </div>
                    <CardDescription>
                        Upload your first study material to create a new study
                        set
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <label
                                htmlFor="name"
                                className="text-sm font-medium block mb-1">
                                Study Set Name
                            </label>
                            <Input
                                id="name"
                                value={studySetName}
                                onChange={(e) =>
                                    setStudySetName(e.target.value)
                                }
                                placeholder="Enter a name for your study set"
                                className="w-full"
                                disabled={isUploading}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="file"
                                className="text-sm font-medium block mb-1">
                                Upload File
                            </label>
                            <div className="grid w-full items-center gap-1.5">
                                <Input
                                    id="file"
                                    type="file"
                                    onChange={handleFileChange}
                                    accept=".pdf,.pptx,.png,.docx"
                                    disabled={isUploading || isConverting}
                                />
                            </div>
                            {file && (
                                <div className="text-sm mt-2">
                                    Selected file:{" "}
                                    <span className="font-medium">
                                        {file.name}
                                    </span>
                                </div>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                                Supported formats: PDF, PPTX, PNG, DOCX. PPTX
                                and DOCX files will be converted to PDF.
                            </p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button
                        onClick={handleSubmit}
                        disabled={!file || isUploading || isConverting}
                        className="w-full flex items-center gap-2">
                        <UploadCloud className="h-5 w-5" />
                        {isUploading
                            ? "Creating..."
                            : isConverting
                              ? "Converting..."
                              : "Create Study Set"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
