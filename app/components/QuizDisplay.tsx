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

type CategoryScore = {
    category_name: string;
    questions_right: number;
    questions_solved: number;
    percentage: number;
};

type StudySetScore = {
    questions_right: number;
    questions_solved: number;
    percentage: number;
};

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
    const [categoryScores, setCategoryScores] = useState<CategoryScore[]>([]);
    const [studySetScore, setStudySetScore] = useState<StudySetScore | null>(
        null,
    );
    const [isUpdatingScores, setIsUpdatingScores] = useState(false);

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

            // Log the category format of each question
            propQuestions.forEach((q, index) => {
                console.log(
                    `Question ${index} category:`,
                    q.category,
                    "Type:",
                    q.category ? typeof q.category : "null",
                );
            });

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

                // Log category information
                console.log(
                    `Question ${q.id} category:`,
                    q.category,
                    "Category type:",
                    typeof q.category,
                );
                console.log(
                    `Question ${q.id} categories:`,
                    q.categories,
                    "Categories type:",
                    q.categories ? typeof q.categories : "null",
                );

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

        // Update score in database
        if (currentQuestion) {
            updateQuizScores(
                selectedOption === currentQuestion.answer,
                currentQuestion,
            );
        }
    };

    const updateQuizScores = async (
        isCorrect: boolean,
        question: QuizQuestion,
    ) => {
        try {
            // Get the category name from the question, handling different possible formats
            let categoryName = "Uncategorized";

            if (question.category) {
                if (
                    typeof question.category === "object" &&
                    question.category !== null
                ) {
                    // If it's an object with a name property (from the categories relationship)
                    categoryName = question.category.name || "Uncategorized";
                } else if (typeof question.category === "string") {
                    // If it's directly a string
                    categoryName = question.category;
                }
            }

            console.log("Using category name for scoring:", categoryName);

            // Update study_set_scores - only if studySetId is provided
            if (studySetId) {
                const { data: studySetData, error: studySetError } =
                    await supabase
                        .from("study_set_scores")
                        .select("*")
                        .eq("id", studySetId)
                        .single();

                if (studySetError && studySetError.code !== "PGRST116") {
                    console.error(
                        "Error fetching study set score:",
                        studySetError,
                    );
                    // Continue to update category scores even if study set score fails
                } else {
                    // If study set score exists, update it, otherwise create it
                    if (studySetData) {
                        await supabase
                            .from("study_set_scores")
                            .update({
                                questions_right: isCorrect
                                    ? studySetData.questions_right + 1
                                    : studySetData.questions_right,
                                questions_solved:
                                    studySetData.questions_solved + 1,
                            })
                            .eq("id", studySetId);
                    } else {
                        await supabase.from("study_set_scores").insert({
                            id: studySetId,
                            questions_right: isCorrect ? 1 : 0,
                            questions_solved: 1,
                        });
                    }
                }
            }

            // Always update category_scores, regardless of studySetId
            if (
                categoryName &&
                typeof categoryName === "string" &&
                categoryName.trim() !== ""
            ) {
                const { data: categoryData, error: categoryError } =
                    await supabase
                        .from("category_scores")
                        .select("*")
                        .eq("category_name", categoryName)
                        .single();

                if (categoryError && categoryError.code !== "PGRST116") {
                    console.error(
                        "Error fetching category score:",
                        categoryError,
                    );
                    return;
                }

                // If category score exists, update it, otherwise create it
                if (categoryData) {
                    await supabase
                        .from("category_scores")
                        .update({
                            questions_right: isCorrect
                                ? categoryData.questions_right + 1
                                : categoryData.questions_right,
                            questions_solved: categoryData.questions_solved + 1,
                        })
                        .eq("category_name", categoryName);
                } else {
                    // Make sure we have a valid category name before inserting
                    console.log(
                        "Creating new category score for:",
                        categoryName,
                    );
                    const { data, error } = await supabase
                        .from("category_scores")
                        .insert({
                            category_name: categoryName,
                            questions_right: isCorrect ? 1 : 0,
                            questions_solved: 1,
                        });

                    if (error) {
                        console.error("Error inserting category score:", error);
                    } else {
                        console.log(
                            "Successfully inserted category score:",
                            data,
                        );
                    }
                }
            } else {
                console.error(
                    "Invalid category name for insertion:",
                    categoryName,
                );
            }
        } catch (error) {
            console.error("Error updating quiz scores:", error);
        }
    };

    const fetchScores = async () => {
        setIsUpdatingScores(true);
        try {
            // Fetch study set score if studySetId is provided
            if (studySetId) {
                const { data: studySetData, error: studySetError } =
                    await supabase
                        .from("study_set_scores")
                        .select("*")
                        .eq("id", studySetId)
                        .single();

                if (studySetError && studySetError.code !== "PGRST116") {
                    console.error(
                        "Error fetching study set score:",
                        studySetError,
                    );
                } else if (studySetData) {
                    const percentage =
                        studySetData.questions_solved > 0
                            ? (studySetData.questions_right /
                                  studySetData.questions_solved) *
                              100
                            : 0;

                    setStudySetScore({
                        questions_right: studySetData.questions_right,
                        questions_solved: studySetData.questions_solved,
                        percentage,
                    });
                }
            }

            // Get unique categories from the quiz questions
            const categories = questions
                .map((q) => {
                    if (!q.category) return "Uncategorized";

                    if (typeof q.category === "object" && q.category !== null) {
                        return q.category.name || "Uncategorized";
                    } else if (typeof q.category === "string") {
                        return q.category;
                    }

                    return "Uncategorized";
                })
                .filter(
                    (value, index, self) =>
                        value && self.indexOf(value) === index,
                );

            console.log("Fetching scores for categories:", categories);

            // Fetch category scores for those categories
            if (categories.length > 0) {
                const { data: categoryData, error: categoryError } =
                    await supabase
                        .from("category_scores")
                        .select("*")
                        .in("category_name", categories);

                if (categoryError) {
                    console.error(
                        "Error fetching category scores:",
                        categoryError,
                    );
                } else if (categoryData && categoryData.length > 0) {
                    console.log("Received category scores:", categoryData);

                    const formattedCategoryScores = categoryData.map((cat) => {
                        const percentage =
                            cat.questions_solved > 0
                                ? (cat.questions_right / cat.questions_solved) *
                                  100
                                : 0;

                        return {
                            category_name: cat.category_name,
                            questions_right: cat.questions_right,
                            questions_solved: cat.questions_solved,
                            percentage,
                        };
                    });

                    console.log(
                        "Formatted category scores for display:",
                        formattedCategoryScores,
                    );
                    setCategoryScores(formattedCategoryScores);
                } else {
                    console.log(
                        "No category scores found for categories:",
                        categories,
                    );
                    setCategoryScores([]);
                }
            } else {
                console.log("No categories found to fetch scores");
                setCategoryScores([]);
            }
        } catch (error) {
            console.error("Error fetching scores:", error);
        } finally {
            setIsUpdatingScores(false);
        }
    };

    // Fetch scores when showing results
    useEffect(() => {
        if (showResults) {
            fetchScores();
        }
    }, [showResults]);

    const handleNextOrFinish = () => {
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

                // Call onComplete with the final score
                if (onComplete) {
                    onComplete(score, questions.length);
                }
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
                    {/* Overall study set performance */}
                    {studySetScore && (
                        <div className="mb-6 border rounded-lg p-4 bg-slate-50">
                            <h3 className="font-medium text-lg mb-2">
                                Study Set Performance
                            </h3>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <p className="text-2xl font-bold text-primary">
                                        {studySetScore.questions_right}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Questions Correct
                                    </p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">
                                        {studySetScore.questions_solved}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Questions Attempted
                                    </p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-green-600">
                                        {studySetScore.percentage.toFixed(1)}%
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Success Rate
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Category performance */}
                    {categoryScores.length > 0 && (
                        <div className="mb-6">
                            <h3 className="font-medium text-lg mb-3">
                                Category Performance
                            </h3>
                            <div className="space-y-3">
                                {categoryScores.map((cat) => (
                                    <div
                                        key={cat.category_name}
                                        className="border rounded-md p-3">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-medium">
                                                {cat.category_name}
                                            </h4>
                                            <Badge
                                                variant="outline"
                                                className="ml-2">
                                                {cat.percentage.toFixed(1)}%
                                            </Badge>
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            {cat.questions_right} correct out of{" "}
                                            {cat.questions_solved} attempted
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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
                                                        {typeof question.category ===
                                                            "object" &&
                                                        question.category
                                                            ? question.category
                                                                  .name
                                                            : question.category}
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
                <div className="flex justify-center py-12">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                        <p>Loading quiz questions...</p>
                    </div>
                </div>
            );
        }

        if (showResults) {
            return renderResults();
        }

        if (!currentQuestion) {
            return (
                <div className="text-center py-12">
                    <Alert variant="destructive">
                        <AlertDescription>
                            No questions available for this quiz
                        </AlertDescription>
                    </Alert>
                </div>
            );
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
                        onClick={handleNextOrFinish}
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
