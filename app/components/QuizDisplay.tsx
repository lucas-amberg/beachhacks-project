"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import supabase from "@/lib/supabase";

type Category = {
    id: number;
    name: string;
};

type QuizQuestion = {
    id: string;
    question: string;
    options: string[];
    answer: string;
    explanation: string;
    category?: Category | null;
};

type QuizDisplayProps = {
    questions?: QuizQuestion[];
    studySetId?: string;
    onComplete?: (score: number, totalQuestions: number) => void;
};

export default function QuizDisplay({
    questions: propQuestions,
    studySetId,
    onComplete,
}: QuizDisplayProps) {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<
        Record<string, string>
    >({});
    const [showResults, setShowResults] = useState(false);
    const [score, setScore] = useState(0);
    const [questions, setQuestions] = useState<QuizQuestion[]>(
        propQuestions || [],
    );
    const [isLoading, setIsLoading] = useState(!propQuestions && !!studySetId);

    // Fetch questions if studySetId is provided and no questions were passed as props
    useEffect(() => {
        if (studySetId && !propQuestions) {
            fetchQuestions();
        }
    }, [studySetId, propQuestions]);

    const fetchQuestions = async () => {
        if (!studySetId) return;

        setIsLoading(true);
        try {
            // Query quiz questions with their categories
            const { data, error } = await supabase
                .from("quiz_questions")
                .select(
                    `
          *,
          categories:category (
            id, name
          )
        `,
                )
                .eq("study_set", studySetId)
                .order("id", { ascending: true });

            if (error) throw error;

            const formattedQuestions = data.map((q) => ({
                id: q.id.toString(),
                question: q.question,
                options: Array.isArray(q.options)
                    ? q.options
                    : JSON.parse(q.options),
                answer: q.answer,
                explanation: q.explanation || "No explanation provided.",
                category: q.categories,
            }));

            setQuestions(formattedQuestions);
        } catch (error) {
            console.error("Error fetching quiz questions:", error);
            toast.error("Failed to load quiz questions");
        } finally {
            setIsLoading(false);
        }
    };

    const currentQuestion = questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    if (isLoading) {
        return (
            <Card className="w-full max-w-3xl mx-auto">
                <CardHeader>
                    <CardTitle>Loading Quiz Questions</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    if (!questions || questions.length === 0) {
        return (
            <Card className="w-full max-w-3xl mx-auto">
                <CardHeader>
                    <CardTitle>No Questions Available</CardTitle>
                    <CardDescription>
                        No quiz questions have been generated for this study set
                        yet.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const handleAnswerSelect = (value: string) => {
        setSelectedAnswers({
            ...selectedAnswers,
            [currentQuestion.id]: value,
        });
    };

    const handleNext = () => {
        if (isLastQuestion) {
            // Calculate score
            let correctAnswers = 0;
            questions.forEach((question) => {
                if (selectedAnswers[question.id] === question.answer) {
                    correctAnswers++;
                }
            });
            setScore(correctAnswers);
            setShowResults(true);

            if (onComplete) {
                onComplete(correctAnswers, questions.length);
            }
        } else {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
    };

    const handleReset = () => {
        setCurrentQuestionIndex(0);
        setSelectedAnswers({});
        setShowResults(false);
        setScore(0);
    };

    const isAnswerSelected =
        currentQuestion && selectedAnswers[currentQuestion.id];
    const isCorrectAnswer =
        currentQuestion &&
        showResults &&
        selectedAnswers[currentQuestion.id] === currentQuestion.answer;

    if (showResults) {
        return (
            <Card className="w-full max-w-3xl mx-auto">
                <CardHeader>
                    <CardTitle>Quiz Results</CardTitle>
                    <CardDescription>
                        You scored {score} out of {questions.length}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {questions.map((question, index) => {
                            const selectedAnswer = selectedAnswers[question.id];
                            const isCorrect =
                                selectedAnswer === question.answer;

                            return (
                                <div
                                    key={question.id}
                                    className="pb-4">
                                    <div className="flex items-start gap-2">
                                        <div className="mt-1">
                                            {isCorrect ? (
                                                <CheckCircle className="h-5 w-5 text-green-500" />
                                            ) : (
                                                <XCircle className="h-5 w-5 text-red-500" />
                                            )}
                                        </div>
                                        <div className="w-full">
                                            <div className="flex justify-between items-center">
                                                <h3 className="font-medium">
                                                    Question {index + 1}:{" "}
                                                    {question.question}
                                                </h3>
                                                {question.category && (
                                                    <Badge
                                                        variant="outline"
                                                        className="ml-2 flex items-center gap-1">
                                                        <Tag className="h-3 w-3" />
                                                        {question.category.name}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="mt-2 text-sm">
                                                <p className="font-medium">
                                                    Your answer:{" "}
                                                    <span
                                                        className={
                                                            isCorrect
                                                                ? "text-green-600"
                                                                : "text-red-600"
                                                        }>
                                                        {selectedAnswer}
                                                    </span>
                                                </p>
                                                {!isCorrect && (
                                                    <p className="font-medium">
                                                        Correct answer:{" "}
                                                        <span className="text-green-600">
                                                            {question.answer}
                                                        </span>
                                                    </p>
                                                )}
                                            </div>
                                            <Alert className="mt-2 bg-slate-50">
                                                <AlertDescription>
                                                    {question.explanation}
                                                </AlertDescription>
                                            </Alert>
                                        </div>
                                    </div>
                                    {index < questions.length - 1 && (
                                        <Separator className="mt-4" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button
                        onClick={handleReset}
                        className="w-full">
                        Take Quiz Again
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-3xl mx-auto">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>
                        Question {currentQuestionIndex + 1} of{" "}
                        {questions.length}
                    </CardTitle>
                    {currentQuestion.category && (
                        <Badge
                            variant="outline"
                            className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {currentQuestion.category.name}
                        </Badge>
                    )}
                </div>
                <CardDescription>{currentQuestion.question}</CardDescription>
            </CardHeader>
            <CardContent>
                <RadioGroup
                    value={selectedAnswers[currentQuestion.id]}
                    onValueChange={handleAnswerSelect}>
                    {currentQuestion.options.map((option, index) => (
                        <div
                            key={index}
                            className="flex items-center space-x-2 mb-2 p-2 rounded hover:bg-slate-50">
                            <RadioGroupItem
                                value={option}
                                id={`option-${index}`}
                            />
                            <Label
                                htmlFor={`option-${index}`}
                                className="flex-grow cursor-pointer">
                                {option}
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            </CardContent>
            <CardFooter>
                <Button
                    onClick={handleNext}
                    disabled={!isAnswerSelected}
                    className="w-full">
                    {isLastQuestion ? "Finish Quiz" : "Next Question"}
                </Button>
            </CardFooter>
        </Card>
    );
}
