"use client";

import { useState, useEffect } from "react";
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
import { getTextFromPDF } from "@/app/lib/extractText";
import { isHeicFile, convertHeicToJpeg } from "@/app/lib/heicUtilsClient";

const ACCEPTED_FILE_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/heic",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function CreateStudySetPage() {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
    const [isGeneratingName, setIsGeneratingName] = useState(false);
    const [studySetName, setStudySetName] = useState<string | null>(null);
    const [questionCount, setQuestionCount] = useState(5);
    const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];

        if (!selectedFile) return;

        if (!ACCEPTED_FILE_TYPES.includes(selectedFile.type)) {
            toast.error(
                "Invalid file type. Please upload PDF, PPTX, PNG, JPEG, JPG, HEIC, or DOCX files only.",
            );
            return;
        }

        setFile(selectedFile);

        // When file is selected, generate a name suggestion
        generateNameSuggestion(selectedFile);
    };

    const generateNameSuggestion = async (selectedFile: File) => {
        try {
            setIsGeneratingName(true);

            // First, extract some text from the file to send to the API
            const formData = new FormData();
            formData.append("file", selectedFile);

            toast.info("Analyzing document to generate a name...");

            const response = await fetch("/api/generate-name", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Failed to generate name");
            }

            const result = await response.json();

            if (result.name) {
                setStudySetName(result.name);
                toast.success(
                    "Study set name suggested based on your document",
                );
            } else {
                // Fallback to a default name
                setStudySetName(
                    `Study Set - ${new Date().toLocaleDateString()}`,
                );
            }
        } catch (error) {
            console.error("Error generating name:", error);
            // Fallback to a default name
            setStudySetName(`Study Set - ${new Date().toLocaleDateString()}`);
        } finally {
            setIsGeneratingName(false);
        }
    };

    const handleSubmit = async () => {
        if (!file) {
            toast.error("Please select a file to upload");
            return;
        }

        // Use generated name or fallback
        const finalStudySetName =
            studySetName || `Study Set - ${new Date().toLocaleDateString()}`;

        try {
            setIsUploading(true);

            // Step 1: Create the study set
            const { data: studySetData, error: studySetError } = await supabase
                .from("study_sets")
                .insert({ name: finalStudySetName })
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
            // Use a temporary name during conversion
            let tempFileName = file.name;
            let finalFileName = file.name;
            let isImageFile = file.type.includes("image/");

            // Convert HEIC to JPEG if needed
            if (isHeicFile(file)) {
                setIsConverting(true);
                toast.info("Converting HEIC file to JPEG...");

                try {
                    // Wrap in a separate try-catch to handle specifically the HEIC conversion
                    try {
                        fileToUpload = await convertHeicToJpeg(file);
                        // Verify the conversion was successful
                        if (fileToUpload !== file) {
                            finalFileName = fileToUpload.name;
                            isImageFile = true; // Update image flag since we now have a JPEG
                            toast.success("HEIC file converted successfully");
                        } else {
                            // If the same file is returned, conversion failed but we'll continue
                            toast.warning(
                                "HEIC conversion wasn't successful, will use original file",
                            );
                        }
                    } catch (importError) {
                        console.error(
                            "Error with HEIC conversion:",
                            importError instanceof Error
                                ? importError.message
                                : String(importError),
                        );
                        toast.error(
                            "Failed to convert HEIC file, using original",
                        );
                    }
                } catch (error) {
                    console.error(
                        "Unexpected error in HEIC conversion:",
                        error instanceof Error ? error.message : String(error),
                    );
                    toast.error("Failed to process HEIC file, using original");
                } finally {
                    setIsConverting(false);
                }
            }
            // Convert files if needed
            else if (
                file.type.includes("pdf") ||
                file.type.includes("vnd.openxmlformats")
            ) {
                setIsConverting(true);
                toast.info("Converting file for processing...");

                try {
                    // Create a form for sending to the conversion API
                    const formData = new FormData();
                    formData.append("file", file);

                    // Call our conversion API
                    const response = await axios.post(
                        "/api/convert",
                        formData,
                        {
                            headers: {
                                "Content-Type": "multipart/form-data",
                            },
                            responseType: "arraybuffer",
                        },
                    );

                    // Create a new file from the PDF data
                    const pdfBlob = new Blob([response.data], {
                        type: "application/pdf",
                    });
                    const pdfFileName = file.name.split(".")[0] + ".pdf";
                    const pdfFile = new File([pdfBlob], pdfFileName, {
                        type: "application/pdf",
                    });

                    // Update the fileToUpload with the converted file
                    fileToUpload = pdfFile;
                    finalFileName = pdfFileName;

                    toast.success("File converted successfully");

                    // For quiz generation, we might need to extract the text content
                    try {
                        // For quiz generation later, extract text directly from the PDF
                        const fileArrayBuffer = await pdfFile.arrayBuffer();

                        // Store the array buffer for later use
                        setPdfBuffer(fileArrayBuffer);
                    } catch (extractError) {
                        console.error(
                            "Warning: Could not cache file content for quiz generation",
                            extractError,
                        );
                        // Continue anyway, we'll try to extract again when needed
                    }
                } catch (error: any) {
                    console.error("Error converting file:", error);
                    let errorMessage = "Failed to convert file";

                    // Try to extract more detailed error message
                    if (error.response && error.response.data) {
                        try {
                            if (typeof error.response.data === "string") {
                                errorMessage = error.response.data;
                            } else if (error.response.data.error) {
                                errorMessage = error.response.data.error;
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
            } else if (isImageFile) {
                // For image files, we don't need conversion
                toast.info("Processing image file...");
            }

            // Step 3: Upload the file to study-materials folder
            const materialId = uuidv4();
            const filePath = `${materialId}/${finalFileName}`;

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

            // Step 5: We only need the file in the study-materials bucket, so just update the record
            try {
                // Update study set with the path to the file in study-materials bucket
                await supabase
                    .from("study_sets")
                    .update({
                        file_path: filePath, // Just use the path in study-materials
                        file_name: finalFileName,
                        file_type: fileToUpload.type,
                    })
                    .eq("id", studySetId);

                console.log(`Updated study set with file path: ${filePath}`);
            } catch (updateError) {
                console.error(
                    "Error updating study set with file path:",
                    updateError,
                );
                // Continue anyway since we have the file in study-materials
            }

            // Step 6: Generate quiz questions
            setIsGeneratingQuiz(true);
            toast.info("Generating quiz questions...");

            try {
                // Get a public URL for the file (for GPT Vision to access)
                const { data: urlData } = await supabase.storage
                    .from("study-materials")
                    .createSignedUrl(filePath, 60 * 60); // 1 hour expiry

                const fileUrl = urlData?.signedUrl;

                // Try to extract text content from the PDF if available
                let fileContent = "";
                if (pdfBuffer) {
                    try {
                        fileContent = await getTextFromPDF(pdfBuffer);
                        console.log(
                            "Extracted text content length:",
                            fileContent.length,
                        );
                    } catch (extractError) {
                        console.error(
                            "Error extracting PDF text:",
                            extractError,
                        );
                    }
                }

                // Create form data with the file and include file info directly
                const quizFormData = new FormData();
                quizFormData.append("file", fileToUpload);
                quizFormData.append("studySetId", studySetId.toString());
                quizFormData.append("numQuestions", questionCount.toString());
                quizFormData.append("fileName", finalFileName);
                quizFormData.append("fileType", fileToUpload.type);

                // Add the file URL if available (for GPT Vision)
                if (fileUrl) {
                    quizFormData.append("fileUrl", fileUrl);
                    console.log(
                        "Using signed URL for quiz generation:",
                        fileUrl,
                    );
                }

                // Add extracted content if available
                if (fileContent) {
                    quizFormData.append("fileContent", fileContent);
                    console.log(
                        "Added extracted text content for quiz generation",
                    );
                }

                // Call the API to generate quiz questions
                const quizResponse = await fetch("/api/generate-quiz", {
                    method: "POST",
                    body: quizFormData,
                });

                const quizResult = await quizResponse.json();

                if (!quizResponse.ok) {
                    console.error("Error generating quiz:", quizResult.error);
                    // Continue anyway - quiz generation is a bonus feature
                    toast.error(
                        "Quiz generation failed, but study set was created successfully",
                    );
                } else {
                    toast.success("Quiz questions generated successfully!");
                }
            } catch (quizError) {
                console.error("Error generating quiz:", quizError);
                // Continue anyway - study set is created successfully
                toast.error(
                    "Quiz generation failed, but study set was created successfully",
                );
            } finally {
                setIsGeneratingQuiz(false);
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
            setIsGeneratingQuiz(false);
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
                        {studySetName && (
                            <div>
                                <label
                                    htmlFor="name"
                                    className="text-sm font-medium block mb-1">
                                    Suggested Study Set Name
                                </label>
                                <div className="flex gap-2 items-center">
                                    <Input
                                        id="name"
                                        value={studySetName}
                                        onChange={(e) =>
                                            setStudySetName(e.target.value)
                                        }
                                        placeholder="Analyzing document..."
                                        className="w-full"
                                        disabled={
                                            isUploading || isGeneratingName
                                        }
                                    />
                                    {isGeneratingName && (
                                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Name suggested based on your document. You
                                    can edit it if you wish.
                                </p>
                            </div>
                        )}

                        <div>
                            <label
                                htmlFor="file"
                                className="text-sm font-medium block mb-1">
                                Upload File
                            </label>
                            <Input
                                id="file"
                                type="file"
                                onChange={handleFileChange}
                                className="w-full"
                                disabled={isUploading}
                                accept=".pdf,.pptx,.png,.docx,.jpeg,.jpg,.heic"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Supported formats: PDF, PPTX, PNG, DOCX, JPEG,
                                JPG, HEIC
                            </p>
                        </div>

                        <div>
                            <label
                                htmlFor="questionCount"
                                className="text-sm font-medium block mb-1">
                                Number of Quiz Questions
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    id="questionCount"
                                    type="range"
                                    min="3"
                                    max="15"
                                    step="1"
                                    value={questionCount}
                                    onChange={(e) =>
                                        setQuestionCount(
                                            parseInt(e.target.value, 10),
                                        )
                                    }
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                                    disabled={isUploading}
                                />
                                <span className="text-sm font-medium">
                                    {questionCount}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                How many quiz questions should be generated
                                (3-15)
                            </p>
                        </div>

                        {file && (
                            <div className="text-sm">
                                Selected file:{" "}
                                <span className="font-medium">{file.name}</span>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button
                        onClick={handleSubmit}
                        disabled={
                            !file ||
                            isUploading ||
                            isConverting ||
                            isGeneratingQuiz
                        }
                        className="w-full flex items-center gap-2">
                        <UploadCloud className="h-5 w-5" />
                        {isUploading
                            ? "Creating..."
                            : isConverting
                              ? "Converting..."
                              : isGeneratingQuiz
                                ? "Generating Quiz..."
                                : "Create Study Set"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
