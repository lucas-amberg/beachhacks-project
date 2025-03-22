export interface Category {
    id: number;
    name: string;
    created_at: string;
}

export interface QuizQuestion {
    id: number;
    study_set: number;
    category: string;
    question: string;
    options: string[];
    correct_answer: number;
    created_at: string;
}
