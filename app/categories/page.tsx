"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tag, Search, Brain } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type Category = {
    name: string;
    created_at?: string;
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
    const router = useRouter();

    useEffect(() => {
        fetchCategories();
    }, []);

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
                    .select("name, created_at")
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

                // Combine categories with their counts and scores
                const categoriesWithCountsAndScores = categoriesData.map(
                    (category) => ({
                        name: category.name,
                        created_at: category.created_at,
                        question_count: questionCounts[category.name] || 0,
                        score: scoresByCategory[category.name] || undefined,
                    }),
                );

                setCategories(categoriesWithCountsAndScores);
            } catch (countError) {
                // If count query fails, still show categories with 0 counts
                console.warn("Error processing question counts:", countError);

                const categoriesWithZeroCounts = categoriesData.map(
                    (category) => ({
                        name: category.name,
                        created_at: category.created_at,
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

    const filteredCategories = categories.filter((category) =>
        category.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );

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
                        placeholder="Filter categories..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                    // Skeleton loading state
                    [...Array(6)].map((_, i) => (
                        <Card
                            key={i}
                            className="p-6">
                            <Skeleton className="h-6 w-32 mb-2" />
                            <Skeleton className="h-4 w-24" />
                        </Card>
                    ))
                ) : error ? (
                    // Error state
                    <div className="col-span-full">
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    </div>
                ) : filteredCategories.length === 0 ? (
                    // Empty state
                    <div className="col-span-full text-center py-8">
                        <p className="text-gray-500">
                            {categories.length === 0
                                ? "No categories available"
                                : "No categories match your search"}
                        </p>
                    </div>
                ) : (
                    // Categories grid
                    filteredCategories.map((category) => (
                        <Card
                            key={category.name}
                            className="cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() =>
                                router.push(
                                    `/categories/${encodeURIComponent(category.name)}`,
                                )
                            }>
                            <CardContent className="pt-6 pb-4 h-full flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Tag className="h-4 w-4" />
                                        <h3 className="font-medium">
                                            {category.name}
                                        </h3>
                                    </div>
                                    <Badge variant="secondary">
                                        {category.question_count} questions
                                    </Badge>
                                </div>

                                {category.score ? (
                                    category.score.questions_solved > 0 ? (
                                        // Score exists and has attempts
                                        <div className="mt-auto">
                                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                <div className="flex items-center gap-1">
                                                    <Brain className="h-3 w-3" />
                                                    <span>
                                                        {
                                                            category.score
                                                                .questions_right
                                                        }{" "}
                                                        /{" "}
                                                        {
                                                            category.score
                                                                .questions_solved
                                                        }{" "}
                                                        correct
                                                    </span>
                                                </div>
                                                <Badge
                                                    className={`font-medium text-xs ${getPerformanceBadgeClass(category.score.percentage)}`}>
                                                    {category.score.percentage.toFixed(
                                                        1,
                                                    )}
                                                    %
                                                </Badge>
                                            </div>
                                            <Progress
                                                className="h-1.5"
                                                value={
                                                    category.score.percentage
                                                }
                                                style={{
                                                    background: "#e5e7eb",
                                                }}
                                                color={`bg-[${getProgressColor(category.score.percentage)}]`}
                                            />
                                            <p
                                                className="text-xs mt-1"
                                                style={{
                                                    color: getPerformanceColor(
                                                        category.score
                                                            .percentage,
                                                    ),
                                                }}>
                                                {getPerformanceLabel(
                                                    category.score.percentage,
                                                )}
                                            </p>
                                        </div>
                                    ) : (
                                        // Score exists but no attempts (0/0)
                                        <div>
                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                <Brain className="h-3 w-3" />
                                                <span>
                                                    No quiz attempts yet
                                                </span>
                                            </div>
                                        </div>
                                    )
                                ) : null}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
