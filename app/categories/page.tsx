"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Tag,
    Search,
    Brain,
    BookOpen,
    Atom,
    Code,
    Microscope,
    Globe,
    Calculator,
    Book,
    Music,
    Palette,
    Beaker,
    Building,
    History,
    LibraryBig,
    GraduationCap,
    PlusCircle,
    AlertCircle,
    ChevronDown,
} from "lucide-react";

type Category = {
    name: string;
    created_at?: string;
    subject?: string;
    question_count: number;
    score?: {
        questions_right: number;
        questions_solved: number;
        percentage: number;
    };
};

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
    const router = useRouter();

    useEffect(() => {
        fetchCategories();
    }, []);

    // Initialize expanded subjects - now we leave it empty to start with all closed
    useEffect(() => {
        if (!isLoading && categories.length > 0) {
            // Start with all subjects collapsed
            setExpandedSubjects([]);
        }
    }, [isLoading, categories]);

    // Function to handle accordion value change
    const handleAccordionChange = (values: string[]) => {
        setExpandedSubjects(values);
    };

    const fetchCategories = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Check if Supabase is properly initialized
            if (!supabase) {
                setError(
                    "Database connection not available. Please try again later.",
                );
                setIsLoading(false);
                return;
            }

            // Get all categories
            const { data: categoriesData, error: categoriesError } =
                await supabase
                    .from("categories")
                    .select("name, created_at, subject")
                    .order("name");

            if (categoriesError) {
                setError(
                    `Error fetching categories: ${categoriesError.message}`,
                );
                setIsLoading(false);
                return;
            }

            if (!categoriesData || categoriesData.length === 0) {
                setCategories([]);
                setIsLoading(false);
                return;
            }

            try {
                // Get all question counts in a single query
                const { data: counts, error: countsError } = await supabase
                    .from("quiz_questions")
                    .select("category");

                // Fetch category scores
                const { data: categoryScoresData, error: categoryScoresError } =
                    await supabase.from("category_scores").select("*");

                if (countsError) {
                    // Just log the error but continue with empty counts
                    console.warn(
                        "Error fetching question counts:",
                        countsError,
                    );

                    // Still show categories but with 0 question counts
                    const categoriesWithZeroCounts = categoriesData.map(
                        (category) => ({
                            name: category.name,
                            created_at: category.created_at,
                            subject: category.subject,
                            question_count: 0,
                        }),
                    );

                    setCategories(categoriesWithZeroCounts);
                    setIsLoading(false);
                    return;
                }

                // Map category scores for easy access
                const scoresByCategory = (categoryScoresData || []).reduce(
                    (acc, score) => {
                        acc[score.category_name] = {
                            questions_right: score.questions_right,
                            questions_solved: score.questions_solved,
                            percentage:
                                score.questions_solved > 0
                                    ? (score.questions_right /
                                          score.questions_solved) *
                                      100
                                    : 0,
                        };
                        return acc;
                    },
                    {} as Record<
                        string,
                        {
                            questions_right: number;
                            questions_solved: number;
                            percentage: number;
                        }
                    >,
                );

                // Count questions per category
                const questionCounts =
                    counts?.reduce<Record<string, number>>((acc, curr) => {
                        const category = curr.category;
                        if (category) {
                            acc[category] = (acc[category] || 0) + 1;
                        }
                        return acc;
                    }, {}) || {};

                // Combine all the data
                const categoriesWithCounts = categoriesData.map((category) => {
                    // Count questions for this category
                    const questionCount = (counts || []).filter(
                        (q) => q.category === category.name,
                    ).length;

                    // Get score for this category
                    const score = scoresByCategory[category.name];

                    return {
                        name: category.name,
                        created_at: category.created_at,
                        subject: category.subject,
                        question_count: questionCount,
                        score,
                    };
                });

                setCategories(categoriesWithCounts);
            } catch (countError) {
                // If count query fails, still show categories with 0 counts
                console.warn("Error processing question counts:", countError);

                const categoriesWithZeroCounts = categoriesData.map(
                    (category) => ({
                        name: category.name,
                        created_at: category.created_at,
                        subject: category.subject,
                        question_count: 0,
                    }),
                );

                setCategories(categoriesWithZeroCounts);
            }
        } catch (error) {
            setError("An unexpected error occurred. Please try again later.");
            console.error("Error in fetchCategories:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Group categories by subject
    const getCategoriesBySubject = (cats: Category[]) => {
        const grouped: Record<string, Category[]> = {};

        // Handle categories without a subject
        const uncategorized: Category[] = [];

        cats.forEach((category) => {
            if (category.subject) {
                if (!grouped[category.subject]) {
                    grouped[category.subject] = [];
                }
                grouped[category.subject].push(category);
            } else {
                uncategorized.push(category);
            }
        });

        // Add uncategorized at the end if there are any
        if (uncategorized.length > 0) {
            grouped["Uncategorized"] = uncategorized;
        }

        return grouped;
    };

    const getPerformanceLabel = (percentage: number) => {
        if (percentage >= 90) return "Excellent";
        if (percentage >= 75) return "Good";
        if (percentage >= 60) return "Average";
        if (percentage >= 40) return "Need Practice";
        return "Poor";
    };

    const getPerformanceColor = (percentage: number) => {
        if (percentage >= 90) return "#16a34a"; // green-700
        if (percentage >= 75) return "#059669"; // emerald-600
        if (percentage >= 60) return "#2563eb"; // blue-600
        if (percentage >= 40) return "#d97706"; // amber-600
        return "#dc2626"; // red-600
    };

    const getProgressColor = (percentage: number) => {
        if (percentage >= 90) return "#4ade80"; // green-400
        if (percentage >= 75) return "#34d399"; // emerald-400
        if (percentage >= 60) return "#60a5fa"; // blue-400
        if (percentage >= 40) return "#fbbf24"; // amber-400
        return "#f87171"; // red-400
    };

    const getPerformanceBadgeClass = (percentage: number) => {
        if (percentage >= 90) return "bg-green-100 text-green-800";
        if (percentage >= 75) return "bg-emerald-100 text-emerald-800";
        if (percentage >= 60) return "bg-blue-100 text-blue-800";
        if (percentage >= 40) return "bg-amber-100 text-amber-800";
        return "bg-red-100 text-red-800";
    };

    const getSubjectIcon = (subject: string) => {
        const iconMap: Record<string, any> = {
            Mathematics: Calculator,
            Physics: Atom,
            Chemistry: Beaker,
            Biology: Microscope,
            History: History,
            Literature: Book,
            "Computer Science": Code,
            Economics: Building,
            Geography: Globe,
            Art: Palette,
            Music: Music,
            Philosophy: GraduationCap,
            Education: BookOpen,
            Uncategorized: Tag,
        };

        // Return the mapped icon or a default
        const IconComponent = iconMap[subject] || LibraryBig;
        return <IconComponent className="h-6 w-6" />;
    };

    const filteredCategories = categories.filter(
        (category) =>
            category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (category.subject
                ?.toLowerCase()
                .includes(searchTerm.toLowerCase()) ??
                false),
    );

    const categoriesBySubject = getCategoriesBySubject(filteredCategories);

    // Sort subject keys alphabetically but keep Uncategorized at the end
    const subjectKeys = Object.keys(categoriesBySubject).sort((a, b) => {
        if (a === "Uncategorized") return 1;
        if (b === "Uncategorized") return -1;
        return a.localeCompare(b);
    });

    // Check if we have any categories after filtering
    const hasCategories = subjectKeys.length > 0;

    return (
        <div className="container mx-auto py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Categories</h1>
                    <p className="text-gray-500 mt-1">
                        Browse all available question categories
                    </p>
                </div>
                <div className="relative max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        type="search"
                        placeholder="Filter categories or subjects..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Stats section */}
            {!isLoading && !error && categories.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Card>
                        <CardContent className="flex items-center p-6">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mr-4">
                                <LibraryBig className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Subjects
                                </p>
                                <h3 className="text-2xl font-bold">
                                    {
                                        Object.keys(
                                            getCategoriesBySubject(categories),
                                        ).length
                                    }
                                </h3>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="flex items-center p-6">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 text-purple-600 mr-4">
                                <Tag className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Categories
                                </p>
                                <h3 className="text-2xl font-bold">
                                    {categories.length}
                                </h3>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="flex items-center p-6">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-600 mr-4">
                                <Brain className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Total Questions
                                </p>
                                <h3 className="text-2xl font-bold">
                                    {categories.reduce(
                                        (sum, cat) => sum + cat.question_count,
                                        0,
                                    )}
                                </h3>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {isLoading ? (
                // Skeleton loading state
                <div className="space-y-8">
                    {[...Array(3)].map((_, i) => (
                        <div
                            key={i}
                            className="space-y-4">
                            <Skeleton className="h-8 w-48" />
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[...Array(3)].map((_, j) => (
                                    <Card
                                        key={j}
                                        className="p-6">
                                        <Skeleton className="h-6 w-32 mb-2" />
                                        <Skeleton className="h-4 w-24" />
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : error ? (
                // Error state
                <div>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </div>
            ) : !hasCategories ? (
                // Empty state
                <div className="text-center py-12 px-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-4">
                        <Tag className="h-10 w-10 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-medium text-gray-900 mb-2">
                        {categories.length === 0
                            ? "No categories available"
                            : "No categories match your search"}
                    </h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-6">
                        {categories.length === 0
                            ? "Start by creating a new category to organize your questions."
                            : "Try adjusting your search term or browse all categories."}
                    </p>
                    {categories.length === 0 ? (
                        <Button
                            className="inline-flex items-center"
                            onClick={() => router.push("/quiz-generator")}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create New Category
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            className="inline-flex items-center"
                            onClick={() => setSearchTerm("")}>
                            Show All Categories
                        </Button>
                    )}
                </div>
            ) : (
                // Categories by subject
                <div className="space-y-6">
                    <Accordion
                        type="multiple"
                        className="space-y-4"
                        value={expandedSubjects}
                        onValueChange={handleAccordionChange}>
                        {subjectKeys.map((subject) => {
                            const subjectCategories =
                                categoriesBySubject[subject];
                            const totalQuestions = subjectCategories.reduce(
                                (sum, cat) => sum + cat.question_count,
                                0,
                            );

                            return (
                                <AccordionItem
                                    key={subject}
                                    value={subject}
                                    className="border rounded-lg shadow-sm overflow-hidden bg-white">
                                    <AccordionTrigger className="py-4 px-6 hover:no-underline data-[state=open]:bg-primary/5 data-[state=closed]:hover:bg-muted/10 transition-colors">
                                        <div className="flex items-center justify-between w-full text-left pr-4">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary">
                                                    {getSubjectIcon(subject)}
                                                </div>
                                                <div>
                                                    <h2 className="text-xl font-bold text-primary">
                                                        {subject}
                                                    </h2>
                                                    <div className="flex items-center mt-1">
                                                        <Badge
                                                            variant="outline"
                                                            className="font-normal">
                                                            {
                                                                subjectCategories.length
                                                            }{" "}
                                                            {subjectCategories.length ===
                                                            1
                                                                ? "category"
                                                                : "categories"}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 mr-2">
                                                <Badge className="bg-primary/10 text-primary text-sm px-3 py-1">
                                                    {totalQuestions}{" "}
                                                    {totalQuestions === 1
                                                        ? "question"
                                                        : "questions"}
                                                </Badge>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-6 pb-6 pt-4 bg-slate-50/30">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <AnimatePresence mode="popLayout">
                                                {subjectCategories.map(
                                                    (category) => (
                                                        <motion.div
                                                            key={category.name}
                                                            layout
                                                            className="h-full"
                                                            initial={{
                                                                opacity: 0,
                                                                scale: 0.95,
                                                            }}
                                                            animate={{
                                                                opacity: 1,
                                                                scale: 1,
                                                            }}
                                                            exit={{
                                                                opacity: 0,
                                                                scale: 0.95,
                                                            }}
                                                            transition={{
                                                                duration: 0.2,
                                                            }}>
                                                            <Card
                                                                className="cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col bg-white border-muted/70"
                                                                onClick={() =>
                                                                    router.push(
                                                                        `/categories/${encodeURIComponent(category.name)}`,
                                                                    )
                                                                }>
                                                                <CardContent className="p-5 flex-grow">
                                                                    <div className="flex flex-col space-y-3 h-full">
                                                                        <div className="flex justify-between items-start">
                                                                            <h3 className="font-medium text-lg line-clamp-2">
                                                                                {
                                                                                    category.name
                                                                                }
                                                                            </h3>
                                                                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                                                                                {
                                                                                    category.question_count
                                                                                }{" "}
                                                                                {category.question_count ===
                                                                                1
                                                                                    ? "question"
                                                                                    : "questions"}
                                                                            </Badge>
                                                                        </div>

                                                                        <div className="flex-grow">
                                                                            {category.score ? (
                                                                                category
                                                                                    .score
                                                                                    .questions_solved >
                                                                                0 ? (
                                                                                    <div className="space-y-2">
                                                                                        <div className="flex justify-between text-xs">
                                                                                            <span className="text-muted-foreground">
                                                                                                Progress
                                                                                            </span>
                                                                                            <span className="font-medium">
                                                                                                {
                                                                                                    category
                                                                                                        .score
                                                                                                        .questions_solved
                                                                                                }{" "}
                                                                                                /{" "}
                                                                                                {
                                                                                                    category.question_count
                                                                                                }{" "}
                                                                                                attempted
                                                                                            </span>
                                                                                        </div>
                                                                                        <Progress
                                                                                            value={Math.min(
                                                                                                100,
                                                                                                Math.round(
                                                                                                    (category
                                                                                                        .score
                                                                                                        .questions_solved /
                                                                                                        category.question_count) *
                                                                                                        100,
                                                                                                ),
                                                                                            )}
                                                                                            className="h-2"
                                                                                        />

                                                                                        <div className="flex justify-between text-xs mt-2">
                                                                                            <span className="text-muted-foreground">
                                                                                                Performance
                                                                                            </span>
                                                                                            <span
                                                                                                className="font-medium"
                                                                                                style={{
                                                                                                    color: getPerformanceColor(
                                                                                                        category
                                                                                                            .score
                                                                                                            .percentage,
                                                                                                    ),
                                                                                                }}>
                                                                                                {
                                                                                                    category
                                                                                                        .score
                                                                                                        .questions_right
                                                                                                }{" "}
                                                                                                /{" "}
                                                                                                {
                                                                                                    category
                                                                                                        .score
                                                                                                        .questions_solved
                                                                                                }{" "}
                                                                                                correct
                                                                                            </span>
                                                                                        </div>
                                                                                        <Progress
                                                                                            value={
                                                                                                category
                                                                                                    .score
                                                                                                    .percentage
                                                                                            }
                                                                                            className="h-2"
                                                                                            style={
                                                                                                {
                                                                                                    background:
                                                                                                        "#e5e7eb",
                                                                                                    "--progress-foreground":
                                                                                                        getProgressColor(
                                                                                                            category
                                                                                                                .score
                                                                                                                .percentage,
                                                                                                        ),
                                                                                                } as any
                                                                                            }
                                                                                        />
                                                                                        <p
                                                                                            className="text-xs mt-1 font-medium"
                                                                                            style={{
                                                                                                color: getPerformanceColor(
                                                                                                    category
                                                                                                        .score
                                                                                                        .percentage,
                                                                                                ),
                                                                                            }}>
                                                                                            {getPerformanceLabel(
                                                                                                category
                                                                                                    .score
                                                                                                    .percentage,
                                                                                            )}
                                                                                        </p>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-auto">
                                                                                        <Brain className="h-3 w-3" />
                                                                                        <span>
                                                                                            No
                                                                                            quiz
                                                                                            attempts
                                                                                            yet
                                                                                        </span>
                                                                                    </div>
                                                                                )
                                                                            ) : category.question_count >
                                                                              0 ? (
                                                                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                                                                                    <Brain className="h-3 w-3" />
                                                                                    <span>
                                                                                        Take
                                                                                        a
                                                                                        quiz
                                                                                        to
                                                                                        track
                                                                                        progress
                                                                                    </span>
                                                                                </div>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        </motion.div>
                                                    ),
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                </div>
            )}
        </div>
    );
}
