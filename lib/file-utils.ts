/**
 * Utility functions for handling files in the application
 */

import supabase from "./supabase";

/**
 * Extracts text from a file stored in Supabase Storage
 * @param fileUrl - URL of the file in Supabase Storage
 * @param fileName - Name of the file
 * @param fileType - MIME type of the file
 * @returns Promise with the extracted text content
 */
export async function extractTextFromFile(
    fileUrl: string,
    fileName: string,
    fileType: string,
): Promise<string> {
    try {
        // Download the file from Supabase storage
        const fileResponse = await fetch(fileUrl);

        if (!fileResponse.ok) {
            throw new Error(
                `Failed to download file: ${fileResponse.statusText}`,
            );
        }

        // Extract text based on file type
        if (fileType.includes("text/plain")) {
            // Plain text files
            return await fileResponse.text();
        } else if (fileType.includes("application/pdf")) {
            // For PDF files, we could use a PDF parsing library
            // This is a simplified version - in production, use a proper PDF parsing library
            const blob = await fileResponse.blob();
            return `PDF content from ${fileName}. In a real implementation, this would use a PDF parsing library.`;
        } else if (
            fileType.includes(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ) ||
            fileType.includes("application/msword")
        ) {
            // Word documents
            const blob = await fileResponse.blob();
            return `Word document content from ${fileName}. In a real implementation, this would use a Word document parsing library.`;
        } else if (
            fileType.includes(
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ) ||
            fileType.includes("application/vnd.ms-powerpoint")
        ) {
            // PowerPoint presentations
            const blob = await fileResponse.blob();
            return `PowerPoint presentation content from ${fileName}. In a real implementation, this would use a PowerPoint parsing library.`;
        } else if (fileType.startsWith("image/")) {
            // For images, we'd need OCR or image analysis
            return `Image content from ${fileName}. In a real implementation, this would use an OCR service.`;
        } else {
            // Generic fallback
            return await fileResponse.text();
        }
    } catch (error) {
        console.error("Error extracting text from file:", error);
        throw new Error("Failed to extract text from file");
    }
}

/**
 * Retrieves the file metadata and content from Supabase storage
 * @param studySetId - The ID of the study set
 * @returns Promise with the file content and metadata
 */
export async function getStudySetFileContent(
    studySetId: string | number,
): Promise<{
    content: string;
    fileName: string;
    fileType: string;
}> {
    try {
        // Get the file path from the study set
        const { data: studySet, error: studySetError } = await supabase
            .from("study_sets")
            .select("id, name, file_path, file_name, file_type")
            .eq("id", studySetId)
            .single();

        if (studySetError || !studySet) {
            throw new Error("Study set not found");
        }

        if (!studySet.file_path) {
            throw new Error("No file associated with this study set");
        }

        // Get a public URL for the file
        const { data: fileData } = await supabase.storage
            .from("files")
            .createSignedUrl(studySet.file_path, 60); // 60 seconds expiry

        if (!fileData?.signedUrl) {
            throw new Error("Failed to generate file URL");
        }

        // Extract text from the file
        const content = await extractTextFromFile(
            fileData.signedUrl,
            studySet.file_name || "unknown",
            studySet.file_type || "text/plain",
        );

        return {
            content,
            fileName: studySet.file_name || "unknown",
            fileType: studySet.file_type || "text/plain",
        };
    } catch (error) {
        console.error("Error retrieving study set file content:", error);
        throw error;
    }
}
