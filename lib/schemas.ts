import { z } from "zod";

// Schema for a quiz question
export const QuizQuestionSchema = z
    .object({
        question: z.string(),
        options: z.array(z.string()),
        correct_answer: z.number().int().min(0).max(3).optional(),
        answer: z.string().optional(),
        category: z.string(),
        explanation: z.string().optional(),
    })
    .refine(
        (data) =>
            data.correct_answer !== undefined || data.answer !== undefined,
        {
            message: "Either correct_answer or answer must be provided",
        },
    );

// Schema for a response containing multiple quiz questions
// Updated to add minLength validation based on request
export const QuizQuestionsResponseSchema = z.object({
    questions: z.array(QuizQuestionSchema),
});

// Function to create a schema with dynamic validation for number of questions
export const createQuizResponseSchemaWithCount = (requiredCount: number) =>
    z.object({
        questions: z
            .array(QuizQuestionSchema)
            .min(
                requiredCount,
                `Response must contain at least ${requiredCount} questions as requested by the user`,
            ),
    });

// TypeScript type for a quiz question (matches the schema)
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

// TypeScript type for a category
export type Category = {
    id: number;
    name: string;
    created_at?: string;
};

// TypeScript type for a database quiz question
export type DbQuizQuestion = {
    id: number;
    study_set: number;
    question: string;
    options: string; // JSON string of options array
    correct_answer: number;
    category: string;
    created_at?: string;
    category_obj?: Category;
};

export type QuizQuestionsResponse = z.infer<typeof QuizQuestionsResponseSchema>;
