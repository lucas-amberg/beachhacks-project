import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getTextFromPDF } from "@/app/lib/extractText";
import { createClient } from "@supabase/supabase-js";

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Create a Supabase client for server-side operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
);

// Supported image file types
const SUPPORTED_IMAGE_TYPES = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/heic",
];

/**
 * Check if a file is an image based on its MIME type
 */
function isImageFile(fileType: string): boolean {
    return SUPPORTED_IMAGE_TYPES.some((type) =>
        fileType.toLowerCase().includes(type.split("/")[1]),
    );
}

/**
 * Check if a file is a HEIC image based on its MIME type or extension
 */
function isHeicFile(file: File): boolean {
    return (
        file.type.toLowerCase().includes("heic") ||
        file.name.toLowerCase().endsWith(".heic")
    );
}

/**
 * Upload image to Supabase Storage and get a public URL
 */
async function uploadImageToSupabase(file: File): Promise<string | null> {
    try {
        const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const fileName = `temp_${Date.now()}.${fileExt}`;
        const filePath = `temp-images/${fileName}`;

        const { data, error } = await supabase.storage
            .from("study-materials")
            .upload(filePath, file, {
                cacheControl: "3600",
                upsert: false,
            });

        if (error) {
            console.error("Error uploading image to Supabase Storage:", error);
            return null;
        }

        // Get public URL for the uploaded image
        const { data: urlData } = supabase.storage
            .from("study-materials")
            .getPublicUrl(filePath);

        return urlData.publicUrl;
    } catch (error) {
        console.error("Error in uploadImageToSupabase:", error);
        return null;
    }
}

/**
 * Process an image with GPT Vision API to generate a name
 */
async function processImageWithVision(imageUrl: string): Promise<string> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are an assistant that generates concise and descriptive titles for study materials. 
                    Create a brief (3-7 words) title for a study set based on the image content.
                    The title should be specific enough to be informative but brief enough to be a good title.
                    Do NOT use the phrase "Study Set" or "Study Guide" in your title.
                    Respond with ONLY the title - no explanations, quotes, or extra text.`,
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Generate a title based on this image content. The title should help a student remember what topic this image covers for studying. Be specific about the visible content.",
                        },
                        {
                            type: "image_url",
                            image_url: { url: imageUrl },
                        },
                    ],
                },
            ],
            max_tokens: 50,
            temperature: 0.7,
        });

        let generatedName = response.choices[0]?.message?.content?.trim() || "";

        // Remove any quotes from the response
        generatedName = generatedName.replace(/^["']|["']$/g, "");

        console.log(`Generated name from image: "${generatedName}"`);

        return generatedName;
    } catch (error) {
        console.error("Error processing image with Vision API:", error);
        throw error;
    }
}

/**
 * Extract text from a file based on its type
 */
async function extractTextFromFile(file: File): Promise<string> {
    try {
        if (file.type.includes("pdf")) {
            return await getTextFromPDF(await file.arrayBuffer());
        } else {
            // Handle other file types like DOCX, PPTX
            // For images, we'll use a different approach with Vision API
            if (!isImageFile(file.type)) {
                return await file.text();
            }
            return "";
        }
    } catch (error) {
        console.error("Error extracting text from file:", error);
        return "";
    }
}

/**
 * API route to generate a study set name based on document content
 */
export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        let file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json(
                { error: "File is required" },
                { status: 400 },
            );
        }

        console.log(`Generating name for file: ${file.name} (${file.type})`);

        // Check if file is HEIC - we'll log it but continue with original file
        // since HEIC conversion should happen client-side
        if (isHeicFile(file)) {
            console.log(
                "HEIC file detected on server. Using as is (client should convert).",
            );
        }

        // Check if the file is a PowerPoint or Word document
        const isPowerPoint =
            file.type.includes("presentation") ||
            file.name.toLowerCase().endsWith(".ppt") ||
            file.name.toLowerCase().endsWith(".pptx");
        const isWord =
            file.type.includes("wordprocessingml") ||
            file.name.toLowerCase().endsWith(".doc") ||
            file.name.toLowerCase().endsWith(".docx");

        // Use the filename without extension for PowerPoint and Word files
        if (isPowerPoint || isWord) {
            // Get filename without extension
            const fileNameWithoutExtension = file.name
                .split(".")
                .slice(0, -1)
                .join(".");
            console.log(
                `Using original filename for ${isPowerPoint ? "PowerPoint" : "Word"} file: "${fileNameWithoutExtension}"`,
            );
            return NextResponse.json({ name: fileNameWithoutExtension });
        }

        // Handle image files with Vision API
        if (isImageFile(file.type)) {
            try {
                // Upload the image to Supabase storage
                const imageUrl = await uploadImageToSupabase(file);

                if (!imageUrl) {
                    throw new Error("Failed to upload image to storage");
                }

                console.log(
                    "Image uploaded successfully for naming, URL:",
                    imageUrl,
                );

                // Process the image with Vision API
                const generatedName = await processImageWithVision(imageUrl);

                if (generatedName) {
                    // Clean up the temporary image after use
                    try {
                        // Extract the filename from the URL path
                        const pathSegments = new URL(imageUrl).pathname.split(
                            "/",
                        );
                        const filename = pathSegments[pathSegments.length - 1];
                        const filePath = `temp-images/${filename}`;

                        // Try to delete the temp file but don't fail if it doesn't work
                        supabase.storage
                            .from("study-materials")
                            .remove([filePath])
                            .then(() =>
                                console.log("Temp image deleted after naming"),
                            )
                            .catch((err) =>
                                console.log(
                                    "Note: Could not delete temp image",
                                    err,
                                ),
                            );
                    } catch (cleanupError) {
                        console.log(
                            "Could not clean up temporary image:",
                            cleanupError,
                        );
                    }

                    console.log(`Generated name: "${generatedName}"`);
                    return NextResponse.json({ name: generatedName });
                }
            } catch (imageError) {
                console.error("Error processing image for naming:", imageError);
                // Continue with standard processing if image processing fails
            }
        }

        // Extract text from the file (for non-image files)
        const textContent = await extractTextFromFile(file);

        // If no text was extracted, return a generic name
        if (!textContent || textContent.length < 50) {
            console.log(
                "Insufficient text content extracted, using generic name",
            );
            return NextResponse.json({
                name: `Study Set - ${new Date().toLocaleDateString()}`,
            });
        }

        // Use a smaller chunk of the text for the prompt (first 1000 chars)
        const contentSummary = textContent.substring(0, 1000);

        // Generate a name using OpenAI
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are an assistant that generates concise and descriptive titles for study materials. 
          Create a brief (3-7 words) title for a study set based on the document's content.
          The title should be specific enough to be informative but brief enough to be a good title.
          Do NOT use the phrase "Study Set" or "Study Guide" in your title.
          Respond with ONLY the title - no explanations, quotes, or extra text.`,
                },
                {
                    role: "user",
                    content: `Generate a title based on this document content:\n\n${contentSummary}`,
                },
            ],
            max_tokens: 50,
            temperature: 0.7,
        });

        let generatedName =
            completion.choices[0]?.message?.content?.trim() || "";

        // Remove any quotes from the response
        generatedName = generatedName.replace(/^["']|["']$/g, "");

        // Fallback if OpenAI didn't generate a name
        if (!generatedName) {
            generatedName = `Study Set - ${new Date().toLocaleDateString()}`;
        }

        console.log(`Generated name: "${generatedName}"`);

        return NextResponse.json({ name: generatedName });
    } catch (error) {
        console.error("Error generating name:", error);
        return NextResponse.json(
            {
                error: "Failed to generate name",
                name: `Study Set - ${new Date().toLocaleDateString()}`,
            },
            { status: 500 },
        );
    }
}
