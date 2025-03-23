import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getTextFromPDF } from "../../../app/lib/extractText";
import { createQuizResponseSchemaWithCount } from "@/lib/schemas";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Define a schema specifically for the OpenAI response
const QuizQuestionResponseSchema = z.object({
    question: z
        .string()
        .describe("The question text, should be unique and descriptive"),
    options: z
        .array(z.string())
        .describe("Array of 4 possible answers as strings"),
    answer: z
        .string()
        .describe(
            "The exact text of the correct option (must match one of the options exactly)",
        ),
    explanation: z
        .string()
        .describe("Brief explanation of why the answer is correct"),
    category: z
        .string()
        .describe("A category or topic that this question belongs to"),
    include_image: z
        .boolean()
        .optional()
        .describe("Whether to include the original image with this question"),
});

// Create a schema for the array of questions without min/max validation
const createQuizArraySchema = (count: number) =>
    z
        .object({
            quiz_questions: z
                .array(QuizQuestionResponseSchema)
                .describe(
                    `Multiple-choice quiz questions (should be exactly ${count})`,
                ),
        })
        .describe("Quiz questions response");

// Create a Supabase client for server-side operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
);

// Maximum content length to send to OpenAI at once (characters)
const MAX_CONTENT_LENGTH = 3000;

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
async function uploadImageToSupabase(
    file: File,
    studySetId: string,
): Promise<string | null> {
    try {
        const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const fileName = `${studySetId}_${Date.now()}.${fileExt}`;
        const filePath = `quiz-images/${fileName}`;

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
 * Process an image with GPT Vision API and generate quiz questions
 */
async function processImageWithVision(
    imageUrl: string,
    numQuestions: number,
): Promise<any[]> {
    try {
        // Create a schema for validation
        const schema = createQuizArraySchema(numQuestions);

        const response = await openai.beta.chat.completions.parse({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are a helpful assistant that creates educational quiz questions based on image content.
            Carefully analyze the image.
            
            *** CRITICAL INSTRUCTION: Create EXACTLY ${numQuestions} multiple-choice questions. No more, no less. ***
            
            Each question should:
            - Be unique and test different aspects of the content
            - Have exactly 4 answer options that are CLEARLY DISTINCT from each other
            - Have ONLY ONE clearly correct answer - the other 3 should be clearly incorrect
            - Ensure incorrect options are plausible but definitively wrong
            - Be based on what you can see in the image
            
            Format each question with these fields:
            - question: The question text
            - options: Array of 4 possible answers (MUST be substantially different from each other)
            - answer: The EXACT text of the correct option (must match one of the options exactly)
            - explanation: Brief explanation of why the answer is correct AND why the other options are incorrect
            - category: A topic category this question belongs to
            - include_image: Set to true if seeing the image is essential to answer this question (e.g., "What color is the object in the image?"), false if the question can be answered without seeing the image
            
            DO NOT create duplicate questions or slight variations of the same question.
            DO NOT create options that could all be partially correct or similar to each other.
            DO NOT include multiple correct answers or options that are variations of the same answer.
            
            Your response must be a JSON object with a 'quiz_questions' array containing EXACTLY ${numQuestions} questions.`,
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analyze this image and create EXACTLY ${numQuestions} unique multiple-choice questions about its content. 
                            
This is a strict requirement - I need exactly ${numQuestions} questions, no more and no less.

Each question should have 4 answer options that are clearly different from each other, with ONLY ONE correct answer.
Make sure the 'answer' field contains the exact text of the correct option.
The incorrect options should be clearly wrong but plausible enough to be challenging.
DO NOT create options that are all partially correct or just variations of the same answer.

For each question, determine if seeing the image is essential to answer it correctly. If so, set include_image to true.
For example, if the question asks "What color is the main object in the image?", include_image should be true.
If the question can be answered without seeing the image, set include_image to false.

Focus only on the image's actual content.`,
                        },
                        {
                            type: "image_url",
                            image_url: { url: imageUrl },
                        },
                    ],
                },
            ],
            max_tokens: 4000,
            response_format: zodResponseFormat(schema, "quiz_questions"),
        });

        console.log(
            "Vision API response received for image, length:",
            response.choices[0]?.message?.content?.length || 0,
        );

        const responseText = response.choices[0]?.message?.content || "{}";
        let questions = [];

        try {
            const parsedResponse = JSON.parse(responseText);

            // With the updated schema, we should always have a quiz_questions array property
            if (
                parsedResponse.quiz_questions &&
                Array.isArray(parsedResponse.quiz_questions)
            ) {
                questions = parsedResponse.quiz_questions;
                console.log(
                    "Vision response has quiz_questions array with",
                    questions.length,
                    "questions",
                );
            }
            // Handle direct array for backward compatibility
            else if (Array.isArray(parsedResponse)) {
                questions = parsedResponse;
                console.log(
                    "Vision response is a direct array with",
                    questions.length,
                    "questions",
                );
            }
            // Handle 'questions' property for backward compatibility
            else if (
                parsedResponse.questions &&
                Array.isArray(parsedResponse.questions)
            ) {
                questions = parsedResponse.questions;
                console.log(
                    "Vision response has questions array with",
                    questions.length,
                    "questions",
                );
            } else {
                console.error(
                    "Invalid Vision API response format:",
                    parsedResponse,
                );
                questions = [];
            }
        } catch (jsonError) {
            console.error("Error parsing Vision API response:", jsonError);
            questions = [];
        }

        return questions;
    } catch (error) {
        console.error("Error processing image with Vision API:", error);
        throw error;
    }
}

/**
 * Clean the AI response to ensure valid JSON
 */
function cleanJsonResponse(response: string): string {
    // Remove markdown code blocks that GPT tends to add
    let cleaned = response.replace(/```json|```/g, "").trim();

    // If the response starts with a newline and square bracket, remove everything before it
    const bracketIndex = cleaned.indexOf("[");
    if (bracketIndex > 0) {
        cleaned = cleaned.substring(bracketIndex);
    }

    return cleaned;
}

/**
 * Get a summary of the document to provide context for each chunk
 */
function getDocumentSummary(
    fileContent: string,
    maxLength: number = 500,
): string {
    // Get the first part of the document as a summary
    const firstPart = fileContent.substring(
        0,
        Math.min(fileContent.length, 1000),
    );

    // Remove excessive whitespace and PDF metadata tags
    const cleaned = firstPart
        .replace(/\s+/g, " ")
        .replace(/%PDF-\d+\.\d+/g, "")
        .replace(/^\s+/, "")
        .trim();

    // Truncate if needed
    return cleaned.length > maxLength
        ? cleaned.substring(0, maxLength) + "..."
        : cleaned;
}

// Helper to find or create a category
async function findOrCreateCategory(
    categoryName: string,
    questionText?: string,
): Promise<string | null> {
    try {
        // Check if category exists
        const { data: existingCategory, error: findError } = await supabase
            .from("categories")
            .select("name, subject")
            .eq("name", categoryName)
            .single();

        if (!findError && existingCategory) {
            return existingCategory.name;
        }

        // Use GPT to infer the university major (subject) based primarily on the question text
        const subject = await inferSubjectFromQuestion(
            questionText || "",
            categoryName,
        );

        // Create new subject if it doesn't exist
        if (subject) {
            // Check if subject already exists
            const { data: existingSubject } = await supabase
                .from("subjects")
                .select("subject")
                .eq("subject", subject)
                .single();

            // Create subject if it doesn't exist
            if (!existingSubject) {
                const { error: subjectError } = await supabase
                    .from("subjects")
                    .insert({ subject });

                if (subjectError) {
                    console.error("Error creating subject:", subjectError);
                }
            }
        }

        // Create new category with the inferred subject
        const { data: newCategory, error: createError } = await supabase
            .from("categories")
            .insert({
                name: categoryName,
                subject: subject || null,
            })
            .select("name")
            .single();

        if (createError) {
            console.error("Error creating category:", createError);
            return null;
        }

        return newCategory.name;
    } catch (error) {
        console.error("Error finding or creating category:", error);
        return null;
    }
}

/**
 * Use GPT to infer a university major (subject) based primarily on the question text
 * with the category as additional context
 */
async function inferSubjectFromQuestion(
    questionText: string,
    categoryName: string,
): Promise<string | null> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are a helpful assistant that categorizes educational topics into university majors.
                    Given a quiz question and its category, determine which university major it would most likely fall under.
                    Be specific but concise. Return only the name of the major without any explanation or additional text.
                    Examples:
                    - For a question about linear algebra (category: Mathematics), return "Mathematics"
                    - For a question about the American Civil War (category: US History), return "History"
                    - For a question about Shakespeare's plays (category: Literature), return "English Literature"
                    - For a question about Python programming (category: Programming), return "Computer Science"
                    - For a question about quantum mechanics (category: Physics), return "Physics"
                    - For a question about DNA replication (category: Biology), return "Biology"
                    - For a question about marketing strategies (category: Business), return "Marketing"
                    Return a single word or short phrase representing the university major.`,
                },
                {
                    role: "user",
                    content: `What university major would this quiz question fall under?
                    
                    Question: "${questionText}"
                    Category: ${categoryName}
                    
                    Respond with just the name of the major.`,
                },
            ],
            temperature: 0.3,
            max_tokens: 50,
        });

        let subject = response.choices[0]?.message?.content?.trim();

        // Clean up the response if needed
        if (subject) {
            // Remove any quotation marks, periods, or other formatting
            subject = subject.replace(/['"\.]/g, "");

            // If the response is too verbose, truncate it
            if (subject.includes(" ")) {
                // If there's explanation text, try to extract just the major
                const words = subject.split(" ");
                if (words.length > 4) {
                    // If it's a long response, take just the first few words
                    subject = words.slice(0, 3).join(" ");
                }
            }

            console.log(
                `Inferred subject "${subject}" for question about "${questionText.substring(0, 30)}..." (category: ${categoryName})`,
            );
            return subject;
        }

        return null;
    } catch (error) {
        console.error("Error inferring subject from question:", error);
        return null;
    }
}

/**
 * Check if two strings are too similar based on character overlap
 */
function areTooSimilar(str1: string, str2: string): boolean {
    // Convert to lowercase and trim whitespace for better comparison
    const a = str1.toLowerCase().trim();
    const b = str2.toLowerCase().trim();

    // If the strings are very short, be more strict
    if (a.length < 10 || b.length < 10) {
        return a === b || a.includes(b) || b.includes(a);
    }

    // Calculate similarity using Levenshtein distance
    const maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return true;

    // Simple version of similarity check
    let sameChars = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] === b[i]) sameChars++;
    }

    const similarityRatio = sameChars / maxLength;

    // If more than 70% similar, consider them too similar
    return similarityRatio > 0.7;
}

/**
 * Generate an alternative incorrect option related to the topic
 */
function generateAlternativeOption(
    question: string,
    existingOptions: string[],
    topicHint: string,
): string {
    // Create some alternatives based on the question
    const options = [
        `A different aspect of ${topicHint}`,
        `Unrelated concept to ${topicHint}`,
        `Opposite of the correct answer`,
        `Common misconception about ${topicHint}`,
    ];

    // Select one that doesn't match existing options
    for (const option of options) {
        let isSimilar = false;
        for (const existing of existingOptions) {
            if (areTooSimilar(option, existing)) {
                isSimilar = true;
                break;
            }
        }
        if (!isSimilar) return option;
    }

    // If all are similar, add a number to make it unique
    return `Alternative ${existingOptions.length + 1}: ${topicHint}`;
}

export async function POST(request: Request) {
    // Add timeout to avoid API hanging
    let timeout = setTimeout(
        () => {
            console.log("Request timeout after 5 minutes");
        },
        5 * 60 * 1000,
    );

    try {
        const formData = await request.formData();
        console.log("Form data received, processing request...");

        let file = formData.get("file") as File | null;
        const studySetId = formData.get("studySetId") as string;
        const numQuestions = Number(formData.get("numQuestions") || "5");
        const fileName = file
            ? file.name
            : (formData.get("fileName") as string);
        let fileType = file ? file.type : (formData.get("fileType") as string);
        const fileUrl = formData.get("fileUrl") as string;
        let fileContent = formData.get("fileContent") as string;
        const documentsJson = (formData.get("documents") as string) || "[]";
        const documents = JSON.parse(documentsJson);

        if (!studySetId) {
            clearTimeout(timeout);
            return NextResponse.json(
                { error: "Study set ID is required" },
                { status: 400 },
            );
        }

        // Must have either file, fileUrl, or content
        if (
            !file &&
            !fileUrl &&
            !fileContent &&
            (!documents || documents.length === 0)
        ) {
            clearTimeout(timeout);
            return NextResponse.json(
                { error: "No content provided to generate quiz" },
                { status: 400 },
            );
        }

        let imageUrl = "";

        console.log(
            "Processing file:",
            fileName,
            fileType,
            "Content length:",
            fileContent?.length || 0,
        );

        // Check if file is HEIC - we'll log it but continue with original file
        // since HEIC conversion should happen client-side
        if (file && isHeicFile(file)) {
            console.log(
                "HEIC file detected on server. Using as is (client should convert).",
            );
            // Note: The client should have already converted HEIC files before uploading
        }

        // Handle Image Files (PNG, JPEG, HEIC)
        if (file && isImageFile(fileType)) {
            console.log("Processing image file:", fileName, fileType);

            try {
                // Upload the image to Supabase storage
                imageUrl =
                    (await uploadImageToSupabase(file, studySetId)) || "";

                if (!imageUrl) {
                    throw new Error("Failed to upload image to storage");
                }

                console.log("Image uploaded successfully, URL:", imageUrl);

                // Process the image with Vision API
                const questions = await processImageWithVision(
                    imageUrl,
                    numQuestions,
                );

                if (questions && questions.length > 0) {
                    console.log(
                        `Saving ${questions.length} questions from image analysis...`,
                    );
                    await saveQuizQuestions(questions, studySetId, imageUrl);
                    clearTimeout(timeout);
                    return NextResponse.json({
                        success: true,
                        message: "Quiz generated successfully from image",
                        count: questions.length,
                    });
                } else {
                    throw new Error("No questions generated from image");
                }
            } catch (imageError) {
                console.error("Error processing image:", imageError);
                // Continue with standard processing if image processing fails
            }
        }

        try {
            if (fileUrl && fileType.toLowerCase().includes("pdf")) {
                console.log(
                    "Using Vision API for PDF analysis, URL length:",
                    fileUrl?.length || 0,
                );
                // Use Vision API for PDF files when URL is available
                try {
                    console.log("Calling Vision API...");

                    // Create a schema for validation
                    const schema = createQuizArraySchema(numQuestions);

                    const response = await openai.beta.chat.completions.parse({
                        model: "gpt-4-vision-preview",
                        messages: [
                            {
                                role: "system",
                                content: `You are a helpful assistant that creates educational quiz questions based on document content.
                Carefully analyze the CONTENT of the document (not its format or metadata).
                
                *** CRITICAL INSTRUCTION: Create EXACTLY ${numQuestions} multiple-choice questions. No more, no less. ***
                
                Each question should:
                - Be unique and test different aspects of the content
                - Have exactly 4 answer options that are CLEARLY DISTINCT from each other
                - Have ONLY ONE clearly correct answer - the other 3 should be clearly incorrect
                - Ensure incorrect options are plausible but definitively wrong
                - Be based on actual information in the document
                
                Format each question with these fields:
                - question: The question text
                - options: Array of 4 possible answers (MUST be substantially different from each other)
                - answer: The EXACT text of the correct option (must match one of the options exactly)
                - explanation: Brief explanation of why the answer is correct AND why the other options are incorrect
                - category: A topic category this question belongs to
                
                DO NOT create duplicate questions or slight variations of the same question.
                DO NOT create options that could all be partially correct or similar to each other.
                DO NOT include multiple correct answers or options that are variations of the same answer.
                
                Your response must be a JSON object with a 'quiz_questions' array containing EXACTLY ${numQuestions} questions.`,
                            },
                            {
                                role: "user",
                                content: [
                                    {
                                        type: "text",
                                        text: `Analyze this document and create EXACTLY ${numQuestions} unique multiple-choice questions about its content. 
                                        
This is a strict requirement - I need exactly ${numQuestions} questions, no more and no less.

Each question should have 4 answer options that are clearly different from each other, with ONLY ONE correct answer.
Make sure the 'answer' field contains the exact text of the correct option.
The incorrect options should be clearly wrong but plausible enough to be challenging.
DO NOT create options that are all partially correct or just variations of the same answer.

Focus only on the document's actual content - don't reference the file format or metadata.`,
                                    },
                                    {
                                        type: "image_url",
                                        image_url: { url: fileUrl },
                                    },
                                ],
                            },
                        ],
                        max_tokens: 4000,
                        response_format: zodResponseFormat(
                            schema,
                            "quiz_questions",
                        ),
                    });

                    console.log(
                        "Vision API response received, length:",
                        response.choices[0]?.message?.content?.length || 0,
                    );

                    const responseText =
                        response.choices[0]?.message?.content || "{}";
                    let questions = [];

                    try {
                        const parsedResponse = JSON.parse(responseText);

                        // With the updated schema, we should always have a quiz_questions array property
                        if (
                            parsedResponse.quiz_questions &&
                            Array.isArray(parsedResponse.quiz_questions)
                        ) {
                            questions = parsedResponse.quiz_questions;
                            console.log(
                                "Vision response has quiz_questions array with",
                                questions.length,
                                "questions",
                            );
                        }
                        // Handle direct array for backward compatibility
                        else if (Array.isArray(parsedResponse)) {
                            questions = parsedResponse;
                            console.log(
                                "Vision response is a direct array with",
                                questions.length,
                                "questions",
                            );
                        }
                        // Handle 'questions' property for backward compatibility
                        else if (
                            parsedResponse.questions &&
                            Array.isArray(parsedResponse.questions)
                        ) {
                            questions = parsedResponse.questions;
                            console.log(
                                "Vision response has questions array with",
                                questions.length,
                                "questions",
                            );
                        } else {
                            console.error(
                                "Invalid Vision API response format:",
                                parsedResponse,
                            );
                            questions = [];
                        }

                        // Check if we have enough questions regardless of schema validation
                        if (Array.isArray(questions)) {
                            if (questions.length === numQuestions) {
                                console.log(
                                    `Perfect! Got exactly ${questions.length} questions from Vision API as requested.`,
                                );
                            } else if (questions.length > numQuestions) {
                                console.log(
                                    `Got ${questions.length} questions from Vision API, trimming to ${numQuestions} as requested.`,
                                );
                                questions = questions.slice(0, numQuestions);
                            } else if (questions.length > 0) {
                                console.warn(
                                    `Only got ${questions.length}/${numQuestions} questions from Vision API, will use what we have.`,
                                );
                            } else {
                                console.error(
                                    "No valid questions in the Vision API response.",
                                );
                                // Fall back to text extraction
                                return;
                            }

                            console.log(
                                `Saving ${questions.length} questions from Vision API...`,
                            );
                            await saveQuizQuestions(
                                questions,
                                studySetId,
                                imageUrl,
                            );
                            clearTimeout(timeout);
                            return NextResponse.json({
                                success: true,
                                message:
                                    "Quiz generated successfully with Vision API",
                                count: questions.length,
                            });
                        }
                    } catch (jsonError) {
                        console.error(
                            "Error parsing Vision API response:",
                            jsonError,
                        );
                    }
                } catch (visionError) {
                    console.error("Error using Vision API:", visionError);
                }
            }

            // Fall back to text extraction if Vision API fails or isn't available
            if (file && !fileContent) {
                console.log("Extracting text from file...");
                try {
                    if (fileType.toLowerCase().includes("pdf")) {
                        fileContent = await getTextFromPDF(
                            await file.arrayBuffer(),
                        );
                    } else if (isImageFile(fileType)) {
                        // For image files, try to upload to Supabase and use Vision API if we haven't already
                        if (!imageUrl) {
                            imageUrl =
                                (await uploadImageToSupabase(
                                    file,
                                    studySetId,
                                )) || "";

                            if (imageUrl) {
                                console.log(
                                    "Image uploaded successfully, URL:",
                                    imageUrl,
                                );

                                // Process the image with Vision API
                                const questions = await processImageWithVision(
                                    imageUrl,
                                    numQuestions,
                                );

                                if (questions && questions.length > 0) {
                                    console.log(
                                        `Saving ${questions.length} questions from image analysis...`,
                                    );
                                    await saveQuizQuestions(
                                        questions,
                                        studySetId,
                                        imageUrl,
                                    );
                                    clearTimeout(timeout);
                                    return NextResponse.json({
                                        success: true,
                                        message:
                                            "Quiz generated successfully from image (fallback path)",
                                        count: questions.length,
                                    });
                                }
                            }
                        }

                        // If image processing failed, set empty content so it's handled gracefully
                        if (!fileContent) {
                            fileContent =
                                "Image could not be processed as text.";
                        }
                    } else {
                        // Handle other file types or use text directly
                        fileContent = await file.text();
                    }
                    console.log(
                        "Text extraction complete, content length:",
                        fileContent?.length || 0,
                    );
                } catch (extractError) {
                    console.error("Error extracting text:", extractError);
                }
            }

            // If we still need to generate questions using the text content
            if (fileContent) {
                console.log(
                    "Using text content for quiz generation, length:",
                    fileContent.length,
                );

                // Try with progressively shorter content if needed
                let contentToUse = fileContent;
                let attempt = 1;
                const maxAttempts = 3;

                while (attempt <= maxAttempts) {
                    const maxLength =
                        attempt === 1 ? 14000 : attempt === 2 ? 8000 : 4000;
                    contentToUse = fileContent.substring(0, maxLength);

                    console.log(
                        `Attempt ${attempt}/${maxAttempts} with content length: ${contentToUse.length}`,
                    );

                    try {
                        console.log(
                            `Calling text-based GPT API (attempt ${attempt})...`,
                        );

                        // Create a schema for OpenAI response validation
                        const schema = createQuizArraySchema(numQuestions);

                        const completion =
                            await openai.beta.chat.completions.parse({
                                model: "gpt-4o-2024-08-06",
                                messages: [
                                    {
                                        role: "system",
                                        content: `You are a helpful assistant that creates educational quiz questions based on document content.
                  
                  *** CRITICAL INSTRUCTION: Create EXACTLY ${numQuestions} multiple-choice questions. No more, no less. ***
                  
                  Each question should:
                  - Be unique and test different aspects of the content
                  - Have exactly 4 answer options that are CLEARLY DISTINCT from each other
                  - Have ONLY ONE clearly correct answer - the other 3 should be clearly incorrect
                  - Ensure incorrect options are plausible but definitively wrong
                  - Be based on actual information in the document
                  
                  Format each question with these fields:
                  - question: The question text
                  - options: Array of 4 possible answers (MUST be substantially different from each other)
                  - answer: The EXACT text of the correct option (must match one of the options exactly)
                  - explanation: Brief explanation of why the answer is correct AND why the other options are incorrect
                  - category: A topic category this question belongs to
                  
                  DO NOT create duplicate questions or slight variations of the same question.
                  DO NOT create options that could all be partially correct or similar to each other.
                  DO NOT include multiple correct answers or options that are variations of the same answer.
                  
                  Your response must be a JSON object with a 'quiz_questions' array containing EXACTLY ${numQuestions} questions.`,
                                    },
                                    {
                                        role: "user",
                                        content: `Create EXACTLY ${numQuestions} unique multiple-choice questions based on this content:
                  
                  ${contentToUse}
                  
This is a strict requirement - I need exactly ${numQuestions} questions, no more and no less.

Each question should have 4 answer options that are clearly different from each other, with ONLY ONE correct answer.
Make sure the 'answer' field contains the exact text of the correct option.
The incorrect options should be clearly wrong but plausible enough to be challenging.
DO NOT create options that are all partially correct or just variations of the same answer.

Focus only on the document's actual content - don't reference the file format or metadata.`,
                                    },
                                ],
                                response_format: zodResponseFormat(
                                    schema,
                                    "quiz_questions",
                                ),
                            });

                        console.log("Text-based API response received");

                        // Parse the JSON content into an array
                        const responseContent =
                            completion.choices[0]?.message?.content || "[]";
                        let questions;

                        try {
                            const parsedResponse = JSON.parse(responseContent);

                            // With the updated schema, we should always have a quiz_questions array property
                            if (
                                parsedResponse.quiz_questions &&
                                Array.isArray(parsedResponse.quiz_questions)
                            ) {
                                questions = parsedResponse.quiz_questions;
                                console.log(
                                    "Response has quiz_questions array with",
                                    questions.length,
                                    "questions",
                                );
                            }
                            // Handle direct array for backward compatibility
                            else if (Array.isArray(parsedResponse)) {
                                questions = parsedResponse;
                                console.log(
                                    "Response is a direct array with",
                                    questions.length,
                                    "questions",
                                );
                            }
                            // Handle 'questions' property for backward compatibility
                            else if (
                                parsedResponse.questions &&
                                Array.isArray(parsedResponse.questions)
                            ) {
                                questions = parsedResponse.questions;
                                console.log(
                                    "Response has questions array with",
                                    questions.length,
                                    "questions",
                                );
                            } else {
                                console.error(
                                    "Invalid response format:",
                                    parsedResponse,
                                );
                                questions = [];
                            }

                            // Validate against our schema
                            try {
                                // Create a validation object with the quiz_questions property
                                const validationObject = {
                                    quiz_questions: questions,
                                };

                                const validationResult =
                                    schema.safeParse(validationObject);
                                if (validationResult.success) {
                                    console.log(
                                        "Questions validated successfully against schema",
                                    );
                                } else {
                                    console.warn(
                                        "Questions failed schema validation:",
                                        validationResult.error,
                                    );

                                    // If not enough questions, continue to next attempt
                                    if (
                                        questions.length < numQuestions &&
                                        attempt < maxAttempts
                                    ) {
                                        console.log(
                                            `Not enough questions (${questions.length}/${numQuestions}), trying again`,
                                        );
                                        attempt++;
                                        continue;
                                    }
                                }
                            } catch (validationError) {
                                console.error(
                                    "Error during schema validation:",
                                    validationError,
                                );
                            }
                        } catch (error) {
                            console.error("Error parsing response:", error);
                            questions = [];
                            attempt++;
                            continue;
                        }

                        // Check if we have enough questions regardless of schema validation
                        if (Array.isArray(questions)) {
                            if (questions.length === numQuestions) {
                                console.log(
                                    `Perfect! Got exactly ${questions.length} questions as requested.`,
                                );
                            } else if (questions.length > numQuestions) {
                                console.log(
                                    `Got ${questions.length} questions, trimming to ${numQuestions} as requested.`,
                                );
                                questions = questions.slice(0, numQuestions);
                            } else if (questions.length > 0) {
                                console.warn(
                                    `Only got ${questions.length}/${numQuestions} questions, will use what we have.`,
                                );
                            } else {
                                console.error(
                                    "No valid questions in the response.",
                                );
                                attempt++;
                                continue;
                            }

                            console.log(
                                `Saving ${questions.length} questions...`,
                            );
                            await saveQuizQuestions(
                                questions,
                                studySetId,
                                imageUrl,
                            );
                            clearTimeout(timeout);
                            return NextResponse.json({
                                success: true,
                                message: "Quiz generated successfully",
                                count: questions.length,
                            });
                        } else {
                            console.warn(
                                `Unexpected response format, questions is not an array.`,
                            );
                            attempt++;
                            continue; // Try again
                        }
                    } catch (apiError: any) {
                        console.error(
                            `Error calling text-based API (attempt ${attempt}):`,
                            apiError,
                        );
                        attempt++;

                        // If last attempt failed, return error
                        if (attempt > maxAttempts) {
                            clearTimeout(timeout);
                            return NextResponse.json(
                                {
                                    error:
                                        "Error calling OpenAI API: " +
                                        (apiError.message || "Unknown error"),
                                },
                                { status: 500 },
                            );
                        }
                        // Otherwise continue to next attempt with shorter content
                    }
                }

                // If we've exhausted all attempts
                console.error("All attempts to generate quiz questions failed");
                clearTimeout(timeout);
                return NextResponse.json(
                    {
                        error: "Failed to generate quiz after multiple attempts",
                    },
                    { status: 500 },
                );
            } else {
                console.error("No content available for quiz generation");
                clearTimeout(timeout);
                return NextResponse.json(
                    { error: "No content available for quiz generation" },
                    { status: 500 },
                );
            }
        } catch (error: any) {
            console.error("Error in quiz generation:", error);
            clearTimeout(timeout);
            return NextResponse.json(
                {
                    error:
                        "Failed to generate quiz: " +
                        (error.message || "Unknown error"),
                },
                { status: 500 },
            );
        }
    } catch (error: any) {
        console.error("Error in quiz generation:", error);
        clearTimeout(timeout);
        return NextResponse.json(
            {
                error:
                    "Failed to generate quiz: " +
                    (error.message || "Unknown error"),
            },
            { status: 500 },
        );
    }
}

async function saveQuizQuestions(
    questions: any[],
    studySetId: string,
    imageUrl?: string,
) {
    if (!Array.isArray(questions) || questions.length === 0) {
        console.error("saveQuizQuestions: questions is not a valid array");
        return;
    }

    console.log(`Starting to save ${questions.length} questions...`);
    let savedCount = 0;
    const uniqueQuestions = new Set<string>(); // Track unique questions by text

    for (const question of questions) {
        try {
            if (!question || typeof question !== "object") {
                console.error("Invalid question format:", question);
                continue;
            }

            // Skip duplicate questions based on question text
            if (uniqueQuestions.has(question.question)) {
                console.warn(
                    `Skipping duplicate question: "${question.question.substring(0, 30)}..."`,
                );
                continue;
            }

            // Add to set of unique questions
            uniqueQuestions.add(question.question);

            // Make category more specific if it's too generic
            if (question.category && typeof question.category === "string") {
                question.category = makeMoreSpecific(
                    question.question,
                    question.category,
                );
            }

            // Process category if it exists
            let categoryName = null;
            if (question.category && typeof question.category === "string") {
                try {
                    categoryName = await findOrCreateCategory(
                        question.category,
                        question.question,
                    );
                } catch (categoryError) {
                    console.error(
                        "Error finding/creating category:",
                        categoryError,
                    );
                    // Continue without category if there's an error
                }
            }

            // Ensure we have the minimum required fields
            if (!question.question || !question.options) {
                console.error("Question missing required fields:", question);
                continue;
            }

            // Normalize the options to ensure it's an array
            const options = Array.isArray(question.options)
                ? question.options
                : typeof question.options === "string"
                  ? JSON.parse(question.options) // Try to parse JSON string
                  : [];

            if (options.length === 0) {
                console.error("Question has empty options:", question);
                continue;
            }

            // Validate that we have at least 4 options
            if (options.length < 4) {
                console.warn(
                    `Question "${question.question.substring(0, 30)}..." has only ${options.length} options, adding placeholder options`,
                );
                // Add placeholder options if needed
                while (options.length < 4) {
                    options.push(`Option ${options.length + 1}`);
                }
            }

            // Check for and fix similar options
            const optionsTooSimilar: boolean[] = Array(options.length).fill(
                false,
            );
            for (let i = 0; i < options.length; i++) {
                for (let j = i + 1; j < options.length; j++) {
                    if (areTooSimilar(options[i], options[j])) {
                        // Mark the later option as too similar
                        optionsTooSimilar[j] = true;
                        console.warn(
                            `Question "${question.question.substring(0, 30)}..." has similar options:`,
                            { option1: options[i], option2: options[j] },
                        );
                    }
                }
            }

            // Replace similar options with alternatives
            for (let i = 0; i < optionsTooSimilar.length; i++) {
                if (optionsTooSimilar[i]) {
                    // Generate an alternative option based on question category or text
                    const topicHint =
                        question.category ||
                        question.question.split(" ").slice(0, 3).join(" ");
                    options[i] = generateAlternativeOption(
                        question.question,
                        options.filter((_: string, idx: number) => idx !== i),
                        topicHint,
                    );
                    console.log(
                        `Replaced similar option with alternative: "${options[i]}"`,
                    );
                }
            }

            // Handle correct answer - get the answer text and find its index in options
            let correctAnswerIndex = 0; // Default to first option
            let correctAnswerText = ""; // The actual text of the correct answer

            // If we have a numeric answer that's within range, use it as an index
            if (
                typeof question.answer === "number" &&
                question.answer >= 0 &&
                question.answer < options.length
            ) {
                correctAnswerIndex = question.answer;
                correctAnswerText = options[correctAnswerIndex]; // Get the text at this index
            }
            // Otherwise look for the answer text in the options
            else {
                const answerText = question.answer || "";

                if (answerText && typeof answerText === "string") {
                    // Find the index of the option that exactly matches the answer text
                    const answerIndex = options.findIndex(
                        (option: string) => option.trim() === answerText.trim(),
                    );

                    if (answerIndex >= 0) {
                        correctAnswerIndex = answerIndex;
                        correctAnswerText = options[answerIndex]; // Use the exact text from options
                    } else {
                        // If no exact match, try a case-insensitive comparison
                        const lowercaseAnswer = answerText.toLowerCase().trim();
                        const lowercaseIndex = options.findIndex(
                            (option: string) =>
                                option.toLowerCase().trim() === lowercaseAnswer,
                        );

                        if (lowercaseIndex >= 0) {
                            correctAnswerIndex = lowercaseIndex;
                            correctAnswerText = options[lowercaseIndex]; // Use the exact text from options
                        } else {
                            console.warn(
                                "Answer text doesn't match any option exactly. Using first option as default.",
                                { answer: answerText, options },
                            );
                            correctAnswerText = options[0]; // Default to first option
                        }
                    }
                } else {
                    // Default to first option if no valid answer text
                    correctAnswerText = options[0];
                }
            }

            // Determine if we should include the image with this question
            let relatedMaterial = null;
            if (imageUrl && question.include_image === true) {
                relatedMaterial = imageUrl;
                console.log(
                    `Including image URL with question: "${question.question.substring(0, 30)}..."`,
                );
            }

            console.log(
                `Saving question: "${question.question.substring(0, 30)}..." with answer: "${correctAnswerText}"`,
            );

            try {
                const { error } = await supabase.from("quiz_questions").insert({
                    study_set: studySetId,
                    question: question.question,
                    options: JSON.stringify(options),
                    answer: correctAnswerText, // Store the answer text, not the index
                    category: categoryName,
                    explanation: question.explanation || "",
                    related_material: relatedMaterial,
                });

                if (error) {
                    console.error(
                        "Error inserting question to database:",
                        error,
                    );
                } else {
                    savedCount++;
                }
            } catch (dbError: any) {
                console.error(
                    "Database error when saving question:",
                    dbError?.message || dbError,
                );
            }
        } catch (error: any) {
            console.error(
                "Error processing question:",
                error?.message || error,
            );
            // Continue to the next question
        }
    }

    console.log(
        `Saved ${savedCount}/${questions.length} questions successfully`,
    );
}

/**
 * Make generic category names more specific based on question content
 */
function makeMoreSpecific(question: string, category: string): string {
    // Check if the category is too generic
    const genericCategories = [
        "fundamentals",
        "basics",
        "principles",
        "introduction",
        "concepts",
        "overview",
        "training",
        "analysis",
        "techniques",
        "methods",
        "theory",
        "practice",
        "management",
        "development",
        "design",
    ];

    const isGeneric = genericCategories.some(
        (generic) =>
            category.toLowerCase().includes(generic) &&
            category.split(" ").length <= 2,
    );

    if (!isGeneric) {
        return category; // Already specific enough
    }

    // Extract potential domain-specific terms from the question
    const questionLower = question.toLowerCase();
    const domainKeywords = [
        {
            domain: "AI",
            terms: [
                "artificial intelligence",
                "machine learning",
                "neural network",
                "deep learning",
                "nlp",
                "computer vision",
            ],
        },
        {
            domain: "Web",
            terms: [
                "html",
                "css",
                "javascript",
                "web development",
                "frontend",
                "backend",
                "api",
            ],
        },
        {
            domain: "Database",
            terms: [
                "sql",
                "database",
                "query",
                "nosql",
                "mongodb",
                "mysql",
                "postgresql",
            ],
        },
        {
            domain: "Security",
            terms: [
                "encryption",
                "security",
                "cybersecurity",
                "firewall",
                "authentication",
                "vulnerability",
            ],
        },
        {
            domain: "Cloud",
            terms: [
                "cloud",
                "aws",
                "azure",
                "gcp",
                "serverless",
                "microservices",
                "container",
                "docker",
            ],
        },
        {
            domain: "Network",
            terms: [
                "network",
                "tcp/ip",
                "protocol",
                "routing",
                "switch",
                "packet",
                "dns",
            ],
        },
        {
            domain: "Mobile",
            terms: [
                "mobile",
                "android",
                "ios",
                "swift",
                "kotlin",
                "react native",
                "flutter",
            ],
        },
        {
            domain: "Business",
            terms: [
                "business",
                "marketing",
                "sales",
                "finance",
                "strategy",
                "management",
                "leadership",
            ],
        },
        {
            domain: "Data",
            terms: [
                "data",
                "analytics",
                "big data",
                "visualization",
                "statistics",
                "dashboard",
                "metrics",
            ],
        },
    ];

    // Find matching domains in the question
    for (const { domain, terms } of domainKeywords) {
        if (terms.some((term) => questionLower.includes(term))) {
            // Add the domain as a prefix to the category if not already there
            if (!category.toLowerCase().includes(domain.toLowerCase())) {
                return `${domain} ${category}`;
            }
        }
    }

    // If no specific domain found, look for any capitalized words or technical terms in the question
    const words = question.split(/\s+/);
    const technicalTerms = words.filter(
        (word) =>
            (word.length > 2 &&
                word[0] === word[0].toUpperCase() &&
                word[0] !== word[0].toLowerCase()) ||
            /^[A-Z0-9]+$/i.test(word), // Acronyms or technical terms like SQL, HTML, etc.
    );

    if (technicalTerms.length > 0) {
        // Use the first technical term to make the category more specific
        return `${technicalTerms[0]} ${category}`;
    }

    return category; // Return original if no improvements found
}
