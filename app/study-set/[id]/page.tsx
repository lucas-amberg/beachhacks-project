"use client";

/*
 * HEIC Image Handling in Study Set Page:
 *
 * 1. In handleUpload function:
 *   - Detects HEIC images using isHeicFile() function
 *   - Converts HEIC images to JPEG using convertHeicToJpeg() function
 *   - Uploads both to study-materials and files buckets
 *   - Creates a signed URL for GPT Vision to access the image
 *   - Passes the image URL to the generate-quiz API for analysis
 *   - Sets related_material field for quiz questions when appropriate
 *
 * 2. In handleGenerateMoreQuestions function:
 *   - Similar handling for HEIC files when generating additional questions
 *   - Uploads converted images to files bucket for Vision API access
 *   - Creates signed URLs for Vision API to analyze images
 *
 * This ensures consistency with the create-study-set page's HEIC handling.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import {
    UploadCloud,
    FileIcon,
    FileImage,
    FileText,
    Pencil,
    Check,
    Eye,
    Trash2,
    Loader2,
    FolderOpen,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import axios from "axios";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { extractTextFromFile, getStudySetFileContent } from "@/lib/file-utils";
import { QuizQuestion } from "@/lib/schemas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuizDisplay from "@/app/components/QuizDisplay";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { getTextFromPDF } from "@/app/lib/extractText";
import { isHeicFile, convertHeicToJpeg } from "@/app/lib/heicUtilsClient";

type StorageFile = {
    name: string;
    id: string;
    created_at: string;
    type: string;
};

const ACCEPTED_FILE_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/heic",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function StudySetPage() {
    const { id } = useParams();
    const router = useRouter();
    const [studySet, setStudySet] = useState<any>(null);
    const [materials, setMaterials] = useState<StorageFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [studySetName, setStudySetName] = useState("");
    const [isSavingName, setIsSavingName] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
    const [hasQuizQuestions, setHasQuizQuestions] = useState(false);
    const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
    const [showQuiz, setShowQuiz] = useState(false);
    const [selectedQuestionCount, setSelectedQuestionCount] = useState<
        number | string
    >(5);
    const [quizQuestions2, setQuizQuestions2] = useState<any[]>([]);
    const [unlinkingQuestion, setUnlinkingQuestion] = useState<string | null>(
        null,
    );
    const [shouldGenerateQuiz, setShouldGenerateQuiz] = useState(true);
    const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
    const [showMaterialsModal, setShowMaterialsModal] = useState(false);
    const [questionGenerationCount, setQuestionGenerationCount] = useState<
        number | string
    >(5);
    const [selectedQuestion, setSelectedQuestion] = useState<any | null>(null);
    const [showQuizResults, setShowQuizResults] = useState(false);
    const [lastQuizScore, setLastQuizScore] = useState<{
        score: number;
        total: number;
    } | null>(null);
    const [categoryScores, setCategoryScores] = useState<any[]>([]);
    const [studySetScore, setStudySetScore] = useState<any | null>(null);
    const [expandedImage, setExpandedImage] = useState<string | null>(null);

    useEffect(() => {
        fetchStudySet();
        fetchStudyMaterials();
        fetchQuizQuestions();
        fetchScores();
    }, [id]);

    const fetchStudySet = async () => {
        try {
            const { data, error } = await supabase
                .from("study_sets")
                .select("*")
                .eq("id", id)
                .single();

            if (error) {
                if (error.code === "PGRST116") {
                    // Study set not found (PostgreSQL not found error)
                    toast.error("Study set not found");
                    router.push("/");
                    return;
                }
                throw error;
            }

            if (!data) {
                // Another case where data might be null
                toast.error("Study set not found");
                router.push("/");
                return;
            }

            setStudySet(data);
            setStudySetName(data.name || `Study Set #${id}`);

            // If there's a file_path, get a URL for previewing
            if (data.file_path) {
                const { data: fileData } = await supabase.storage
                    .from("files")
                    .createSignedUrl(data.file_path, 60 * 60); // 1 hour expiry

                if (fileData) {
                    setFileUrl(fileData.signedUrl);
                }
            }
        } catch (error) {
            console.error("Error fetching study set:", error);
            toast.error("Failed to load study set");
            router.push("/");
        }
    };

    const updateStudySetName = async () => {
        if (!studySetName.trim()) {
            setStudySetName(`Study Set #${id}`);
            return;
        }

        try {
            setIsSavingName(true);
            const { error } = await supabase
                .from("study_sets")
                .update({ name: studySetName })
                .eq("id", id);

            if (error) throw error;

            toast.success("Study set name updated");
            setIsEditingName(false);

            // Update the local studySet data
            setStudySet({ ...studySet, name: studySetName });

            // Notify sidebar about the name change
            window.dispatchEvent(
                new CustomEvent("studySetUpdated", {
                    detail: { id, name: studySetName },
                }),
            );
        } catch (error) {
            console.error("Error updating study set name:", error);
            toast.error("Failed to update study set name");
        } finally {
            setIsSavingName(false);
        }
    };

    const fetchStudyMaterials = async () => {
        try {
            setIsLoading(true);

            // Check if the study set exists first
            const { data: studySetData, error: studySetError } = await supabase
                .from("study_sets")
                .select("id")
                .eq("id", id)
                .single();

            if (studySetError) {
                if (studySetError.code === "PGRST116") {
                    // Study set not found
                    toast.error("Study set not found");
                    router.push("/");
                    return;
                }
                throw studySetError;
            }

            if (!studySetData) {
                toast.error("Study set not found");
                router.push("/");
                return;
            }

            const { data: dbMaterials, error: dbError } = await supabase
                .from("study_materials")
                .select(`id, created_at, study_set`)
                .eq("study_set", id)
                .order("created_at", { ascending: false });

            if (dbError) throw dbError;

            const materials: StorageFile[] = [];

            for (const material of dbMaterials) {
                const { data: storageData, error: storageError } =
                    await supabase.storage
                        .from("study-materials")
                        .list(material.id, {
                            limit: 1,
                            sortBy: { column: "name", order: "asc" },
                        });

                if (storageError) {
                    console.error(
                        "Error getting files for material",
                        material.id,
                        storageError,
                    );
                    continue;
                }

                if (storageData && storageData.length > 0) {
                    const file = storageData[0];
                    // Extract file type - handle special case for converted PDFs
                    let fileType = file.name.split(".").pop() || "";
                    if (file.name.includes("-converted-to-pdf")) {
                        fileType = "pdf";
                    }

                    materials.push({
                        name: file.name,
                        id: material.id,
                        created_at: material.created_at,
                        type: fileType,
                    });
                }
            }

            setMaterials(materials);
        } catch (error) {
            console.error("Error fetching study materials:", error);
            toast.error("Failed to load study materials");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchQuizQuestions = async () => {
        try {
            const { data, error } = await supabase
                .from("quiz_questions")
                .select(
                    "id, question, category, options, answer, explanation, related_material",
                )
                .eq("study_set", id);

            if (error) throw error;

            // Format the questions with the structure expected by QuizDisplay
            const formattedQuestions = (data || []).map((q) => {
                // Parse options if it's a string
                let options = [];
                try {
                    options =
                        typeof q.options === "string"
                            ? JSON.parse(q.options)
                            : q.options || [];
                } catch (e) {
                    console.error(
                        "Error parsing options for question:",
                        q.id,
                        e,
                    );
                    options = [];
                }

                console.log(
                    `Question ${q.id}: answer=${q.answer}, answer="${q.answer}"`,
                );

                return {
                    id: q.id,
                    question: q.question,
                    options: options,
                    answer: q.answer,
                    explanation: q.explanation || "",
                    category: q.category,
                    related_material: q.related_material || null,
                };
            });

            setQuizQuestions(formattedQuestions);
            setHasQuizQuestions(formattedQuestions.length > 0);
        } catch (error) {
            console.error("Error fetching quiz questions:", error);
            toast.error("Failed to load quiz questions");
        }
    };

    const fetchScores = async () => {
        try {
            // Fetch study set score
            const { data: studySetData, error: studySetError } = await supabase
                .from("study_set_scores")
                .select("*")
                .eq("id", id)
                .single();

            if (studySetError && studySetError.code !== "PGRST116") {
                console.error("Error fetching study set score:", studySetError);
            } else if (studySetData) {
                console.log("Study set score data:", studySetData);
                setStudySetScore(studySetData);
            }

            // Fetch category scores for this study set
            const { data: quizData, error: quizError } = await supabase
                .from("quiz_questions")
                .select("category")
                .eq("study_set", id);

            if (quizError) {
                console.error("Error fetching quiz categories:", quizError);
                return;
            }

            console.log(
                "Raw quiz categories:",
                quizData.map((q) => q.category),
            );

            // Extract unique categories
            const categories = quizData
                .map((q) => q.category)
                .filter(
                    (value, index, self) =>
                        value && self.indexOf(value) === index,
                );

            console.log("Unique categories for study set:", categories);

            if (categories.length > 0) {
                const { data: catScores, error: catError } = await supabase
                    .from("category_scores")
                    .select("*")
                    .in("category_name", categories);

                if (catError) {
                    console.error("Error fetching category scores:", catError);
                } else if (catScores && catScores.length > 0) {
                    console.log("Retrieved category scores:", catScores);
                    setCategoryScores(catScores);
                } else {
                    console.log("No category scores found");
                    setCategoryScores([]);
                }
            } else {
                console.log("No categories found for this study set");
                setCategoryScores([]);
            }
        } catch (error) {
            console.error("Error fetching scores:", error);
        }
    };

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
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error("Please select a file to upload");
            return;
        }

        try {
            setIsUploading(true);

            // Step 1: Convert file if needed
            let fileToUpload = file;
            // Use a temporary name during conversion
            let tempFileName = file.name;
            let finalFileName = file.name;
            const isImageFile = file.type.includes("image/");

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
            // If the file needs conversion
            else if (
                file.type.includes("pdf") ||
                file.type.includes("vnd.openxmlformats")
            ) {
                setIsConverting(true);
                toast.info("Converting file for processing...");

                try {
                    const formData = new FormData();
                    formData.append("file", file);

                    const response = await axios.post(
                        "/api/convert-file",
                        formData,
                        {
                            headers: {
                                "Content-Type": "multipart/form-data",
                            },
                        },
                    );

                    if (response.data && response.data.convertedFile) {
                        const { convertedFile, fileName } = response.data;

                        // Convert base64 to Blob/File
                        const byteCharacters = atob(
                            convertedFile.split(",")[1],
                        );
                        const byteArrays = [];

                        for (
                            let offset = 0;
                            offset < byteCharacters.length;
                            offset += 512
                        ) {
                            const slice = byteCharacters.slice(
                                offset,
                                offset + 512,
                            );
                            const byteNumbers = new Array(slice.length);

                            for (let i = 0; i < slice.length; i++) {
                                byteNumbers[i] = slice.charCodeAt(i);
                            }

                            byteArrays.push(new Uint8Array(byteNumbers));
                        }

                        const blob = new Blob(byteArrays, {
                            type: "text/plain",
                        });

                        // Now that conversion is complete, determine the final filename
                        // Generate a timestamp to ensure uniqueness
                        const timestamp = new Date().getTime();

                        // Extract original extension
                        const originalExt = tempFileName.split(".").pop();

                        // Create a meaningful and unique filename
                        finalFileName =
                            fileName ||
                            `converted_${timestamp}.${originalExt || "txt"}`;

                        // Create a File object from the Blob
                        fileToUpload = new File([blob], finalFileName, {
                            type: "text/plain",
                        });

                        toast.success("File converted successfully");
                    }
                } catch (error: any) {
                    console.error("Error converting file:", error);
                    let errorMessage = "Failed to convert file";

                    // Try to extract a more detailed error message
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
                    // Stop the upload process as the conversion failed
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

            // Generate a unique folder ID for this file
            const folderId = uuidv4();
            const filePath = `${folderId}/${finalFileName}`;

            try {
                // Step 2: Upload the file to study-materials bucket
                const { error: uploadError } = await supabase.storage
                    .from("study-materials")
                    .upload(filePath, fileToUpload);

                if (uploadError) {
                    throw new Error(
                        `Upload failed: ${uploadError.message || JSON.stringify(uploadError)}`,
                    );
                }

                // Step 3: Create a database record for the study material
                const { error: studyMaterialError } = await supabase
                    .from("study_materials")
                    .insert({
                        id: folderId,
                        study_set: id,
                    });

                if (studyMaterialError) {
                    throw new Error(
                        `Failed to create study material: ${studyMaterialError.message || JSON.stringify(studyMaterialError)}`,
                    );
                }

                // Step 4: Also upload file to files bucket for GPT Vision access
                const filesPath = `${id}/${finalFileName}`;

                // Upload to files bucket
                const { error: filesUploadError } = await supabase.storage
                    .from("files")
                    .upload(filesPath, fileToUpload);

                if (filesUploadError) {
                    console.error(
                        "Error uploading to files bucket:",
                        filesUploadError.message ||
                            JSON.stringify(filesUploadError),
                    );
                    // Continue anyway since we have it in study-materials
                }

                toast.success("File uploaded successfully!");

                // Generate quiz questions if requested
                if (shouldGenerateQuiz) {
                    setIsGeneratingQuiz(true);
                    try {
                        toast.info("Generating quiz questions...");

                        // Step 5: Get a signed URL for the file (for GPT Vision to access)
                        let fileUrl = null;
                        if (isImageFile || isHeicFile(file)) {
                            const { data: urlData } = await supabase.storage
                                .from("files")
                                .createSignedUrl(filesPath, 60 * 60); // 1 hour expiry

                            fileUrl = urlData?.signedUrl;
                            console.log(
                                "Using signed URL for quiz generation:",
                                fileUrl ? "yes" : "no",
                            );
                        }

                        // Extract text content from the file
                        const fileContent = await extractTextFromFile(
                            URL.createObjectURL(fileToUpload),
                            fileToUpload.name,
                            fileToUpload.type,
                        );

                        // Send content to API for quiz generation
                        const quizFormData = new FormData();
                        quizFormData.append("file", fileToUpload);
                        quizFormData.append("studySetId", id as string);
                        quizFormData.append("numQuestions", "5"); // Default to 5 questions
                        quizFormData.append("fileName", finalFileName);
                        quizFormData.append("fileType", fileToUpload.type);
                        quizFormData.append("fileContent", fileContent);

                        // Add the file URL if available (for GPT Vision)
                        if (fileUrl) {
                            quizFormData.append("fileUrl", fileUrl);
                        }

                        const quizResponse = await axios.post(
                            "/api/generate-quiz",
                            quizFormData,
                        );
                        const quizData = quizResponse.data;

                        if (quizData.success) {
                            toast.success(
                                `Created ${quizData.count || 0} quiz questions!`,
                            );
                            fetchQuizQuestions();
                        }
                    } catch (quizError) {
                        console.error("Error generating quiz:", quizError);
                        toast.error("Failed to generate quiz questions");
                    } finally {
                        setIsGeneratingQuiz(false);
                    }
                } else {
                    toast.info(
                        "File uploaded without generating quiz questions",
                    );
                }

                setFile(null);
                fetchStudyMaterials();
            } catch (uploadError) {
                console.error(
                    "Error uploading file:",
                    uploadError instanceof Error
                        ? uploadError.message
                        : String(uploadError),
                );
                toast.error("File upload failed. Please try again.");
                setIsUploading(false);
                return;
            }
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

    const getFileIcon = (fileType: string) => {
        // Convert filename to lowercase and handle cases where type might include "-converted-to-pdf"
        const lowerType = fileType.toLowerCase();

        if (lowerType === "pdf" || lowerType.includes("pdf")) {
            return <FileIcon className="h-5 w-5 text-red-500" />;
        } else if (lowerType === "pptx") {
            return <FileIcon className="h-5 w-5 text-orange-500" />;
        } else if (
            lowerType === "png" ||
            lowerType === "jpeg" ||
            lowerType === "jpg" ||
            lowerType === "heic"
        ) {
            return <FileImage className="h-5 w-5 text-blue-500" />;
        } else if (lowerType === "docx") {
            return <FileText className="h-5 w-5 text-blue-700" />;
        } else {
            return <FileIcon className="h-5 w-5 text-gray-500" />;
        }
    };

    const getDownloadUrl = async (id: string, filename: string) => {
        const { data } = await supabase.storage
            .from("study-materials")
            .getPublicUrl(`${id}/${filename}`);

        return data.publicUrl;
    };

    const handleDownload = async (material: StorageFile) => {
        const url = await getDownloadUrl(material.id, material.name);
        window.open(url, "_blank");
    };

    const handlePreview = async (material: StorageFile) => {
        try {
            const url = await getDownloadUrl(material.id, material.name);

            // Check if it's a PDF or image file that can be previewed in the browser
            const lowerType = material.type.toLowerCase();
            const isPdfOrImage =
                lowerType === "pdf" ||
                lowerType === "png" ||
                lowerType === "jpg" ||
                lowerType === "jpeg";

            if (!isPdfOrImage) {
                // For non-previewable files, show a message and still open in new tab
                toast.info(
                    `Opening ${material.type.toUpperCase()} file in a new tab. You may need appropriate software to view it.`,
                );
            }

            window.open(url, "_blank");
        } catch (error) {
            console.error("Error getting file URL:", error);
            toast.error("Could not access file");
        }
    };

    const handleDelete = async (materialId: string) => {
        setDeleteId(materialId);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;

        try {
            setIsDeleting(true);

            // Find the material to delete
            const materialToDelete = materials.find((m) => m.id === deleteId);
            if (!materialToDelete) {
                throw new Error("Material not found");
            }

            // Delete the file from storage
            const { error: storageError } = await supabase.storage
                .from("study-materials")
                .remove([`${deleteId}/${materialToDelete.name}`]);

            if (storageError) {
                throw new Error(
                    `Failed to delete file: ${storageError.message}`,
                );
            }

            // Delete the study material record
            const { error: dbError } = await supabase
                .from("study_materials")
                .delete()
                .eq("id", deleteId);

            if (dbError) {
                throw new Error(
                    `Failed to delete study material: ${dbError.message}`,
                );
            }

            // If this was the last material, delete the study set
            if (materials.length === 1) {
                const { error: studySetError } = await supabase
                    .from("study_sets")
                    .delete()
                    .eq("id", id);

                if (studySetError) {
                    throw new Error(
                        `Failed to delete study set: ${studySetError.message}`,
                    );
                }

                toast.success("Study set deleted successfully!");

                // Notify sidebar about study set deletion
                window.dispatchEvent(
                    new CustomEvent("studySetDeleted", {
                        detail: { id },
                    }),
                );

                // Redirect to the study sets page
                window.location.href = "/";
                return;
            }

            toast.success("Material deleted successfully!");
            fetchStudyMaterials();
        } catch (error) {
            console.error("Error deleting material:", error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : "An unknown error occurred",
            );
        } finally {
            setIsDeleting(false);
            setDeleteId(null);
        }
    };

    const cancelDelete = () => {
        setDeleteId(null);
    };

    const startQuiz = () => {
        // Validate question count only when taking the quiz
        const count = parseInt(String(selectedQuestionCount));

        if (isNaN(count) || count < 1) {
            toast.error("Please select at least 1 question for the quiz");
            return;
        }

        if (count > quizQuestions.length) {
            toast.error(
                `You can only select up to ${quizQuestions.length} questions`,
            );
            return;
        }

        // Prepare quiz by selecting random questions if needed
        if (quizQuestions.length > 0) {
            try {
                let selectedQuestions = [];

                if (count >= quizQuestions.length) {
                    // Use all questions
                    selectedQuestions = [...quizQuestions];
                } else {
                    // Select random subset
                    const shuffled = [...quizQuestions].sort(
                        () => 0.5 - Math.random(),
                    );
                    selectedQuestions = shuffled.slice(0, count);
                }

                // Log what we're sending to the quiz component
                console.log("Starting quiz with questions:", selectedQuestions);

                // Verify that options and answers are properly set
                const hasValidQuestions = selectedQuestions.every(
                    (q) =>
                        Array.isArray(q.options) &&
                        q.options.length > 0 &&
                        q.answer &&
                        q.options.includes(q.answer),
                );

                if (!hasValidQuestions) {
                    console.error(
                        "Some questions have invalid options or answers",
                    );
                    toast.error(
                        "There's an issue with the quiz questions. Please try again.",
                    );
                    return;
                }

                setQuizQuestions2(selectedQuestions);
                setShowQuiz(true);
            } catch (error) {
                console.error("Error starting quiz:", error);
                toast.error(
                    "There was a problem starting the quiz. Please try again.",
                );
            }
        } else {
            toast.error("No questions available for quiz");
        }
    };

    const handleGenerateMoreQuestions = async () => {
        if (selectedDocuments.length === 0) {
            toast.error(
                "Please select at least one document to generate questions from",
            );
            return;
        }

        // Parse the question count
        const numQuestions = parseInt(String(questionGenerationCount));
        if (isNaN(numQuestions) || numQuestions < 1) {
            toast.error("Please enter a valid number of questions (minimum 1)");
            return;
        }

        setIsGeneratingQuiz(true);
        toast.info(`Generating ${numQuestions} quiz questions per document...`);

        try {
            // Process each selected document
            for (const documentId of selectedDocuments) {
                const material = materials.find((m) => m.id === documentId);
                if (!material) continue;

                toast.info(`Processing document: ${material.name}`);

                // Get the file from storage
                const { data: fileData, error: downloadError } =
                    await supabase.storage
                        .from("study-materials")
                        .download(`${material.id}/${material.name}`);

                if (downloadError || !fileData) {
                    console.error("Download error:", downloadError);
                    toast.error(`Failed to download file: ${material.name}`);
                    continue;
                }

                // Determine the file type
                const fileType = determineFileType(
                    material.type,
                    material.name,
                );
                console.log(`Document type: ${fileType} for ${material.name}`);

                // Create a File object
                let file = new File([fileData], material.name, {
                    type: fileType,
                });

                let finalFileName = material.name;

                // Check if it's a HEIC file and convert if needed
                if (isHeicFile(file)) {
                    toast.info("Converting HEIC file for processing...");
                    setIsConverting(true);

                    try {
                        // Try to convert HEIC to JPEG
                        try {
                            const convertedFile = await convertHeicToJpeg(file);
                            // Check if conversion was successful
                            if (convertedFile !== file) {
                                file = convertedFile;
                                finalFileName = convertedFile.name;
                                toast.success(
                                    "HEIC file converted successfully",
                                );
                            } else {
                                toast.warning(
                                    "HEIC conversion wasn't successful, using original file",
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
                            error instanceof Error
                                ? error.message
                                : String(error),
                        );
                    } finally {
                        setIsConverting(false);
                    }
                }

                // Upload converted file to files bucket for Vision API if it's an image
                let fileUrl = null;
                const isImageFile = file.type.includes("image/");

                if (isImageFile || isHeicFile(file)) {
                    // Create a path in the files bucket
                    const filesPath = `${id}/${finalFileName}`;

                    // Upload to files bucket for Vision API access
                    const { error: filesUploadError } = await supabase.storage
                        .from("files")
                        .upload(filesPath, file, { upsert: true });

                    if (filesUploadError) {
                        console.error(
                            "Error uploading to files bucket:",
                            filesUploadError.message ||
                                JSON.stringify(filesUploadError),
                        );
                    } else {
                        // Get a signed URL for the file (for Vision API)
                        const { data: urlData, error: urlError } =
                            await supabase.storage
                                .from("files")
                                .createSignedUrl(filesPath, 60 * 60); // 1 hour expiry

                        if (urlError) {
                            console.error("URL generation error:", urlError);
                        } else {
                            fileUrl = urlData?.signedUrl;
                            console.log(
                                `Got signed URL for files bucket: ${fileUrl ? "yes" : "no"}`,
                            );
                        }
                    }
                } else {
                    // For non-image files, still try to get a signed URL from study-materials
                    const { data: urlData, error: urlError } =
                        await supabase.storage
                            .from("study-materials")
                            .createSignedUrl(
                                `${material.id}/${material.name}`,
                                60 * 60,
                            );

                    if (urlError) {
                        console.error("URL generation error:", urlError);
                    } else {
                        fileUrl = urlData?.signedUrl;
                        console.log(
                            `Got signed URL for study-materials: ${fileUrl ? "yes" : "no"}`,
                        );
                    }
                }

                // Extract text content
                let fileContent = "";
                try {
                    fileContent = await extractTextFromFile(
                        URL.createObjectURL(file),
                        file.name,
                        file.type,
                    );
                    console.log(
                        `Extracted content length: ${fileContent.length} characters`,
                    );
                } catch (extractError) {
                    console.error("Error extracting text:", extractError);
                    // Continue anyway - the API might still work with Vision API
                }

                // Prepare form data
                const formData = new FormData();
                formData.append("file", file);
                formData.append("studySetId", id as string);
                formData.append("numQuestions", String(numQuestions));
                formData.append("fileName", finalFileName);
                formData.append("fileType", file.type);

                if (fileUrl) {
                    formData.append("fileUrl", fileUrl);
                    console.log("Added fileUrl to request");
                }

                if (fileContent && fileContent.length > 0) {
                    formData.append("fileContent", fileContent);
                    console.log("Added fileContent to request");
                }

                console.log(
                    `Sending request to generate questions for ${finalFileName}`,
                );

                // Send to API
                const response = await fetch("/api/generate-quiz", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`API error response: ${errorText}`);
                    toast.error(
                        `Failed to generate questions for ${material.name}: ${response.status}`,
                    );
                    continue;
                }

                const result = await response.json();
                console.log(`API success response:`, result);
                toast.success(
                    `Generated ${result.count || 0} questions from ${material.name}`,
                );
            }

            // Refresh questions
            fetchQuizQuestions();
            setShowMaterialsModal(false);
        } catch (error) {
            console.error("Error generating additional questions:", error);
            toast.error("Failed to generate additional questions");
        } finally {
            setIsGeneratingQuiz(false);
            setSelectedDocuments([]);
        }
    };

    // Helper function to determine the proper MIME type for files
    const determineFileType = (
        typeString: string,
        fileName: string,
    ): string => {
        // First check if the filename has extensions we can use
        const lowerFileName = fileName.toLowerCase();
        if (lowerFileName.endsWith(".pdf")) {
            return "application/pdf";
        } else if (lowerFileName.endsWith(".png")) {
            return "image/png";
        } else if (
            lowerFileName.endsWith(".jpeg") ||
            lowerFileName.endsWith(".jpg")
        ) {
            return "image/jpeg";
        } else if (lowerFileName.endsWith(".heic")) {
            return "image/heic";
        } else if (lowerFileName.endsWith(".docx")) {
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        } else if (lowerFileName.endsWith(".pptx")) {
            return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        }

        // Fall back to checking the type string
        const lowerType = typeString.toLowerCase();
        if (lowerType.includes("pdf")) {
            return "application/pdf";
        } else if (lowerType.includes("png")) {
            return "image/png";
        } else if (lowerType.includes("jpeg") || lowerType.includes("jpg")) {
            return "image/jpeg";
        } else if (lowerType.includes("heic")) {
            return "image/heic";
        } else if (lowerType.includes("docx")) {
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        } else if (lowerType.includes("pptx")) {
            return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        }

        // Default to PDF as most common
        return "application/pdf";
    };

    // Function to unlink a question from the study set
    const unlinkQuestion = async (questionId: string) => {
        try {
            setUnlinkingQuestion(questionId);
            const { error } = await supabase
                .from("quiz_questions")
                .update({ study_set: null })
                .eq("id", questionId);

            if (error) throw error;

            toast.success("Question unlinked from study set");
            fetchQuizQuestions();
        } catch (error) {
            console.error("Error unlinking question:", error);
            toast.error("Failed to unlink question");
        } finally {
            setUnlinkingQuestion(null);
        }
    };

    if (!studySet) {
        return (
            <div className="flex justify-center items-center h-full">
                <p>Loading study set...</p>
            </div>
        );
    }

    if (showQuiz) {
        return (
            <div className="container mx-auto py-8 space-y-6">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">
                        {studySet.name} - Quiz
                    </h1>
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}>
                        <Button onClick={() => setShowQuiz(false)}>
                            Back to Study Set
                        </Button>
                    </motion.div>
                </motion.div>
                <QuizDisplay
                    studySetId={id as string}
                    questions={
                        quizQuestions2.length > 0 ? quizQuestions2 : undefined
                    }
                    onComplete={(score, total) => {
                        // Don't show quiz results anymore
                        // setLastQuizScore({ score, total });
                        // setShowQuizResults(true);
                        setShowQuiz(false);
                        fetchScores(); // Still refresh scores after quiz completion
                    }}
                />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 space-y-6">
            {/* Header with study set name */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {isEditingName ? (
                        <div className="flex items-center gap-2">
                            <Input
                                value={studySetName}
                                onChange={(e) =>
                                    setStudySetName(e.target.value)
                                }
                                className="text-2xl font-bold h-12 w-[300px]"
                                placeholder="Enter study set name"
                                disabled={isSavingName}
                            />
                            <motion.div
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}>
                                <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={updateStudySetName}
                                    disabled={isSavingName}>
                                    <Check className="h-4 w-4" />
                                </Button>
                            </motion.div>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-3xl font-bold">
                                {studySet.name || `Study Set #${id}`}
                            </h1>
                            <motion.div
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setIsEditingName(true)}
                                    className="ml-2">
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </motion.div>
                        </>
                    )}
                </div>
                <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}>
                    <Button onClick={() => router.push("/")}>
                        Back to Dashboard
                    </Button>
                </motion.div>
            </motion.div>

            {/* Grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top left: Quiz card */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle>Quiz</CardTitle>
                            <CardDescription>
                                Test your knowledge with generated questions
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {hasQuizQuestions ? (
                                <motion.div
                                    className="space-y-4"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.4, delay: 0.4 }}>
                                    <p>
                                        This study set has{" "}
                                        {quizQuestions.length} questions
                                        available.
                                    </p>

                                    {/* Study set performance stats */}
                                    {studySetScore &&
                                        studySetScore.questions_solved > 0 && (
                                            <motion.div
                                                className="border rounded-lg p-3 bg-slate-50"
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{
                                                    duration: 0.5,
                                                    delay: 0.5,
                                                }}>
                                                <h3 className="text-sm font-medium mb-2">
                                                    Performance Stats
                                                </h3>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <p className="text-xs text-gray-500">
                                                            Correct
                                                        </p>
                                                        <p className="font-medium">
                                                            {
                                                                studySetScore.questions_right
                                                            }{" "}
                                                            /{" "}
                                                            {
                                                                studySetScore.questions_solved
                                                            }
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">
                                                            Success Rate
                                                        </p>
                                                        <p className="font-medium">
                                                            {(
                                                                (studySetScore.questions_right /
                                                                    studySetScore.questions_solved) *
                                                                100
                                                            ).toFixed(1)}
                                                            %
                                                        </p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                    <div className="flex flex-col space-y-3">
                                        <label
                                            htmlFor="questionCount"
                                            className="text-sm font-medium">
                                            Number of questions for quiz:
                                        </label>
                                        <div className="flex items-center space-x-2">
                                            <Input
                                                id="questionCount"
                                                type="number"
                                                value={selectedQuestionCount}
                                                onChange={(e) => {
                                                    const value =
                                                        e.target.value;
                                                    setSelectedQuestionCount(
                                                        value === ""
                                                            ? ""
                                                            : Number(value),
                                                    );
                                                }}
                                                className="w-24"
                                            />
                                            <span className="text-sm text-gray-500">
                                                of {quizQuestions.length} total
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Enter how many questions you want in
                                            your quiz.
                                        </p>
                                    </div>
                                    <motion.div
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}>
                                        <Button
                                            onClick={startQuiz}
                                            className="w-full">
                                            Take Quiz
                                        </Button>
                                    </motion.div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    className="text-center py-4"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.4, delay: 0.3 }}>
                                    <p className="mb-4">
                                        No quiz questions available yet.
                                    </p>
                                    {materials.length > 0 && (
                                        <motion.div
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}>
                                            <Button
                                                onClick={() =>
                                                    setShowMaterialsModal(true)
                                                }
                                                disabled={isGeneratingQuiz}>
                                                Generate Questions
                                            </Button>
                                        </motion.div>
                                    )}
                                </motion.div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Top right: Study materials/generate/add document */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle>Study Materials</CardTitle>
                            <CardDescription>
                                Manage your documents and generate questions
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <motion.div
                                className="flex flex-col space-y-4"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.4, delay: 0.4 }}>
                                <div className="flex justify-between items-center">
                                    <p className="text-sm">
                                        {materials.length === 0
                                            ? "No study materials uploaded yet"
                                            : `${materials.length} study materials available`}
                                    </p>
                                    {materials.length > 0 && (
                                        <motion.div
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setShowMaterialsModal(true)
                                                }
                                                className="flex items-center gap-2">
                                                <FolderOpen className="h-4 w-4" />
                                                View Materials
                                            </Button>
                                        </motion.div>
                                    )}
                                </div>

                                <div className="border-t pt-4">
                                    <p className="font-medium mb-3">
                                        Upload New Material
                                    </p>
                                    <div className="grid w-full items-center gap-1.5">
                                        <Input
                                            id="file"
                                            type="file"
                                            onChange={handleFileChange}
                                            accept=".pdf,.pptx,.png,.docx,.jpeg,.jpg,.heic"
                                            disabled={
                                                isUploading || isConverting
                                            }
                                        />
                                    </div>
                                    {file && (
                                        <motion.div
                                            className="text-sm mt-2"
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3 }}>
                                            Selected file:{" "}
                                            <span className="font-medium">
                                                {file.name}
                                            </span>
                                        </motion.div>
                                    )}
                                    <div className="flex items-center space-x-2 mt-3">
                                        <Checkbox
                                            id="generateQuiz"
                                            checked={shouldGenerateQuiz}
                                            onCheckedChange={(checked) =>
                                                setShouldGenerateQuiz(
                                                    checked === true,
                                                )
                                            }
                                        />
                                        <label
                                            htmlFor="generateQuiz"
                                            className="text-sm">
                                            Generate quiz questions from this
                                            file
                                        </label>
                                    </div>
                                </div>
                            </motion.div>
                        </CardContent>
                        <CardFooter>
                            <motion.div
                                className="w-full"
                                whileHover={
                                    !isUploading && !isConverting && file
                                        ? { scale: 1.03 }
                                        : {}
                                }
                                whileTap={
                                    !isUploading && !isConverting && file
                                        ? { scale: 0.97 }
                                        : {}
                                }>
                                <Button
                                    onClick={handleUpload}
                                    disabled={
                                        !file || isUploading || isConverting
                                    }
                                    className="w-full flex items-center gap-2">
                                    <UploadCloud className="h-5 w-5" />
                                    {isUploading
                                        ? "Uploading..."
                                        : isConverting
                                          ? "Converting..."
                                          : "Upload File"}
                                </Button>
                            </motion.div>
                        </CardFooter>
                    </Card>
                </motion.div>
            </div>

            {/* Bottom: Question set */}
            {quizQuestions.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.5 }}>
                    <Card className="col-span-1 md:col-span-2">
                        <CardHeader>
                            <CardTitle>Quiz Questions</CardTitle>
                            <CardDescription>
                                Manage questions in this study set. Click on a
                                question to view details.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                <AnimatePresence>
                                    {quizQuestions.map((question, index) => (
                                        <motion.div
                                            key={question.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{
                                                duration: 0.4,
                                                delay: index * 0.05,
                                            }}
                                            whileHover={{
                                                scale: 1.01,
                                                backgroundColor:
                                                    "rgba(240, 240, 240, 0.5)",
                                            }}
                                            className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                                            onClick={() =>
                                                setSelectedQuestion(question)
                                            }>
                                            <div>
                                                <p className="font-medium">
                                                    {question.question}
                                                </p>
                                                {question.category && (
                                                    <Badge
                                                        variant="outline"
                                                        className="mt-1">
                                                        {question.category}
                                                    </Badge>
                                                )}
                                            </div>
                                            <motion.div
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Prevent triggering the parent onClick
                                                    unlinkQuestion(question.id);
                                                }}>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={
                                                        unlinkingQuestion ===
                                                        question.id
                                                    }
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                                    {unlinkingQuestion ===
                                                    question.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        "Unlink from Study Set"
                                                    )}
                                                </Button>
                                            </motion.div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Study Materials Modal */}
            <Dialog
                open={showMaterialsModal}
                onOpenChange={setShowMaterialsModal}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Study Materials</DialogTitle>
                        <DialogDescription>
                            Select documents to generate questions or view
                            content
                        </DialogDescription>
                    </DialogHeader>

                    {isLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : materials.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500">
                                No materials uploaded yet
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                                Upload your first file using the upload form
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4 max-h-[400px] overflow-y-auto pr-2 py-4">
                            <AnimatePresence>
                                {materials.map((material, index) => (
                                    <motion.div
                                        key={material.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            duration: 0.3,
                                            delay: index * 0.05,
                                        }}
                                        className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50"
                                        whileHover={{
                                            scale: 1.01,
                                            boxShadow:
                                                "0 2px 5px rgba(0,0,0,0.05)",
                                        }}>
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id={`select-${material.id}`}
                                                checked={selectedDocuments.includes(
                                                    material.id,
                                                )}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedDocuments([
                                                            ...selectedDocuments,
                                                            material.id,
                                                        ]);
                                                    } else {
                                                        setSelectedDocuments(
                                                            selectedDocuments.filter(
                                                                (id) =>
                                                                    id !==
                                                                    material.id,
                                                            ),
                                                        );
                                                    }
                                                }}
                                            />
                                            <div className="flex-shrink-0 p-1.5 bg-gray-50 rounded">
                                                {getFileIcon(material.type)}
                                            </div>
                                            <div>
                                                <p className="font-medium">
                                                    {material.name}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(
                                                        material.created_at,
                                                    ).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <motion.div
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        handlePreview(material)
                                                    }
                                                    className="gap-1">
                                                    <Eye className="h-4 w-4" />
                                                    View
                                                </Button>
                                            </motion.div>
                                            <motion.div
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setShowMaterialsModal(
                                                            false,
                                                        );
                                                        handleDelete(
                                                            material.id,
                                                        );
                                                    }}
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </motion.div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}

                    <div className="py-2">
                        <div className="flex items-center gap-2 mb-4">
                            <label
                                htmlFor="generationCount"
                                className="text-sm whitespace-nowrap font-medium">
                                Questions per document:
                            </label>
                            <Input
                                id="generationCount"
                                type="number"
                                value={questionGenerationCount}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setQuestionGenerationCount(
                                        value === "" ? "" : Number(value),
                                    );
                                }}
                                className="w-24"
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex justify-between items-center">
                        <div className="text-sm text-gray-500">
                            {selectedDocuments.length} documents selected
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setShowMaterialsModal(false)}>
                                Cancel
                            </Button>
                            <motion.div
                                whileHover={
                                    !isGeneratingQuiz &&
                                    selectedDocuments.length > 0
                                        ? { scale: 1.05 }
                                        : {}
                                }
                                whileTap={
                                    !isGeneratingQuiz &&
                                    selectedDocuments.length > 0
                                        ? { scale: 0.95 }
                                        : {}
                                }>
                                <Button
                                    onClick={() => {
                                        handleGenerateMoreQuestions();
                                    }}
                                    disabled={
                                        isGeneratingQuiz ||
                                        selectedDocuments.length === 0
                                    }>
                                    {isGeneratingQuiz ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        "Generate Questions"
                                    )}
                                </Button>
                            </motion.div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog
                open={!!deleteId}
                onOpenChange={(open) => !open && cancelDelete()}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {materials.length === 1
                                ? "Delete Study Set?"
                                : "Delete Study Material?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {materials.length === 1
                                ? "This is the last material in this study set. Deleting it will also delete the entire study set. This action cannot be undone."
                                : "This will permanently delete the selected study material. This action cannot be undone."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white">
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Question Details Dialog */}
            <Dialog
                open={!!selectedQuestion}
                onOpenChange={(open) => !open && setSelectedQuestion(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Question Details</DialogTitle>
                    </DialogHeader>

                    {selectedQuestion && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-medium text-sm text-gray-500">
                                    Question:
                                </h3>
                                <p className="mt-1">
                                    {selectedQuestion.question}
                                </p>
                            </div>

                            <div>
                                <h3 className="font-medium text-sm text-gray-500">
                                    Options:
                                </h3>
                                <div className="mt-2 space-y-2">
                                    {Array.isArray(selectedQuestion.options) &&
                                        selectedQuestion.options.map(
                                            (option: string, i: number) => (
                                                <div
                                                    key={i}
                                                    className={`p-2 rounded-md ${option === selectedQuestion.answer ? "bg-green-50 border border-green-200" : "bg-gray-50"}`}>
                                                    <div className="flex items-start">
                                                        <div
                                                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 ${option === selectedQuestion.answer ? "bg-green-100 text-green-800" : "bg-gray-200"}`}>
                                                            {String.fromCharCode(
                                                                65 + i,
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p
                                                                className={
                                                                    option ===
                                                                    selectedQuestion.answer
                                                                        ? "font-medium text-green-800"
                                                                        : ""
                                                                }>
                                                                {option}
                                                            </p>
                                                            {option ===
                                                                selectedQuestion.answer && (
                                                                <p className="text-xs text-green-600 mt-1">
                                                                    Correct
                                                                    Answer
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ),
                                        )}
                                </div>
                            </div>

                            {selectedQuestion.explanation && (
                                <div>
                                    <h3 className="font-medium text-sm text-gray-500">
                                        Explanation:
                                    </h3>
                                    <p className="mt-1 text-sm">
                                        {selectedQuestion.explanation}
                                    </p>
                                </div>
                            )}

                            {selectedQuestion.related_material && (
                                <div>
                                    <h3 className="font-medium text-sm text-gray-500">
                                        Related Image:
                                    </h3>
                                    <div
                                        className="mt-2 overflow-hidden rounded-md border cursor-pointer transition-all hover:opacity-90"
                                        onClick={() =>
                                            setExpandedImage(
                                                selectedQuestion.related_material,
                                            )
                                        }>
                                        <img
                                            src={
                                                selectedQuestion.related_material
                                            }
                                            alt="Related material for question"
                                            className="w-full h-auto max-h-[300px] object-contain"
                                        />
                                    </div>
                                    <p className="text-xs text-center text-gray-500 mt-1">
                                        Click image to expand
                                    </p>
                                </div>
                            )}

                            {selectedQuestion.category && (
                                <div>
                                    <h3 className="font-medium text-sm text-gray-500">
                                        Category:
                                    </h3>
                                    <Badge
                                        variant="outline"
                                        className="mt-1">
                                        {typeof selectedQuestion.category ===
                                        "object"
                                            ? selectedQuestion.category.name
                                            : selectedQuestion.category}
                                    </Badge>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button onClick={() => setSelectedQuestion(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Expanded Image Dialog */}
            <Dialog
                open={!!expandedImage}
                onOpenChange={(open) => !open && setExpandedImage(null)}>
                <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-black/90">
                    <div className="relative">
                        <Button
                            variant="ghost"
                            className="absolute top-2 right-2 rounded-full bg-black/50 hover:bg-black/70 p-2 h-auto text-white"
                            onClick={() => setExpandedImage(null)}>
                            <X className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center justify-center p-2">
                            <img
                                src={expandedImage || ""}
                                alt="Expanded image"
                                className="max-h-[80vh] max-w-full object-contain"
                            />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
