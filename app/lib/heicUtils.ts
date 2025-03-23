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
 * Check if code is running in a browser environment
 */
function isBrowser(): boolean {
    return typeof window !== "undefined";
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
        if (!isBrowser()) {
            console.warn(
                "HEIC conversion attempted in a non-browser environment. Returning original file.",
            );
            return file;
        }

        console.log("Converting HEIC file to JPEG:", file.name);

        // Dynamically import heic2any only in browser environment
        const heic2any = (await import("heic2any")).default;

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
    } catch (error) {
        console.error("Error converting HEIC to JPEG:", error);
        // Return original file if conversion fails
        return file;
    }
}
