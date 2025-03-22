import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getTextFromPDF } from "../../../app/lib/extractText";
import { createQuizResponseSchemaWithCount } from "@/lib/schemas";

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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
                    const response = await openai.chat.completions.create({
                        model: "gpt-4-vision-preview",
                        messages: [
                            {
                                role: "system",
                                content: `You are a helpful assistant that creates educational quiz questions based on document content.
                Carefully analyze the CONTENT of the document (not its format or metadata).
                Create EXACTLY ${numQuestions} multiple-choice questions with 4 options each. 
                The number of questions (${numQuestions}) is a strict requirement - you MUST create exactly that many questions.
                Each question should test comprehension of the actual content/information in the document.
                Make sure only one option is correct.
                Ensure questions cover different topics from the document.
                
                Format output as a valid JSON array with objects having these fields:
                - question (string): The question text about the content
                - options (array): Four possible answers as strings
                - answer (string): The exact text of the correct option (must match one of the options EXACTLY)
                - explanation (string): Brief explanation of why the answer is correct
                - category (string): A category or topic that this question belongs to
                
                IMPORTANT: 
                1. The "answer" field MUST contain the EXACT same text as one of the options.
                2. You MUST create EXACTLY ${numQuestions} questions - not more, not less.
                3. Do NOT create questions about the file format, encoding, or metadata.`,
                            },
                            {
                                role: "user",
                                content: [
                                    {
                                        type: "text",
                                        text: `Please analyze this document and create EXACTLY ${numQuestions} multiple-choice quiz questions about its actual content. This is a strict requirement - you must create exactly ${numQuestions} questions. Include a category for each question. Don't reference the file format, focus only on the document's information. Make sure the "answer" field contains the EXACT text of the correct option.`,
                                    },
                                    {
                                        type: "image_url",
                                        image_url: { url: fileUrl },
                                    },
                                ],
                            },
                        ],
                        max_tokens: 4000,
                    });

                    console.log(
                        "Vision API response received, length:",
                        response.choices[0]?.message?.content?.length || 0,
                    );
                    const responseText =
                        response.choices[0]?.message?.content || "";

                    // Extract the JSON part from the response
                    const jsonMatch = responseText.match(
                        /\[\s*\{(.|\n)*\}\s*\]/,
                    );
                    if (jsonMatch) {
                        try {
                            console.log("Parsing Vision API JSON response...");
                            const parsedData = JSON.parse(jsonMatch[0]);

                            // Handle different formats of data
                            let questionsToProcess;
                            if (Array.isArray(parsedData)) {
                                questionsToProcess = parsedData;
                                // Wrap in questions object for validation
                                const questionsObj = {
                                    questions: questionsToProcess,
                                };

                                // Validate against our schema to ensure minimum question count
                                const validationResult =
                                    responseValidator.safeParse(questionsObj);
                                if (!validationResult.success) {
                                    console.error(
                                        "Vision API response validation failed:",
                                        validationResult.error,
                                    );
                                    throw new Error(
                                        `Not enough questions generated. Required: ${numQuestions}, Got: ${questionsToProcess.length}`,
                                    );
                                }
                            } else if (
                                parsedData.questions &&
                                Array.isArray(parsedData.questions)
                            ) {
                                questionsToProcess = parsedData.questions;

                                // Validate against our schema to ensure minimum question count
                                const validationResult =
                                    responseValidator.safeParse(parsedData);
                                if (!validationResult.success) {
                                    console.error(
                                        "Vision API response validation failed:",
                                        validationResult.error,
                                    );
                                    throw new Error(
                                        `Not enough questions generated. Required: ${numQuestions}, Got: ${questionsToProcess.length}`,
                                    );
                                }
                            } else if (
                                Object.keys(parsedData).includes("question") &&
                                Object.keys(parsedData).includes("options") &&
                                (parsedData.answer || parsedData.correct_answer)
                            ) {
                                // This is a single question object
                                questionsToProcess = [parsedData];
                                console.error(
                                    "Only a single question was generated, but needed",
                                    numQuestions,
                                );
                                throw new Error(
                                    `Only one question was generated, but ${numQuestions} were requested`,
                                );
                            } else {
                                console.error(
                                    "Invalid Vision API response format:",
                                    parsedData,
                                );
                                // Fall back to text extraction
                                questionsToProcess = [];
                            }

                            // Ensure questions is an array before calling saveQuizQuestions
                            if (
                                Array.isArray(questionsToProcess) &&
                                questionsToProcess.length > 0
                            ) {
                                console.log(
                                    `Saving ${questionsToProcess.length} questions from Vision API...`,
                                );
                                await saveQuizQuestions(
                                    questionsToProcess,
                                    studySetId,
                                );
                                clearTimeout(timeout);
                                return NextResponse.json({
                                    success: true,
                                    message:
                                        "Quiz generated successfully with Vision API",
                                    count: questionsToProcess.length,
                                });
                            } else {
                                console.error(
                                    "No valid questions in Vision API response",
                                );
                                // Fall back to text extraction if format is invalid
                            }
                        } catch (jsonError) {
                            console.error(
                                "Error parsing Vision API JSON:",
                                jsonError,
                            );
                            // Fall back to text extraction if JSON parsing fails
                        }
                    } else {
                        console.error(
                            "No valid JSON found in Vision API response",
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

                    const prompt = `
            Create EXACTLY ${numQuestions} ${questionType} questions based on the following content.
            This is a STRICT REQUIREMENT - you MUST create exactly ${numQuestions} questions - not more, not less.
            
            ${contentToUse} 
            
            IMPORTANT:
            - You MUST generate EXACTLY ${numQuestions} questions as requested by the user.
            - Focus ONLY on the actual information/content from the document.
            - DO NOT create questions about the file format, encoding, or metadata.
            - Each question should test understanding of the content presented in the document.
            
            Format your response as a JSON array with objects containing:
            - question (string): The question text
            - options (array): Four possible answers as strings
            - answer (string): The EXACT text of the correct option (must match one of the options EXACTLY, character for character)
            - explanation (string): Brief explanation of why the answer is correct
            - category (string): A category or topic that this question belongs to
            
            CRITICAL: 
            1. The "answer" field MUST contain text that EXACTLY matches one of the options.
            2. You MUST create EXACTLY ${numQuestions} questions - this is a strict requirement.
          `;

                    try {
                        console.log(
                            `Calling text-based GPT API (attempt ${attempt})...`,
                        );
                        const completion = await openai.chat.completions.create(
                            {
                                model: "gpt-4-turbo",
                                messages: [
                                    {
                                        role: "system",
                                        content: `You are a helpful assistant that creates educational quiz questions based on document content.
                  Focus on the actual information in the document, not metadata or file format.
                  
                  IMPORTANT: 
                  1. Always ensure the 'answer' field contains the EXACT text of the correct option.
                  2. You MUST create EXACTLY ${numQuestions} questions as requested - not more, not less.
                  3. This is a strict requirement from the user - generating the correct number of questions is critical.`,
                                    },
                                    {
                                        role: "user",
                                        content: prompt,
                                    },
                                ],
                                response_format: { type: "json_object" },
                            },
                        );

                        console.log("Text-based API response received");
                        const responseText =
                            completion.choices[0]?.message?.content || "";

                        try {
                            console.log(
                                "Parsing text-based API JSON response...",
                            );
                            const responseData = JSON.parse(responseText);

                            // Handle both array format and object with questions property
                            let questionsToProcess;
                            if (Array.isArray(responseData)) {
                                questionsToProcess = responseData;
                                console.log(
                                    "Response is an array with",
                                    questionsToProcess.length,
                                    "questions",
                                );

                                // Wrap in questions object for validation
                                const questionsObj = {
                                    questions: questionsToProcess,
                                };

                                // Validate against our schema to ensure minimum question count
                                const validationResult =
                                    responseValidator.safeParse(questionsObj);
                                if (!validationResult.success) {
                                    console.error(
                                        "Text API response validation failed:",
                                        validationResult.error,
                                    );
                                    throw new Error(
                                        `Not enough questions generated. Required: ${numQuestions}, Got: ${questionsToProcess.length}`,
                                    );
                                }
                            } else if (
                                responseData.questions &&
                                Array.isArray(responseData.questions)
                            ) {
                                questionsToProcess = responseData.questions;
                                console.log(
                                    "Response has questions array with",
                                    questionsToProcess.length,
                                    "questions",
                                );

                                // Validate against our schema to ensure minimum question count
                                const validationResult =
                                    responseValidator.safeParse(responseData);
                                if (!validationResult.success) {
                                    console.error(
                                        "Text API response validation failed:",
                                        validationResult.error,
                                    );
                                    throw new Error(
                                        `Not enough questions generated. Required: ${numQuestions}, Got: ${questionsToProcess.length}`,
                                    );
                                }
                            } else if (
                                Object.keys(responseData).includes(
                                    "question",
                                ) &&
                                Object.keys(responseData).includes("options") &&
                                (responseData.answer ||
                                    responseData.correct_answer)
                            ) {
                                // This is a single question object, not wrapped in an array
                                questionsToProcess = [responseData];
                                console.log(
                                    "Response is a single question object",
                                );
                                console.error(
                                    "Only a single question was generated, but needed",
                                    numQuestions,
                                );

                                // If we're on the final attempt, continue with what we have, otherwise retry
                                if (attempt >= maxAttempts) {
                                    console.warn(
                                        "Final attempt - proceeding with single question despite requirement for",
                                        numQuestions,
                                    );
                                } else {
                                    throw new Error(
                                        `Only one question was generated, but ${numQuestions} were requested`,
                                    );
                                }
                            } else {
                                console.error(
                                    "Invalid response format:",
                                    responseData,
                                );
                                attempt++;
                                continue; // Try again with shorter content
                            }

                            // Ensure questions is an array before calling saveQuizQuestions
                            if (
                                Array.isArray(questionsToProcess) &&
                                questionsToProcess.length > 0
                            ) {
                                console.log(
                                    `Saving ${questionsToProcess.length} questions from text-based API...`,
                                );
                                await saveQuizQuestions(
                                    questionsToProcess,
                                    studySetId,
                                );
                                clearTimeout(timeout);
                                return NextResponse.json({
                                    success: true,
                                    message: "Quiz generated successfully",
                                    count: questionsToProcess.length,
                                });
                            } else {
                                console.warn(
                                    "No valid questions found, trying with shorter content",
                                );
                                attempt++;
                                continue; // Try again with shorter content
                            }
                        } catch (error) {
                            console.error(
                                "Error parsing JSON response:",
                                error,
                            );
                            attempt++;
                            continue; // Try again with shorter content
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

    for (const question of questions) {
        try {
            if (!question || typeof question !== "object") {
                console.error("Invalid question format:", question);
                continue;
            }

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

            // Handle correct answer - get the answer text and find its index in options
            let correctAnswerIndex = 0; // Default to first option

            // If we have a numeric correct_answer that's within range, use it directly
            if (
                typeof question.correct_answer === "number" &&
                question.correct_answer >= 0 &&
                question.correct_answer < options.length
            ) {
                correctAnswerIndex = question.correct_answer;
            }
            // Otherwise look for the answer text in the options
            else {
                const answerText = question.answer || question.correct_answer;

                if (answerText && typeof answerText === "string") {
                    // Find the index of the option that exactly matches the answer text
                    const answerIndex = options.findIndex(
                        (option: string) => option.trim() === answerText.trim(),
                    );

                    if (answerIndex >= 0) {
                        correctAnswerIndex = answerIndex;
                    } else {
                        // If no exact match, try a case-insensitive comparison
                        const lowercaseAnswer = answerText.toLowerCase().trim();
                        const lowercaseIndex = options.findIndex(
                            (option: string) =>
                                option.toLowerCase().trim() === lowercaseAnswer,
                        );

                        if (lowercaseIndex >= 0) {
                            correctAnswerIndex = lowercaseIndex;
                        } else {
                            console.warn(
                                "Answer text doesn't match any option exactly. Using first option as default.",
                                { answer: answerText, options },
                            );
                        }
                    }
                }
            }

            console.log(
                `Saving question: "${question.question.substring(0, 30)}..." with answer index: ${correctAnswerIndex}`,
            );

            try {
                const { error } = await supabase.from("quiz_questions").insert({
                    study_set: studySetId,
                    question: question.question,
                    options: JSON.stringify(options),
                    correct_answer: correctAnswerIndex,
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
