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
): Promise<string | null> {
    try {
        // Check if category exists
        const { data: existingCategory, error: findError } = await supabase
            .from("categories")
            .select("name")
            .eq("name", categoryName)
            .single();

        if (!findError && existingCategory) {
            return existingCategory.name;
        }

        // Create new category
        const { data: newCategory, error: createError } = await supabase
            .from("categories")
            .insert({ name: categoryName })
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
    const timeout = setTimeout(() => {
        console.error("Quiz generation timed out after 60 seconds");
    }, 60000); // 60 second timeout for debugging

    try {
        const formData = await request.formData();
        console.log("Form data received, processing request...");

        const file = formData.get("file") as File;
        const studySetId = formData.get("studySetId") as string;
        const numQuestions = Number(formData.get("numQuestions") || "5");
        const fileName = formData.get("fileName") as string;
        const fileType = formData.get("fileType") as string;
        const fileUrl = formData.get("fileUrl") as string;
        const fileContent = formData.get("fileContent") as string;

        // Create a schema validator with the required question count
        const responseValidator =
            createQuizResponseSchemaWithCount(numQuestions);

        if (!studySetId) {
            clearTimeout(timeout);
            return NextResponse.json(
                { error: "Study set ID is required" },
                { status: 400 },
            );
        }

        // Check if we have the file URL for vision API or fall back to text extraction
        let content = fileContent || "";
        let questionType = "multiple-choice";

        console.log(
            "Processing file:",
            fileName,
            fileType,
            "Content length:",
            content?.length || 0,
        );

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
                            await saveQuizQuestions(questions, studySetId);
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
            if (file && !content) {
                console.log("Extracting text from file...");
                try {
                    if (fileType.toLowerCase().includes("pdf")) {
                        content = await getTextFromPDF(
                            await file.arrayBuffer(),
                        );
                    } else {
                        // Handle other file types or use text directly
                        content = await file.text();
                    }
                    console.log(
                        "Text extraction complete, content length:",
                        content?.length || 0,
                    );
                } catch (extractError) {
                    console.error("Error extracting text:", extractError);
                }
            }

            // If we still need to generate questions using the text content
            if (content) {
                console.log(
                    "Using text content for quiz generation, length:",
                    content.length,
                );

                // Try with progressively shorter content if needed
                let contentToUse = content;
                let attempt = 1;
                const maxAttempts = 3;

                while (attempt <= maxAttempts) {
                    const maxLength =
                        attempt === 1 ? 14000 : attempt === 2 ? 8000 : 4000;
                    contentToUse = content.substring(0, maxLength);

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
                            await saveQuizQuestions(questions, studySetId);
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

async function saveQuizQuestions(questions: any[], studySetId: string) {
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

            // Process category if it exists
            let categoryName = null;
            if (question.category && typeof question.category === "string") {
                try {
                    categoryName = await findOrCreateCategory(
                        question.category,
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
