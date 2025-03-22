"use client";

import { useState, useEffect } from "react";
import supabase from "@/lib/supabase";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type QuizQuestion = {
    id: number;
    question: string;
    options: string[];
    correct_answer: number;
    category: {
        name: string;
    } | null;
};

type QuizDisplayProps = {
    studySetId: string | number;
};

export default function QuizDisplay({ studySetId }: QuizDisplayProps) {
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [showAnswer, setShowAnswer] = useState(false);
    const [score, setScore] = useState({ correct: 0, total: 0 });

    useEffect(() => {
        fetchQuizQuestions();
    }, [studySetId]);

    const fetchQuizQuestions = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from("quiz_questions")
                .select(
                    `
          id, 
          question, 
          options, 
          correct_answer,
          category
        `,
                )
                .eq("study_set", studySetId);

            if (error) throw error;

            if (!data) {
                setQuestions([]);
                return;
            }

            // Parse the options from JSON string to array and format the category properly
            const formattedQuestions: QuizQuestion[] = data.map((q) => {
                // Format category properly - it could be null or a string
                let categoryData = null;
                if (q.category) {
                    // Now category is a string directly
                    categoryData = {
                        name: q.category,
                    };
                }

                // Ensure options is an array
                const parsedOptions =
                    typeof q.options === "string"
                        ? JSON.parse(q.options)
                        : Array.isArray(q.options)
                          ? q.options
                          : [];

                // Ensure correct_answer is a valid number
                let correctAnswerIndex = 0;
                if (
                    typeof q.correct_answer === "number" &&
                    q.correct_answer >= 0 &&
                    q.correct_answer < parsedOptions.length
                ) {
                    correctAnswerIndex = q.correct_answer;
                } else if (typeof q.correct_answer === "string") {
                    // Try to parse string to number
                    const parsed = parseInt(q.correct_answer, 10);
                    if (
                        !isNaN(parsed) &&
                        parsed >= 0 &&
                        parsed < parsedOptions.length
                    ) {
                        correctAnswerIndex = parsed;
                    }
                }

                console.log(
                    `Question ${q.id}: correct_answer = ${correctAnswerIndex}, type = ${typeof q.correct_answer}`,
                );

                return {
                    id: q.id,
                    question: q.question,
                    options: parsedOptions,
                    correct_answer: correctAnswerIndex,
                    category: categoryData,
                };
            });

            setQuestions(formattedQuestions);
        } catch (error) {
            console.error("Error fetching quiz questions:", error);
            toast.error("Failed to load quiz questions");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOptionSelect = (optionIndex: number) => {
        setSelectedOption(optionIndex);
    };

    const handleCheck = () => {
        if (selectedOption === null) {
            toast.error("Please select an answer");
            return;
        }

        setShowAnswer(true);

        // Get the current question and log values for debugging
        const currentQ = questions[currentQuestion];
        console.log("Checking answer:", {
            selectedOption,
            correctAnswer: currentQ.correct_answer,
            isCorrect: selectedOption === currentQ.correct_answer,
        });

        // Only increment correct count if selected option matches the correct answer index
        if (selectedOption === currentQ.correct_answer) {
            toast.success("Correct answer!");
            setScore((prev) => ({ ...prev, correct: prev.correct + 1 }));
        } else {
            toast.error(
                `Incorrect. The correct answer is: ${currentQ.options[currentQ.correct_answer]}`,
            );
        }

        // Always increment total count
        setScore((prev) => ({ ...prev, total: prev.total + 1 }));
    };

    const handleNext = () => {
        setShowAnswer(false);
        setSelectedOption(null);

        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion((prev) => prev + 1);
        } else {
            // Quiz completed
            toast.success(
                `Quiz completed! Score: ${score.correct}/${score.total}`,
            );
            // Optionally reset to start over
            setCurrentQuestion(0);
            setScore({ correct: 0, total: 0 });
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Quiz</CardTitle>
                    <CardDescription>Loading quiz questions...</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    if (questions.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Quiz</CardTitle>
                    <CardDescription>
                        No quiz questions available for this study material.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const currentQ = questions[currentQuestion];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Quiz</CardTitle>
                <CardDescription>
                    Question {currentQuestion + 1} of {questions.length} •
                    Category: {currentQ.category?.name || "Uncategorized"}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-md">
                    <p className="text-lg font-medium">{currentQ.question}</p>
                </div>

                <RadioGroup
                    value={
                        selectedOption !== null
                            ? selectedOption.toString()
                            : undefined
                    }
                    onValueChange={(value) => {
                        // Convert string value to number and validate
                        const optionIndex = parseInt(value, 10);
                        if (
                            !isNaN(optionIndex) &&
                            optionIndex >= 0 &&
                            optionIndex < currentQ.options.length
                        ) {
                            handleOptionSelect(optionIndex);
                        }
                    }}
                    className="space-y-2"
                    disabled={showAnswer}>
                    {currentQ.options.map((option, index) => (
                        <div
                            key={index}
                            className={`flex items-center space-x-2 p-3 rounded-md ${
                                showAnswer && index === currentQ.correct_answer
                                    ? "bg-green-50 border border-green-200"
                                    : showAnswer && index === selectedOption
                                      ? "bg-red-50 border border-red-200"
                                      : "border"
                            }`}>
                            <RadioGroupItem
                                value={index.toString()}
                                id={`option-${index}`}
                            />
                            <Label
                                htmlFor={`option-${index}`}
                                className={`flex-1 ${
                                    showAnswer &&
                                    index === currentQ.correct_answer
                                        ? "font-medium text-green-700"
                                        : ""
                                }`}>
                                {option}
                            </Label>
                        </div>
                    ))}
                </RadioGroup>

                <div className="flex justify-between pt-4">
                    <div>
                        {score.total > 0 && (
                            <p className="text-sm">
                                Score: {score.correct}/{score.total}
                            </p>
                        )}
                    </div>
                    <div className="space-x-2">
                        {!showAnswer ? (
                            <Button
                                onClick={handleCheck}
                                disabled={selectedOption === null}>
                                Check Answer
                            </Button>
                        ) : (
                            <Button onClick={handleNext}>
                                {currentQuestion < questions.length - 1
                                    ? "Next Question"
                                    : "Finish Quiz"}
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
