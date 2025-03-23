"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tag, Search, AlertCircle, ArrowLeft, ChevronRight, PlayCircle, Check, X, RefreshCw, Brain } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { shuffle } from "lodash";
import dynamic from "next/dynamic";
import { toast } from "sonner";

// Dynamically import Confetti with SSR disabled to prevent hydration issues
const Confetti = dynamic(() => import('react-confetti'), { ssr: false });

type Question = {
    id: number;
    question: string;
    options: string[];
    answer: string;
    explanation?: string;
};

type Category = {
    name: string;
    created_at?: string;
};

type QuizState = {
    inProgress: boolean;
    currentQuestionIndex: number;
    questions: Question[];
    userAnswers: Record<number, string>;
    showResults: boolean;
    selectedAnswer: string | null;
    submittedAnswer: boolean;
};

type ScoreResult = {
    correct: number;
    total: number;
    percentage: number;
};

export default function CategoryPage() {
    const params = useParams();
    const categoryName = typeof params.name === 'string' ? decodeURIComponent(params.name) : '';
    const router = useRouter();
    const [category, setCategory] = useState<Category | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedQuestionId, setExpandedQuestionId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<string>("browse");
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
    const [selectedQuestionCount, setSelectedQuestionCount] = useState<number | string>(5);
    
    // Quiz state
    const [quizState, setQuizState] = useState<QuizState>({
        inProgress: false,
        currentQuestionIndex: 0,
        questions: [],
        userAnswers: {},
        showResults: false,
        selectedAnswer: null,
        submittedAnswer: false
    });

    useEffect(() => {
        if (categoryName) {
            fetchCategoryAndQuestions();
        }
        
        // Set window size for confetti
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight
            });
        };
        
        // Initial size
        handleResize();
        
        // Add event listener
        window.addEventListener('resize', handleResize);
        
        // Cleanup
        return () => window.removeEventListener('resize', handleResize);
    }, [categoryName]);

    const fetchCategoryAndQuestions = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            // Check if Supabase is properly initialized
            if (!supabase) {
                setError("Database connection not available. Please try again later.");
                setIsLoading(false);
                return;
            }
            
            // Fetch category details
            const { data: categoryData, error: categoryError } = await supabase
                .from("categories")
                .select("name, created_at")
                .eq("name", categoryName)
                .single();

            if (categoryError) {
                setError(`Error fetching category: ${categoryError.message}`);
                setIsLoading(false);
                return;
            }
            
            if (!categoryData) {
                setError("Category not found");
                setIsLoading(false);
                return;
            }
            
            setCategory(categoryData);

            try {
                // Fetch questions for this category
                const { data: questionsData, error: questionsError } = await supabase
                    .from("quiz_questions")
                    .select("*")
                    .eq("category", categoryName);

                if (questionsError) {
                    setError(`Error fetching questions: ${questionsError.message}`);
                    setIsLoading(false);
                    return;
                }

                if (!questionsData) {
                    setQuestions([]);
                    setIsLoading(false);
                    return;
                }

                try {
                    const formattedQuestions = questionsData.map(q => {
                        let parsedOptions = [];
                        
                        try {
                            parsedOptions = typeof q.options === "string" 
                                ? JSON.parse(q.options) 
                                : Array.isArray(q.options) 
                                    ? q.options 
                                    : [];
                        } catch (parseError) {
                            console.warn("Error parsing options for question:", q.id, parseError);
                            parsedOptions = [];
                        }
                        
                        return {
                            id: q.id,
                            question: q.question,
                            options: parsedOptions,
                            answer: q.answer,
                            explanation: q.explanation
                        };
                    });

                    // Filter out questions without options
                    const validQuestions = formattedQuestions.filter(q => q.options.length > 0);
                    setQuestions(validQuestions);
                } catch (formatError) {
                    console.error("Error formatting questions:", formatError);
                    setError("Error processing question data");
                }
            } catch (questionsError) {
                console.error("Error in question fetch:", questionsError);
                setError("Failed to load questions");
            }
        } catch (error) {
            console.error("Error fetching category data:", error);
            setError("An unexpected error occurred. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    };

    const filteredQuestions = questions.filter(question =>
        question.question.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleQuestion = (questionId: number) => {
        if (expandedQuestionId === questionId) {
            setExpandedQuestionId(null);
        } else {
            setExpandedQuestionId(questionId);
        }
    };

    // Quiz functions
    const startQuiz = () => {
        // Validate question count
        const count = Number(selectedQuestionCount);
        
        if (isNaN(count) || count < 1) {
            toast.error("Please select at least 1 question for the quiz");
            return;
        }
        
        if (count > questions.length) {
            toast.error(`You can only select up to ${questions.length} questions`);
            return;
        }
        
        // Get questions with options and randomize order
        const allQuizQuestions = shuffle([...questions].filter(q => q.options.length > 0));
        
        // Select the specified number of questions
        const quizQuestions = allQuizQuestions.slice(0, count);
        
        setQuizState({
            inProgress: true,
            currentQuestionIndex: 0,
            questions: quizQuestions,
            userAnswers: {},
            showResults: false,
            selectedAnswer: null,
            submittedAnswer: false
        });
        
        setActiveTab("quiz");
        toast.success(`Starting quiz with ${count} questions`);
    };

    const selectAnswer = (answer: string) => {
        setQuizState({
            ...quizState,
            selectedAnswer: answer
        });
    };

    const submitAnswer = () => {
        if (!quizState.selectedAnswer) return;
        
        const currentQuestion = quizState.questions[quizState.currentQuestionIndex];
        
        setQuizState({
            ...quizState,
            userAnswers: {
                ...quizState.userAnswers,
                [currentQuestion.id]: quizState.selectedAnswer
            },
            submittedAnswer: true
        });
    };

    const moveToNextQuestion = () => {
        // If this was the last question, show results
        // Otherwise advance to next question
        if (quizState.currentQuestionIndex === quizState.questions.length - 1) {
            setQuizState(prev => ({
                ...prev,
                showResults: true
            }));
        } else {
            setQuizState(prev => ({
                ...prev,
                currentQuestionIndex: prev.currentQuestionIndex + 1,
                selectedAnswer: null,
                submittedAnswer: false
            }));
        }
    };

    const resetQuiz = () => {
        // Restart quiz with new shuffled questions
        const quizQuestions = shuffle([...questions].filter(q => q.options.length > 0));
        const selectedQuestions = quizQuestions.slice(0, Number(selectedQuestionCount));
        
        setQuizState({
            inProgress: true,
            currentQuestionIndex: 0,
            questions: selectedQuestions,
            userAnswers: {},
            showResults: false,
            selectedAnswer: null,
            submittedAnswer: false
        });
    };

    const calculateScore = (): ScoreResult => {
        if (!quizState.showResults) return {
            correct: 0,
            total: 0,
            percentage: 0
        };
        
        let correctAnswers = 0;
        quizState.questions.forEach(question => {
            const userAnswer = quizState.userAnswers[question.id];
            if (userAnswer === question.answer) {
                correctAnswers++;
            }
        });
        
        return {
            correct: correctAnswers,
            total: quizState.questions.length,
            percentage: Math.round((correctAnswers / quizState.questions.length) * 100)
        };
    };

    const renderBrowseContent = () => {
        if (filteredQuestions.length === 0) {
            return (
                <div className="text-center py-8">
                    <p className="text-gray-500">
                        {questions.length === 0 
                            ? "No questions available in this category" 
                            : "No questions match your search"}
                    </p>
                </div>
            );
        }

        return (
            <Accordion type="single" collapsible className="w-full">
                {filteredQuestions.map((question) => (
                    <AccordionItem key={question.id} value={question.id.toString()}>
                        <AccordionTrigger className="hover:bg-slate-50 px-4 py-3 rounded-lg">
                            <div className="text-left font-medium">{question.question}</div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                            <div className="space-y-4 pt-2">
                                {question.options.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {question.options.map((option, index) => (
                                            <div
                                                key={index}
                                                className={`p-3 rounded-lg border ${
                                                    option === question.answer
                                                        ? "border-green-500 bg-green-50"
                                                        : "border-gray-200"
                                                }`}
                                            >
                                                {option}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-amber-600">No options available for this question</p>
                                )}
                                
                                {question.explanation && (
                                    <div className="mt-4 text-sm text-gray-600 bg-slate-50 p-3 rounded-lg">
                                        <strong>Explanation:</strong>{" "}
                                        {question.explanation}
                                    </div>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        );
    };

    const renderQuizQuestion = () => {
        if (!quizState.inProgress || quizState.questions.length === 0) {
            return (
                <div className="text-center py-8">
                    <p className="text-gray-500">No quiz in progress</p>
                </div>
            );
        }

        if (quizState.showResults) {
            const score = calculateScore();
            const showConfetti = score.percentage >= 75;
            
            return (
                <div className="space-y-6">
                    {showConfetti && (
                        <Confetti 
                            width={windowSize.width}
                            height={windowSize.height}
                            recycle={false}
                            numberOfPieces={200}
                        />
                    )}
                    <div className="text-center py-4">
                        <h3 className="text-2xl font-bold mb-2">Quiz Results</h3>
                        <p className="text-lg">
                            You scored <span className="font-bold">{score.correct} out of {score.total}</span> ({score.percentage}%)
                        </p>
                        <Progress 
                            value={score.percentage} 
                            className={`mt-4 h-3 ${
                                score.percentage > 70 ? "bg-green-100" : 
                                score.percentage > 40 ? "bg-yellow-100" : 
                                "bg-red-100"
                            }`}
                        />
                        {showConfetti && (
                            <p className="text-green-600 font-medium mt-2">Great job! You earned a score over 75%!</p>
                        )}
                    </div>
                    
                    <div className="space-y-4">
                        {quizState.questions.map((question, index) => {
                            const userAnswer = quizState.userAnswers[question.id];
                            const isCorrect = userAnswer === question.answer;
                            
                            return (
                                <Card key={question.id} className={isCorrect ? "border-green-200" : "border-red-200"}>
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-shrink-0 mt-0.5">
                                                    {isCorrect ? (
                                                        <Check className="h-5 w-5 text-green-500" />
                                                    ) : (
                                                        <X className="h-5 w-5 text-red-500" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium">{question.question}</p>
                                                </div>
                                            </div>
                                            <Badge variant={isCorrect ? "outline" : "destructive"}>
                                                {isCorrect ? "Correct" : "Incorrect"}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                            {question.options.map((option) => (
                                                <div
                                                    key={option}
                                                    className={`p-3 rounded-lg border ${
                                                        option === question.answer
                                                            ? "border-green-500 bg-green-50"
                                                            : option === userAnswer && option !== question.answer
                                                            ? "border-red-500 bg-red-50"
                                                            : "border-gray-200"
                                                    }`}
                                                >
                                                    {option}
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {question.explanation && (
                                            <div className="mt-4 text-sm text-gray-600 bg-slate-50 p-3 rounded-lg">
                                                <strong>Explanation:</strong>{" "}
                                                {question.explanation}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                    
                    <div className="flex justify-center pt-4">
                        <Button 
                            onClick={resetQuiz}
                            className="flex items-center gap-2"
                        >
                            <RefreshCw className="h-4 w-4" />
                            <span>Take Quiz Again</span>
                        </Button>
                    </div>
                </div>
            );
        }

        const currentQuestion = quizState.questions[quizState.currentQuestionIndex];
        const userAnswer = quizState.userAnswers[currentQuestion.id];
        const isCorrect = quizState.submittedAnswer && quizState.selectedAnswer === currentQuestion.answer;
        const isIncorrect = quizState.submittedAnswer && quizState.selectedAnswer !== currentQuestion.answer;
        
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <Badge variant="outline">
                        Question {quizState.currentQuestionIndex + 1} of {quizState.questions.length}
                    </Badge>
                    <Progress 
                        value={(quizState.currentQuestionIndex / quizState.questions.length) * 100} 
                        className="w-full max-w-[200px] h-2"
                    />
                </div>
                
                <div>
                    <h3 className="text-xl font-medium mb-6">{currentQuestion.question}</h3>
                    
                    <div className="grid grid-cols-1 gap-3">
                        {currentQuestion.options.map((option) => {
                            const isSelected = quizState.selectedAnswer === option;
                            const isCorrectOption = option === currentQuestion.answer;
                            
                            let buttonStyle = "";
                            
                            if (quizState.submittedAnswer) {
                                if (isCorrectOption) {
                                    buttonStyle = "border-green-500 bg-green-50 text-green-700";
                                } else if (isSelected && !isCorrectOption) {
                                    buttonStyle = "border-red-500 bg-red-50 text-red-700";
                                }
                            }
                            
                            return (
                                <Button
                                    key={option}
                                    variant={isSelected && !quizState.submittedAnswer ? "default" : "outline"}
                                    className={`justify-start p-4 h-auto text-base font-normal ${buttonStyle} ${
                                        !isSelected && quizState.submittedAnswer ? "opacity-50" : ""
                                    }`}
                                    onClick={() => !quizState.submittedAnswer && selectAnswer(option)}
                                    disabled={quizState.submittedAnswer}
                                >
                                    {option}
                                    {quizState.submittedAnswer && isCorrectOption && (
                                        <Check className="h-5 w-5 ml-2 text-green-500" />
                                    )}
                                    {quizState.submittedAnswer && isSelected && !isCorrectOption && (
                                        <X className="h-5 w-5 ml-2 text-red-500" />
                                    )}
                                </Button>
                            );
                        })}
                    </div>
                    
                    <div className="mt-6 flex justify-center">
                        {!quizState.submittedAnswer ? (
                            <Button 
                                onClick={submitAnswer}
                                disabled={!quizState.selectedAnswer}
                                className="w-full max-w-[200px]"
                            >
                                Submit Answer
                            </Button>
                        ) : (
                            <div className="space-y-4 w-full">
                                {currentQuestion.explanation && (
                                    <div className="text-sm bg-slate-50 p-4 rounded-lg border border-slate-200">
                                        <strong>Explanation:</strong>{" "}
                                        {currentQuestion.explanation}
                                    </div>
                                )}
                                
                                <Button 
                                    onClick={moveToNextQuestion}
                                    className="w-full max-w-[200px]"
                                >
                                    {quizState.currentQuestionIndex === quizState.questions.length - 1 
                                        ? "See Results" 
                                        : "Next Question"}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <Card>
                    <CardHeader>
                        <Skeleton className="h-7 w-48 mb-2" />
                        <Skeleton className="h-4 w-64" />
                    </CardHeader>
                    <CardContent>
                        <div className="mb-6">
                            <Skeleton className="h-10 w-full max-w-md" />
                        </div>
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            );
        }

        if (error) {
            return (
                <div className="space-y-4">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                    <Button
                        variant="outline"
                        onClick={() => router.push('/categories')}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to Categories
                    </Button>
                </div>
            );
        }

        if (!category) {
            return (
                <div className="space-y-4">
                    <Alert>
                        <AlertDescription>Category not found</AlertDescription>
                    </Alert>
                    <Button
                        variant="outline"
                        onClick={() => router.push('/categories')}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to Categories
                    </Button>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Quiz Configuration Card */}
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Brain className="h-5 w-5" />
                                Quiz Mode
                            </CardTitle>
                            <CardDescription>
                                Test your knowledge with questions from this category
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {questions.length > 0 ? (
                                <div className="space-y-4">
                                    <p>
                                        This category has {questions.length} questions available.
                                    </p>
                                    <div className="flex flex-col space-y-3">
                                        <label
                                            htmlFor="questionCount"
                                            className="text-sm font-medium">
                                            Number of questions for quiz:
                                        </label>
                                        <div className="flex items-center space-x-2">
                                            <Input
                                                id="questionCount"
                                                type="number"
                                                value={selectedQuestionCount}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setSelectedQuestionCount(
                                                        value === ""
                                                            ? ""
                                                            : Number(value),
                                                    );
                                                }}
                                                className="w-24"
                                            />
                                            <span className="text-sm text-gray-500">
                                                of {questions.length} total
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Enter how many questions you want in your quiz.
                                        </p>
                                    </div>
                                    <Button
                                        onClick={startQuiz}
                                        className="w-full flex items-center gap-2"
                                    >
                                        <PlayCircle className="h-4 w-4" />
                                        <span>Start Quiz</span>
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-gray-500">
                                        No questions available in this category
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Search Card */}
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Search className="h-5 w-5" />
                                Find Questions
                            </CardTitle>
                            <CardDescription>
                                Search through {questions.length} questions in this category
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        type="search"
                                        placeholder="Search questions..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            
                            {searchTerm && (
                                <div className="text-sm text-gray-500 mb-2">
                                    {filteredQuestions.length} {filteredQuestions.length === 1 ? 'question' : 'questions'} found
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Questions List Card */}
                {!quizState.inProgress ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>All Questions</CardTitle>
                            <CardDescription>
                                Browse all questions in the {category.name} category
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {renderBrowseContent()}
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>Quiz in Progress</CardTitle>
                            <CardDescription>
                                {quizState.showResults 
                                    ? "Review your quiz results" 
                                    : `Question ${quizState.currentQuestionIndex + 1} of ${quizState.questions.length}`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {renderQuizQuestion()}
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    };

    return (
        <div className="container mx-auto py-8">
            <div className="mb-4">
                <Button
                    variant="outline"
                    onClick={() => router.push('/categories')}
                    className="flex items-center gap-2"
                >
                    <ArrowLeft className="h-4 w-4" /> Back to Categories
                </Button>
            </div>
            
            <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Tag className="h-6 w-6" />
                    {category?.name || "Category"}
                </h1>
                <p className="text-gray-500 mt-1">
                    {questions.length} questions available in this category
                </p>
            </div>
            
            {renderContent()}
        </div>
    );
} 