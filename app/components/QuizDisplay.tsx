"use client";

import { useEffect, useState, useCallback } from "react";
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
import { CheckCircle, XCircle, Loader2, Tag, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import supabase from "@/lib/supabase";
import ReactConfetti from "react-confetti";

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
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
    const [showFeedback, setShowFeedback] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    // Track window size for confetti
    useEffect(() => {
        // Only run this on client
        if (typeof window !== "undefined") {
            const handleResize = () => {
                setWindowSize({
                    width: window.innerWidth,
                    height: window.innerHeight,
                });
            };

            // Set initial size
            handleResize();

            // Add event listener
            window.addEventListener("resize", handleResize);

            // Clean up
            return () => window.removeEventListener("resize", handleResize);
        }
    }, []);

    // Fetch questions if studySetId is provided and no questions were passed as props
    useEffect(() => {
        if (studySetId && !propQuestions) {
            fetchQuestions();
        } else if (propQuestions && propQuestions.length > 0) {
            console.log("Using provided questions:", propQuestions);
            // Ensure all questions have the required fields
            const validatedQuestions = propQuestions.map((q) => ({
                id:
                    q.id ||
                    `temp-${Math.random().toString(36).substring(2, 9)}`,
                question: q.question || "No question text available",
                options: Array.isArray(q.options) ? q.options : [],
                answer: q.answer || "",
                explanation: q.explanation || "No explanation provided",
                category: q.category || null,
            }));
            setQuestions(validatedQuestions);
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

            const formattedQuestions = data.map((q) => {
                // Parse options from JSON string if needed
                let options = [];
                try {
                    options = Array.isArray(q.options)
                        ? q.options
                        : JSON.parse(q.options);
                } catch (e) {
                    console.error("Error parsing options:", e);
                    options = [];
                }

                // Use the answer directly if it's a string, or convert from index if it's a number (legacy data)
                const answer =
                    typeof q.answer === "string"
                        ? q.answer
                        : typeof q.answer === "number" && options.length > 0
                          ? options[q.answer]
                          : "";

                console.log(
                    `Question ID ${q.id}: answer="${answer}", original=${q.answer}`,
                );

                return {
                    id: q.id.toString(),
                    question: q.question,
                    options: options,
                    answer: answer,
                    explanation: q.explanation || "No explanation provided.",
                    category: q.categories,
                };
            });

            console.log("Formatted questions:", formattedQuestions);
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

    // Log the current question data
    useEffect(() => {
        if (currentQuestion) {
            console.log("Current question:", currentQuestion);
            console.log("Correct answer:", currentQuestion.answer);
        }
    }, [currentQuestionIndex, currentQuestion]);

    // Log when showResults changes
    useEffect(() => {
        console.log("showResults state changed:", showResults);
    }, [showResults]);

    const handleAnswerSelect = (value: string) => {
        setSelectedOption(value);
        // Only store the answer for the current question
        setSelectedAnswers({
            ...selectedAnswers,
            [currentQuestion.id]: value,
        });
    };

    const checkAnswer = () => {
        if (!selectedOption) return;
        setShowFeedback(true);

        // Update score
        if (selectedOption === currentQuestion.answer) {
            setScore((prevScore) => prevScore + 1);
        }
    };

    const handleNext = () => {
        if (showFeedback) {
            // If we're showing feedback, move to next question
            setShowFeedback(false);
            setSelectedOption(null);

            if (!isLastQuestion) {
                // Move to next question
                setCurrentQuestionIndex(currentQuestionIndex + 1);
            } else {
                // Finished quiz, show results
                console.log("Last question completed, showing results");
                setShowResults(true);

                // Don't call onComplete here - let the user click "Back to Study Set" button instead
            }
        } else {
            // Show feedback for the current question
            checkAnswer();
        }
    };

    const handleReset = () => {
        setCurrentQuestionIndex(0);
        setSelectedAnswers({});
        setShowResults(false);
        setScore(0);
        setShowFeedback(false);
        setSelectedOption(null);
    };

    const isAnswerSelected = !!selectedOption;
    const isCorrectAnswer = selectedOption === currentQuestion.answer;

    const renderFeedback = () => {
        return (
            <div className="mt-6 border rounded-md p-4 bg-slate-50">
                {isCorrectAnswer && (
                    <ReactConfetti
                        width={windowSize.width}
                        height={windowSize.height * 0.5}
                        recycle={false}
                        numberOfPieces={200}
                        gravity={0.2}
                        tweenDuration={5000}
                    />
                )}
                <div className="flex items-start gap-3">
                    <div className="mt-1">
                        {isCorrectAnswer ? (
                            <CheckCircle className="h-6 w-6 text-green-500" />
                        ) : (
                            <XCircle className="h-6 w-6 text-red-500" />
                        )}
                    </div>
                    <div>
                        <h3
                            className={`text-lg font-medium ${isCorrectAnswer ? "text-green-600" : "text-red-600"}`}>
                            {isCorrectAnswer ? "Correct! 🎉" : "Incorrect"}
                        </h3>

                        {!isCorrectAnswer && (
                            <p className="mt-2">
                                The correct answer is:{" "}
                                <span className="font-medium text-green-600">
                                    {currentQuestion.answer}
                                </span>
                            </p>
                        )}

                        <Alert className="mt-3 bg-white">
                            <AlertDescription className="text-sm">
                                <strong>Explanation:</strong>{" "}
                                {currentQuestion.explanation}
                            </AlertDescription>
                        </Alert>
                    </div>
                </div>
            </div>
        );
    };

    const renderResults = () => {
        const percentage = (score / questions.length) * 100;
        const isPassing = percentage >= 70;

        return (
            <Card className="w-full max-w-3xl mx-auto">
                {isPassing && (
                    <ReactConfetti
                        width={windowSize.width}
                        height={windowSize.height}
                        recycle={false}
                        numberOfPieces={500}
                        gravity={0.1}
                        tweenDuration={10000}
                    />
                )}
                <CardHeader>
                    <CardTitle className="flex items-center text-2xl">
                        {isPassing ? (
                            <>
                                <span className="text-green-500 mr-2">🎉</span>
                                Congratulations!
                            </>
                        ) : (
                            <>
                                <span className="text-amber-500 mr-2">😔</span>
                                You can do better!
                            </>
                        )}
                    </CardTitle>
                    <CardDescription className="text-lg">
                        You scored {score} out of {questions.length} (
                        {percentage.toFixed(1)}%)
                        {!isPassing && (
                            <p className="mt-2 text-sm text-amber-600">
                                Don't worry! Review the material and try again.
                                You've got this! 💪
                            </p>
                        )}
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <div className="space-y-6">
                        <h3 className="font-medium text-lg border-b pb-2">
                            Question Summary
                        </h3>

                        {questions.map((question, index) => {
                            const selectedAnswer = selectedAnswers[question.id];
                            const isCorrect =
                                selectedAnswer === question.answer;

                            return (
                                <div
                                    key={question.id}
                                    className="pb-4 border-b last:border-0">
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
                                                        {selectedAnswer ||
                                                            "No answer"}
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
                                </div>
                            );
                        })}
                    </div>
                </CardContent>

                <CardFooter className="flex justify-center gap-4">
                    <Button
                        onClick={handleReset}
                        variant="outline"
                        className="mt-4">
                        Try Again
                    </Button>
                    <Button
                        onClick={() => {
                            if (onComplete) {
                                onComplete(score, questions.length);
                            }
                        }}
                        className="mt-4">
                        Back to Study Set
                    </Button>
                </CardFooter>
            </Card>
        );
    };

    // Make sure we render the correct UI based on the state
    const renderUI = () => {
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
                            No quiz questions have been generated for this study
                            set yet.
                        </CardDescription>
                    </CardHeader>
                </Card>
            );
        }

        // Check if currentQuestion exists before trying to render it
        if (!currentQuestion) {
            return (
                <Card className="w-full max-w-3xl mx-auto">
                    <CardHeader>
                        <CardTitle>Quiz Error</CardTitle>
                        <CardDescription>
                            There was a problem loading the current question.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={() => setCurrentQuestionIndex(0)}
                            className="w-full">
                            Try Again
                        </Button>
                    </CardContent>
                </Card>
            );
        }

        if (showResults) {
            console.log("Rendering results screen from renderUI");
            return renderResults();
        }

        // Default: render the quiz question
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
                                {typeof currentQuestion.category === "object" &&
                                currentQuestion.category
                                    ? currentQuestion.category.name
                                    : currentQuestion.category}
                            </Badge>
                        )}
                    </div>
                    <CardDescription>
                        {currentQuestion.question ||
                            "No question text available"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <RadioGroup
                        value={selectedOption || ""}
                        onValueChange={handleAnswerSelect}
                        disabled={showFeedback}>
                        {Array.isArray(currentQuestion.options) ? (
                            currentQuestion.options.map((option, index) => (
                                <div
                                    key={index}
                                    className={`flex items-center space-x-2 mb-2 p-2 rounded 
                                        ${showFeedback && option === currentQuestion.answer ? "bg-green-50 border border-green-200" : ""}
                                        ${showFeedback && option === selectedOption && option !== currentQuestion.answer ? "bg-red-50 border border-red-200" : ""}
                                        ${!showFeedback ? "hover:bg-slate-50" : ""}`}>
                                    <RadioGroupItem
                                        value={option}
                                        id={`option-${index}`}
                                    />
                                    <Label
                                        htmlFor={`option-${index}`}
                                        className={`flex-grow cursor-pointer
                                            ${showFeedback && option === currentQuestion.answer ? "text-green-700 font-medium" : ""}
                                            ${showFeedback && option === selectedOption && option !== currentQuestion.answer ? "text-red-600" : ""}`}>
                                        {option}
                                        {showFeedback &&
                                            option ===
                                                currentQuestion.answer && (
                                                <span className="ml-2 text-xs text-green-600">
                                                    ✓ Correct answer
                                                </span>
                                            )}
                                    </Label>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-4 text-red-500">
                                No options available for this question
                            </div>
                        )}
                    </RadioGroup>

                    {showFeedback && renderFeedback()}
                </CardContent>
                <CardFooter>
                    <Button
                        onClick={
                            showFeedback && isLastQuestion
                                ? () => {
                                      console.log("Finish Quiz button clicked");
                                      setShowFeedback(false);
                                      setSelectedOption(null);
                                      setShowResults(true);
                                  }
                                : handleNext
                        }
                        disabled={!isAnswerSelected && !showFeedback}
                        className="w-full flex items-center justify-center gap-2">
                        {showFeedback ? (
                            isLastQuestion ? (
                                "Finish Quiz"
                            ) : (
                                <>
                                    <span>Next Question</span>{" "}
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )
                        ) : (
                            "Check Answer"
                        )}
                    </Button>
                </CardFooter>
            </Card>
        );
    };

    // Return the appropriate UI based on state
    return renderUI();
}
