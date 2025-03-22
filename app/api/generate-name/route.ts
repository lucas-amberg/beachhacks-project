import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getTextFromPDF } from "@/app/lib/extractText";

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract text from a file based on its type
 */
async function extractTextFromFile(file: File): Promise<string> {
    try {
        if (file.type.includes("pdf")) {
            return await getTextFromPDF(await file.arrayBuffer());
        } else {
            // Handle other file types like DOCX, PPTX, PNG
            return await file.text();
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
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json(
                { error: "File is required" },
                { status: 400 },
            );
        }

        console.log(`Generating name for file: ${file.name} (${file.type})`);

        // Extract text from the file
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
