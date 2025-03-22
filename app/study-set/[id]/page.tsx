"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import {
    UploadCloud,
    FileIcon,
    FileImage,
    FileText,
    Pencil,
    Check,
    Eye,
    Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
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

    useEffect(() => {
        fetchStudySet();
        fetchStudyMaterials();
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

    const handleUpload = async () => {
        if (!file) {
            toast.error("Please select a file to upload");
            return;
        }

        try {
            setIsUploading(true);
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
                    console.error("Conversion error:", conversionError);

                    // Check if the error is because LibreOffice is not installed
                    let errorMessage =
                        "Conversion failed. Please try uploading a PDF file directly.";

                    // If axios error has response data
                    if (conversionError.response) {
                        try {
                            // Try to convert the blob to JSON to check for specific error messages
                            const blob = conversionError.response.data;
                            const text = await blob.text();
                            const data = JSON.parse(text);

                            if (data.notInstalled) {
                                errorMessage =
                                    "LibreOffice is not installed on the server. Please install LibreOffice or upload PDFs directly.";

                                // Show installation instructions
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
                    // Stop the upload process as the conversion failed
                    setIsUploading(false);
                    setIsConverting(false);
                    return;
                } finally {
                    setIsConverting(false);
                }
            }

            // Generate a unique folder ID for this file
            const folderId = uuidv4();
            const filePath = `${folderId}/${fileName}`;

            // Upload the file to Supabase storage
            const { error: uploadError } = await supabase.storage
                .from("study-materials")
                .upload(filePath, fileToUpload);

            if (uploadError) {
                throw new Error(`Upload failed: ${uploadError.message}`);
            }

            // Create a database record for the study material
            const { error: studyMaterialError } = await supabase
                .from("study_materials")
                .insert({
                    id: folderId,
                    study_set: id,
                });

            if (studyMaterialError) {
                throw new Error(
                    `Failed to create study material: ${studyMaterialError.message}`,
                );
            }

            toast.success("File uploaded successfully!");
            setFile(null);
            fetchStudyMaterials();
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
        } else if (lowerType === "png") {
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

    if (!studySet) {
        return (
            <div className="flex justify-center items-center h-full">
                <p>Loading study set...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
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
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={updateStudySetName}
                                disabled={isSavingName}>
                                <Check className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-3xl font-bold">
                                {studySet.name || `Study Set #${id}`}
                            </h1>
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setIsEditingName(true)}
                                className="ml-2">
                                <Pencil className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
                <p className="text-sm text-gray-500">
                    Created: {new Date(studySet.created_at).toLocaleString()}
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Upload Study Material</CardTitle>
                        <CardDescription>
                            Add new materials to this study set. PPTX and DOCX
                            files will be automatically converted to PDF format.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="grid w-full max-w-sm items-center gap-1.5">
                                <Input
                                    id="file"
                                    type="file"
                                    onChange={handleFileChange}
                                    accept=".pdf,.pptx,.png,.docx"
                                    disabled={isUploading || isConverting}
                                />
                            </div>
                            {file && (
                                <div className="text-sm">
                                    Selected file:{" "}
                                    <span className="font-medium">
                                        {file.name}
                                    </span>
                                </div>
                            )}
                            <Button
                                onClick={handleUpload}
                                disabled={!file || isUploading || isConverting}
                                className="w-full flex items-center gap-2">
                                <UploadCloud className="h-5 w-5" />
                                {isUploading
                                    ? "Uploading..."
                                    : isConverting
                                      ? "Converting..."
                                      : "Upload File"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Study Materials</CardTitle>
                        <CardDescription>
                            All materials in this study set
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-40">
                                <p>Loading study materials...</p>
                            </div>
                        ) : materials.length === 0 ? (
                            <div className="flex flex-col justify-center items-center h-40 text-center">
                                <p className="text-gray-500">
                                    No materials in this study set yet
                                </p>
                                <p className="text-sm text-gray-400">
                                    Upload your first file using the form
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-2">
                                {materials.map((material) => (
                                    <Card
                                        key={material.id}
                                        className="overflow-hidden border-gray-200">
                                        <CardContent className="p-4">
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                <div className="flex items-center gap-3 min-w-0 w-full md:w-auto">
                                                    <div className="flex-shrink-0 p-1.5 bg-gray-50 rounded">
                                                        {getFileIcon(
                                                            material.type,
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1 md:max-w-[300px]">
                                                        <p className="font-medium truncate">
                                                            {material.name}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {new Date(
                                                                material.created_at,
                                                            ).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex-shrink-0 flex flex-row gap-2 w-full md:w-auto justify-start md:justify-end">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            handlePreview(
                                                                material,
                                                            )
                                                        }
                                                        className="gap-1 flex-none">
                                                        <Eye className="h-4 w-4" />
                                                        View
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleDownload(
                                                                material,
                                                            )
                                                        }
                                                        className="gap-1 flex-none">
                                                        Download
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleDelete(
                                                                material.id,
                                                            )
                                                        }
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1 flex-none">
                                                        <Trash2 className="h-4 w-4" />
                                                        Delete
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

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
        </div>
    );
}
