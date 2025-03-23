import { z } from "zod";

// Schema for a quiz question
export const QuizQuestionSchema = z
    .object({
        question: z.string(),
        options: z.array(z.string()),
        answer: z.string(),
        category: z.string(),
        explanation: z.string().optional(),
        related_material: z.string().nullable().optional(),
    })
    .refine((data) => data.answer !== undefined || data.answer !== undefined, {
        message: "Either answer or answer must be provided",
    });

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
    answer: string;
    category: string;
    created_at?: string;
    category_obj?: Category;
    related_material?: string | null;
};

export type QuizQuestionsResponse = z.infer<typeof QuizQuestionsResponseSchema>;

// Schema for category scores
export const CategoryScoreSchema = z.object({
    id: z.number().optional(),
    category_name: z.string(),
    questions_right: z.number().int().min(0),
    questions_solved: z.number().int().min(0),
    created_at: z.string().optional(),
});

// Schema for study set scores
export const StudySetScoreSchema = z.object({
    id: z.number().or(z.string()), // Support both number and string IDs
    questions_right: z.number().int().min(0),
    questions_solved: z.number().int().min(0),
    created_at: z.string().optional(),
});

// TypeScript types for scores
export type CategoryScore = z.infer<typeof CategoryScoreSchema>;
export type StudySetScore = z.infer<typeof StudySetScoreSchema>;
