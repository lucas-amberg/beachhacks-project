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
import {
    Tag,
    Search,
    AlertCircle,
    ArrowLeft,
    ChevronRight,
    Brain,
    Loader2,
    BookOpen,
    X,
} from "lucide-react";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { shuffle } from "lodash";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import QuizDisplay from "@/app/components/QuizDisplay";
import FlashCardViewer, {
    FlashCardQuestion,
} from "@/app/components/FlashCardViewer";

// Define a compatible type for the QuizDisplay component
interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    answer: string;
    explanation: string;
    category?: {
        id?: number;
        name: string;
    } | null;
    related_material: string | null;
}

type Question = {
    id: number;
    question: string;
    options: string[];
    answer: string;
    explanation?: string;
    category?: {
        id?: number;
        name: string;
    } | null;
    related_material: string | null;
};

type Category = {
    name: string;
    created_at?: string;
};

type CategoryScore = {
    id: number;
    category_name: string;
    questions_right: number;
    questions_solved: number;
};

export default function CategoryPage() {
    const params = useParams();
    const router = useRouter();
    const [category, setCategory] = useState<Category | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedQuestionId, setExpandedQuestionId] = useState<number | null>(
        null,
    );
    const [activeTab, setActiveTab] = useState("browse");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedQuestionCount, setSelectedQuestionCount] = useState<
        string | number
    >(10);
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [showQuiz, setShowQuiz] = useState(false);
    const [showFlashCards, setShowFlashCards] = useState(false);
    const [flashCardQuestions, setFlashCardQuestions] = useState<
        FlashCardQuestion[]
    >([]);
    const [categoryScore, setCategoryScore] = useState<CategoryScore | null>(
        null,
    );
    const [fetchingScore, setFetchingScore] = useState(false);
    const [windowSize, setWindowSize] = useState({
        width: 0,
        height: 0,
    });

    // New state for question dialog
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(
        null,
    );

    // New state for expanded image
    const [expandedImage, setExpandedImage] = useState<string | null>(null);

    // Effect to update window size for confetti
    useEffect(() => {
        if (typeof window !== "undefined") {
            const handleResize = () => {
                setWindowSize({
                    width: window.innerWidth,
                    height: window.innerHeight,
                });
            };

            handleResize();
            window.addEventListener("resize", handleResize);
            return () => window.removeEventListener("resize", handleResize);
        }
    }, []);

    useEffect(() => {
        if (params.name) {
            fetchCategoryAndQuestions();
            fetchCategoryScore();
        }
    }, [params.name]);

    useEffect(() => {
        if (searchQuery.trim() === "") {
            setFilteredQuestions(questions);
        } else {
            const filtered = questions.filter(
                (q) =>
                    q.question
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                    q.answer.toLowerCase().includes(searchQuery.toLowerCase()),
            );
            setFilteredQuestions(filtered);
        }
    }, [searchQuery, questions]);

    const fetchCategoryScore = async () => {
        setFetchingScore(true);
        try {
            const categoryName = decodeURIComponent(params.name as string);

            // Fetch category score
            const { data, error } = await supabase
                .from("category_scores")
                .select("*")
                .eq("category_name", categoryName)
                .single();

            if (error && error.code !== "PGRST116") {
                console.error("Error fetching category score:", error);
                return;
            }

            if (data) {
                setCategoryScore(data);
            }
        } catch (error) {
            console.error("Error fetching category score:", error);
        } finally {
            setFetchingScore(false);
        }
    };

    const fetchCategoryAndQuestions = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const categoryName = decodeURIComponent(params.name as string);

            // Get questions from this category
            const { data: questionsData, error: questionsError } =
                await supabase
                    .from("quiz_questions")
                    .select("*")
                    .eq("category", categoryName);

            if (questionsError) {
                throw new Error(
                    `Error fetching questions: ${questionsError.message}`,
                );
            }

            const formattedQuestions = questionsData.map((q) => {
                // Parse options array if needed
                let options = [];
                try {
                    options = Array.isArray(q.options)
                        ? q.options
                        : JSON.parse(q.options);
                } catch (e) {
                    console.error("Error parsing options:", e);
                    options = [];
                }

                const answer =
                    typeof q.answer === "string"
                        ? q.answer
                        : typeof q.answer === "number" && options.length > 0
                          ? options[q.answer]
                          : "";

                return {
                    id: q.id,
                    question: q.question || "No question text available",
                    options: options,
                    answer: answer,
                    explanation: q.explanation || "No explanation provided.",
                    category: {
                        name: categoryName,
                    },
                    related_material: q.related_material || null,
                };
            });

            setCategory({ name: categoryName });
            setQuestions(formattedQuestions);
            setFilteredQuestions(formattedQuestions);

            // Set default question count to min(10, total questions)
            const defaultCount = Math.min(10, formattedQuestions.length);
            setSelectedQuestionCount(defaultCount > 0 ? defaultCount : 1);
        } catch (error) {
            console.error("Error fetching data:", error);
            setError(
                error instanceof Error
                    ? error.message
                    : "An unknown error occurred",
            );
        } finally {
            setIsLoading(false);
        }
    };

    const toggleQuestion = (questionId: number) => {
        if (expandedQuestionId === questionId) {
            setExpandedQuestionId(null);
        } else {
            setExpandedQuestionId(questionId);
        }
    };

    // Quiz functions
    const startQuiz = async () => {
        // Validate question count
        const count = Number(selectedQuestionCount);

        if (isNaN(count) || count < 1) {
            toast.error("Please select at least 1 question for the quiz");
            return;
        }

        if (count > questions.length) {
            toast.error(
                `You can only select up to ${questions.length} questions`,
            );
            return;
        }

        // Get questions with options and randomize order
        const allQuizQuestions = shuffle(
            [...questions].filter((q) => q.options.length > 0),
        );

        // Select the specified number of questions
        const selectedQuizQuestions = allQuizQuestions.slice(0, count);

        // Format questions for QuizDisplay
        const formattedQuizQuestions = selectedQuizQuestions.map((q) => ({
            id: q.id.toString(),
            question: q.question,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation || "No explanation provided.",
            category: q.category,
            related_material: q.related_material || null,
        }));

        // Ensure category score exists before starting quiz
        if (!categoryScore) {
            try {
                const categoryName = decodeURIComponent(params.name as string);
                // Check if score exists
                const { data, error } = await supabase
                    .from("category_scores")
                    .select("*")
                    .eq("category_name", categoryName)
                    .single();

                if (error && error.code === "PGRST116") {
                    // No score found, create one
                    const { data: newScore, error: insertError } =
                        await supabase
                            .from("category_scores")
                            .insert({
                                category_name: categoryName,
                                questions_right: 0,
                                questions_solved: 0,
                            })
                            .select()
                            .single();

                    if (!insertError && newScore) {
                        setCategoryScore(newScore);
                    }
                }
            } catch (err) {
                console.error("Error ensuring category score exists:", err);
                // Continue anyway, the score will be created during quiz
            }
        }

        setQuizQuestions(formattedQuizQuestions);
        setShowQuiz(true);
        toast.success(`Starting quiz with ${count} questions`);
    };

    const startFlashCards = () => {
        // Get all questions and shuffle them
        const allFlashCardQuestions = shuffle([...questions]);

        // Format questions for FlashCardViewer
        const formattedFlashCardQuestions = allFlashCardQuestions.map((q) => ({
            id: q.id,
            question: q.question,
            answer: q.answer,
            explanation: q.explanation || undefined,
            category: q.category,
            related_material: q.related_material || null,
        }));

        setFlashCardQuestions(formattedFlashCardQuestions);
        setShowFlashCards(true);
        toast.success(
            `Starting flash card review with ${formattedFlashCardQuestions.length} cards`,
        );
    };

    const handleQuizComplete = async () => {
        // Ensure we update the database scores directly in addition to the callback
        setShowQuiz(false);

        // Fetch updated scores after waiting a bit for DB operations to complete
        setTimeout(() => {
            fetchCategoryScore();
        }, 1000);
    };

    const calculateSuccessRate = () => {
        if (!categoryScore || categoryScore.questions_solved === 0) return 0;
        return (
            (categoryScore.questions_right / categoryScore.questions_solved) *
            100
        );
    };

    const getPerformanceLabel = (percentage: number) => {
        if (percentage >= 90) return "Excellent";
        if (percentage >= 75) return "Good";
        if (percentage >= 60) return "Fair";
        if (percentage >= 40) return "Needs improvement";
        return "Requires practice";
    };

    const getStudyRecommendation = () => {
        const successRate = calculateSuccessRate();
        if (successRate === 0) return "Start practicing this category";
        if (successRate < 60) return "More practice recommended";
        if (successRate < 80) return "Some review suggested";
        return "You're doing great!";
    };

    const renderBrowseContent = () => {
        if (filteredQuestions.length === 0 && searchQuery) {
            return (
                <div className="text-center py-6">
                    <p className="text-muted-foreground">
                        No questions found matching &quot;{searchQuery}&quot;
                    </p>
                    <Button
                        variant="link"
                        onClick={() => setSearchQuery("")}
                        className="mt-2">
                        Clear search
                    </Button>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <AnimatePresence>
                    {filteredQuestions.map((question, index) => (
                        <motion.div
                            key={question.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.4,
                                delay: index * 0.05,
                            }}
                            whileHover={{
                                scale: 1.01,
                                backgroundColor: "rgba(240, 240, 240, 0.5)",
                            }}
                            className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                            onClick={() => setSelectedQuestion(question)}>
                            <div>
                                <p className="font-medium">
                                    {question.question}
                                </p>
                                {question.category && (
                                    <Badge
                                        variant="outline"
                                        className="mt-1">
                                        {typeof question.category === "object"
                                            ? question.category.name
                                            : question.category}
                                    </Badge>
                                )}
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        );
    };

    if (showQuiz) {
        return (
            <div className="container mx-auto py-8 space-y-6">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">
                        {category?.name} - Quiz
                    </h1>
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}>
                        <Button onClick={() => setShowQuiz(false)}>
                            Back to Category
                        </Button>
                    </motion.div>
                </motion.div>
                <QuizDisplay
                    questions={quizQuestions as any}
                    onComplete={(score, total) => {
                        // Update local scores state for immediate UI feedback
                        const updatedScore = {
                            id: categoryScore?.id || 0,
                            category_name: category?.name || "",
                            questions_right:
                                (categoryScore?.questions_right || 0) + score,
                            questions_solved:
                                (categoryScore?.questions_solved || 0) + total,
                        };
                        setCategoryScore(updatedScore);
                        handleQuizComplete();
                    }}
                />
            </div>
        );
    }

    if (showFlashCards) {
        return (
            <div className="container mx-auto py-8 space-y-6">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">
                        {category?.name} - Flash Cards
                    </h1>
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}>
                        <Button onClick={() => setShowFlashCards(false)}>
                            Back to Category
                        </Button>
                    </motion.div>
                </motion.div>

                <FlashCardViewer
                    questions={flashCardQuestions}
                    isOpen={true}
                    onClose={() => setShowFlashCards(false)}
                    title={`${category?.name} - Flash Cards`}
                />
            </div>
        );
    }

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
                                <Skeleton
                                    key={i}
                                    className="h-16 w-full"
                                />
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
                        onClick={() => router.push("/categories")}
                        className="flex items-center gap-2">
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
                        onClick={() => router.push("/categories")}
                        className="flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4" /> Back to Categories
                    </Button>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Quiz Configuration Card */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}>
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Brain className="h-5 w-5" />
                                    Quiz
                                </CardTitle>
                                <CardDescription>
                                    Test your knowledge with questions from this
                                    category
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {questions.length > 0 ? (
                                    <motion.div
                                        className="space-y-4"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{
                                            duration: 0.4,
                                            delay: 0.4,
                                        }}>
                                        <p>
                                            This category has {questions.length}{" "}
                                            questions available.
                                        </p>

                                        {/* Category performance stats */}
                                        {categoryScore &&
                                            categoryScore.questions_solved >
                                                0 && (
                                                <motion.div
                                                    className="border rounded-lg p-3 bg-slate-50"
                                                    initial={{
                                                        opacity: 0,
                                                        y: 10,
                                                    }}
                                                    animate={{
                                                        opacity: 1,
                                                        y: 0,
                                                    }}
                                                    transition={{
                                                        duration: 0.5,
                                                        delay: 0.5,
                                                    }}>
                                                    <h3 className="text-sm font-medium mb-2">
                                                        Performance Stats
                                                    </h3>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <p className="text-xs text-gray-500">
                                                                Correct
                                                            </p>
                                                            <p className="font-medium">
                                                                {
                                                                    categoryScore.questions_right
                                                                }{" "}
                                                                /{" "}
                                                                {
                                                                    categoryScore.questions_solved
                                                                }
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500">
                                                                Success Rate
                                                            </p>
                                                            <p className="font-medium">
                                                                {calculateSuccessRate().toFixed(
                                                                    1,
                                                                )}
                                                                %
                                                            </p>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}

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
                                                    value={
                                                        selectedQuestionCount
                                                    }
                                                    onChange={(e) => {
                                                        const value =
                                                            e.target.value;
                                                        setSelectedQuestionCount(
                                                            value === ""
                                                                ? ""
                                                                : Math.max(
                                                                      1,
                                                                      Math.min(
                                                                          parseInt(
                                                                              value,
                                                                          ) ||
                                                                              1,
                                                                          questions.length,
                                                                      ),
                                                                  ),
                                                        );
                                                    }}
                                                    min={1}
                                                    max={questions.length}
                                                    className="w-24"
                                                />
                                                <span className="text-sm text-muted-foreground">
                                                    of {questions.length}
                                                </span>
                                            </div>
                                        </div>

                                        <motion.div
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}>
                                            <Button
                                                onClick={startQuiz}
                                                className="w-full mb-2">
                                                Start Quiz
                                            </Button>
                                        </motion.div>

                                        <motion.div
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}>
                                            <Button
                                                onClick={startFlashCards}
                                                variant="outline"
                                                className="w-full flex items-center justify-center gap-2">
                                                <BookOpen className="h-4 w-4" />
                                                Start Flash Cards
                                            </Button>
                                        </motion.div>
                                    </motion.div>
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-muted-foreground">
                                            No questions available for this
                                            category.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Category Info Card */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Tag className="h-5 w-5" />
                                    Category: {category.name}
                                </CardTitle>
                                <CardDescription>
                                    Browse and search questions in this category
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {categoryScore &&
                                categoryScore.questions_solved > 0 ? (
                                    <motion.div
                                        className="border rounded-lg p-3 bg-slate-50"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            duration: 0.5,
                                            delay: 0.3,
                                        }}>
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-sm font-medium">
                                                Study Recommendation
                                            </h3>
                                            <Badge
                                                variant={
                                                    calculateSuccessRate() >= 75
                                                        ? "secondary"
                                                        : "outline"
                                                }
                                                className={
                                                    calculateSuccessRate() >= 75
                                                        ? "bg-green-100 text-green-800"
                                                        : ""
                                                }>
                                                {getPerformanceLabel(
                                                    calculateSuccessRate(),
                                                )}
                                            </Badge>
                                        </div>
                                        <p className="text-sm mt-2">
                                            {getStudyRecommendation()}
                                        </p>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        className="border rounded-lg p-3 bg-slate-50"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            duration: 0.5,
                                            delay: 0.3,
                                        }}>
                                        <p className="text-sm">
                                            No quiz attempts yet. Start a quiz
                                            to track your progress!
                                        </p>
                                    </motion.div>
                                )}

                                <div className="flex items-center space-x-2">
                                    <Search className="w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search questions..."
                                        value={searchQuery}
                                        onChange={(e) =>
                                            setSearchQuery(e.target.value)
                                        }
                                        className="flex-1"
                                    />
                                </div>
                                <div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">
                                                Total Questions
                                            </p>
                                            <p className="text-2xl font-bold">
                                                {questions.length}
                                            </p>
                                        </div>
                                        {questions.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-sm text-muted-foreground">
                                                    With Multiple Choice
                                                </p>
                                                <p className="text-2xl font-bold">
                                                    {
                                                        questions.filter(
                                                            (q) =>
                                                                q.options &&
                                                                q.options
                                                                    .length > 0,
                                                        ).length
                                                    }
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                {/* Questions List - Directly displayed instead of in tabs */}
                <div className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Browse Questions</CardTitle>
                            <CardDescription>
                                Explore all questions in this category
                            </CardDescription>
                        </CardHeader>
                        <CardContent>{renderBrowseContent()}</CardContent>
                    </Card>
                </div>
            </div>
        );
    };

    return (
        <div className="container py-6 space-y-8">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push("/categories")}
                        title="Back to Categories">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-2xl font-bold">
                        {isLoading
                            ? "Loading..."
                            : category
                              ? category.name
                              : "Category"}
                    </h1>
                </div>
                {fetchingScore ? (
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Loading stats...</span>
                    </div>
                ) : categoryScore && categoryScore.questions_solved > 0 ? (
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-medium">
                                Score: {calculateSuccessRate().toFixed(1)}%
                            </p>
                            <p className="text-xs text-gray-500">
                                {categoryScore.questions_right} of{" "}
                                {categoryScore.questions_solved} correct
                            </p>
                        </div>
                        <Badge
                            variant={
                                calculateSuccessRate() >= 75
                                    ? "secondary"
                                    : "outline"
                            }
                            className={
                                calculateSuccessRate() >= 75
                                    ? "bg-green-100 text-green-800"
                                    : ""
                            }>
                            {getPerformanceLabel(calculateSuccessRate())}
                        </Badge>
                    </div>
                ) : null}
            </motion.div>

            {renderContent()}

            {/* Question Details Dialog */}
            <Dialog
                open={!!selectedQuestion}
                onOpenChange={(open) => !open && setSelectedQuestion(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Question Details</DialogTitle>
                    </DialogHeader>

                    {selectedQuestion && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-medium text-sm text-gray-500">
                                    Question:
                                </h3>
                                <p className="mt-1">
                                    {selectedQuestion.question}
                                </p>
                            </div>

                            <div>
                                <h3 className="font-medium text-sm text-gray-500">
                                    Options:
                                </h3>
                                <div className="mt-2 space-y-2">
                                    {Array.isArray(selectedQuestion.options) &&
                                        selectedQuestion.options.map(
                                            (option: string, i: number) => (
                                                <div
                                                    key={i}
                                                    className={`p-2 rounded-md ${option === selectedQuestion.answer ? "bg-green-50 border border-green-200" : "bg-gray-50"}`}>
                                                    <div className="flex items-start">
                                                        <div
                                                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 ${option === selectedQuestion.answer ? "bg-green-100 text-green-800" : "bg-gray-200"}`}>
                                                            {String.fromCharCode(
                                                                65 + i,
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p
                                                                className={
                                                                    option ===
                                                                    selectedQuestion.answer
                                                                        ? "font-medium text-green-800"
                                                                        : ""
                                                                }>
                                                                {option}
                                                            </p>
                                                            {option ===
                                                                selectedQuestion.answer && (
                                                                <p className="text-xs text-green-600 mt-1">
                                                                    Correct
                                                                    Answer
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ),
                                        )}
                                </div>
                            </div>

                            {selectedQuestion.explanation && (
                                <div>
                                    <h3 className="font-medium text-sm text-gray-500">
                                        Explanation:
                                    </h3>
                                    <p className="mt-1 text-sm">
                                        {selectedQuestion.explanation}
                                    </p>
                                </div>
                            )}

                            {selectedQuestion.related_material && (
                                <div>
                                    <h3 className="font-medium text-sm text-gray-500">
                                        Related Image:
                                    </h3>
                                    <div
                                        className="mt-2 overflow-hidden rounded-md border cursor-pointer transition-all hover:opacity-90"
                                        onClick={() =>
                                            setExpandedImage(
                                                selectedQuestion.related_material,
                                            )
                                        }>
                                        <img
                                            src={
                                                selectedQuestion.related_material
                                            }
                                            alt="Related material for question"
                                            className="w-full h-auto max-h-[300px] object-contain"
                                        />
                                    </div>
                                    <p className="text-xs text-center text-gray-500 mt-1">
                                        Click image to expand
                                    </p>
                                </div>
                            )}

                            {selectedQuestion.category && (
                                <div>
                                    <h3 className="font-medium text-sm text-gray-500">
                                        Category:
                                    </h3>
                                    <Badge
                                        variant="outline"
                                        className="mt-1">
                                        {typeof selectedQuestion.category ===
                                            "object" &&
                                        selectedQuestion.category
                                            ? selectedQuestion.category.name
                                            : selectedQuestion.category}
                                    </Badge>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button onClick={() => setSelectedQuestion(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Expanded Image Dialog */}
            <Dialog
                open={!!expandedImage}
                onOpenChange={(open) => !open && setExpandedImage(null)}>
                <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-black/90">
                    <div className="relative">
                        <Button
                            variant="ghost"
                            className="absolute top-2 right-2 rounded-full bg-black/50 hover:bg-black/70 p-2 h-auto text-white"
                            onClick={() => setExpandedImage(null)}>
                            <X className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center justify-center p-2">
                            <img
                                src={expandedImage || ""}
                                alt="Expanded image"
                                className="max-h-[80vh] max-w-full object-contain"
                            />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
