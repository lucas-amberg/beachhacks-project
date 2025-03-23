"use client";

// Remove the static import of heic2any
// We'll only import it dynamically when actually converting

/**
 * Check if a file is a HEIC image
 */
export function isHeicFile(file: File): boolean {
    return (
        file.type.toLowerCase().includes("heic") ||
        file.name.toLowerCase().endsWith(".heic")
    );
}

/**
 * Convert HEIC file to JPEG
 * @param file The HEIC file to convert
 * @param quality JPEG quality (0-1), defaults to 0.8
 * @returns A Promise that resolves to a JPEG File
 */
export async function convertHeicToJpeg(
    file: File,
    quality: number = 0.8,
): Promise<File> {
    try {
        // Check if we're in a browser environment
        if (typeof window === "undefined") {
            console.warn(
                "HEIC conversion attempted in a non-browser environment. Returning original file.",
            );
            return file;
        }

        console.log("Converting HEIC file to JPEG:", file.name);

        try {
            // Dynamically import heic2any only when needed
            const heic2anyModule = await import("heic2any");
            const heic2any = heic2anyModule.default;

            // Convert the HEIC file to a JPEG blob
            const jpegBlob = (await heic2any({
                blob: file,
                toType: "image/jpeg",
                quality,
            })) as Blob;

            // Create a new file with JPEG extension
            const newFileName = file.name.replace(/\.heic$/i, ".jpg");
            const convertedFile = new File([jpegBlob], newFileName, {
                type: "image/jpeg",
            });

            console.log("HEIC conversion successful. New file:", newFileName);
            return convertedFile;
        } catch (importError) {
            console.error(
                "Error importing or using heic2any library:",
                importError instanceof Error
                    ? importError.message
                    : String(importError),
            );
            return file;
        }
    } catch (error) {
        console.error(
            "Error in HEIC conversion process:",
            error instanceof Error ? error.message : String(error),
        );
        // Return original file if conversion fails
        return file;
    }
}
