"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import supabase from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
    ChevronLeft,
    ChevronDown,
    Award,
    BookOpen,
    ChevronRight,
} from "lucide-react";

type CategoryScore = {
    id: number;
    category_name: string;
    questions_right: number;
    questions_solved: number;
    created_at: string;
};

type StudySetScore = {
    id: number;
    questions_right: number;
    questions_solved: number;
    created_at: string;
    study_set_name: string;
};

type CategoryScoreInsert = Omit<CategoryScore, "id">;
type StudySetScoreInsert = {
    id: number;
    questions_right: number;
    questions_solved: number;
    created_at: string;
};

// Add a CircularProgress component
const CircularProgress = ({
    value,
    size = 80,
    strokeWidth = 8,
    color = "rgb(37, 99, 235)",
    label,
}: {
    value: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
    label?: string;
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const dash = (value * circumference) / 100;

    return (
        <div className="flex flex-col items-center justify-center">
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="transform -rotate-90">
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#e6e6e6"
                    strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: circumference - dash }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                />
            </svg>
            <div className="text-center mt-2">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 1 }}
                    className="text-xl font-bold">
                    {value.toFixed(1)}%
                </motion.div>
                {label && (
                    <div className="text-xs text-gray-500 mt-1">{label}</div>
                )}
            </div>
        </div>
    );
};

export default function StatsPage() {
    const router = useRouter();
    const [categoryScores, setCategoryScores] = useState<CategoryScore[]>([]);
    const [studySetScores, setStudySetScores] = useState<StudySetScore[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [unstudiedCategories, setUnstudiedCategories] = useState<string[]>(
        [],
    );
    const [unstudiedStudySets, setUnstudiedStudySets] = useState<
        { id: number; name: string }[]
    >([]);

    useEffect(() => {
        fetchScores();
    }, []);

    const fetchScores = async () => {
        try {
            setIsLoading(true);

            // Fetch all categories from quiz_questions
            const { data: allCategoriesData, error: allCategoriesError } =
                await supabase
                    .from("quiz_questions")
                    .select("category")
                    .not("category", "is", null);

            if (allCategoriesError) {
                console.error("Error fetching categories:", allCategoriesError);
                throw allCategoriesError;
            }

            // Extract unique category names
            const uniqueCategories = [
                ...new Set(
                    allCategoriesData
                        .map((q) => q.category)
                        .filter((cat) => cat !== null && cat !== ""),
                ),
            ];

            // Fetch all category scores
            const { data: categoryData, error: categoryError } = await supabase
                .from("category_scores")
                .select("*")
                .order("questions_solved", { ascending: false });

            if (categoryError) {
                throw categoryError;
            }

            // Create a map of existing category scores
            const categoryScoreMap = new Map(
                (categoryData || []).map((cat) => [cat.category_name, cat]),
            );

            // Check for missing categories and create placeholder scores
            const missingCategories = uniqueCategories.filter(
                (cat) => !categoryScoreMap.has(cat),
            );

            if (missingCategories.length > 0) {
                // Create placeholder scores for missing categories
                const placeholderScores: CategoryScoreInsert[] =
                    missingCategories.map((categoryName) => ({
                        category_name: categoryName,
                        questions_right: 0,
                        questions_solved: 0,
                        created_at: new Date().toISOString(),
                    }));

                try {
                    // Insert placeholder scores into database
                    const { error: insertError } = await supabase
                        .from("category_scores")
                        .insert(placeholderScores);

                    if (insertError) {
                        console.error(
                            "Error creating placeholder category scores:",
                            JSON.stringify(insertError),
                        );

                        // Check if it's a column error which might happen during development/schema changes
                        if (
                            insertError.code === "PGRST204" ||
                            insertError.message?.includes("column") ||
                            insertError.message?.includes("does not exist")
                        ) {
                            console.warn(
                                "Schema error detected. Adding placeholders to local state only.",
                            );
                            // Still add placeholders to local state so the UI works
                            placeholderScores.forEach((score, index) => {
                                if (categoryData) {
                                    categoryData.push({
                                        ...score,
                                        id: -1 * (index + 1),
                                    });
                                }
                            });
                        }
                    } else {
                        console.log(
                            `Created ${placeholderScores.length} placeholder category scores`,
                        );
                        // Add the placeholders to our existing data with temporary IDs
                        placeholderScores.forEach((score, index) => {
                            if (categoryData) {
                                categoryData.push({
                                    ...score,
                                    id: -1 * (index + 1), // Use negative indexes to avoid collisions
                                });
                            }
                        });
                    }
                } catch (insertCategoryError) {
                    console.error(
                        "Exception creating category scores:",
                        insertCategoryError,
                    );
                }
            }

            setCategoryScores(categoryData || []);

            // For unstudied categories, all are technically "unstudied" if they have 0 solved questions
            const unstudiedCats = (categoryData || [])
                .filter((cat) => cat.questions_solved === 0)
                .map((cat) => cat.category_name);

            setUnstudiedCategories(unstudiedCats);

            // STUDY SETS SECTION

            // Fetch all study sets
            const { data: studySetsData, error: studySetsError } =
                await supabase.from("study_sets").select("id, name");

            if (studySetsError) {
                throw studySetsError;
            }

            // Fetch existing study set scores
            const { data: studySetScoresData, error: studySetScoresError } =
                await supabase
                    .from("study_set_scores")
                    .select(
                        `
                    id,
                    questions_right,
                    questions_solved,
                    created_at
                `,
                    )
                    .order("questions_solved", { ascending: false });

            if (studySetScoresError) {
                console.error(
                    "Error fetching study set scores:",
                    JSON.stringify(studySetScoresError),
                );
                throw studySetScoresError;
            }

            console.log("Fetched study set scores:", studySetScoresData);
            console.log("Fetched study sets:", studySetsData);

            // Create a map of study set IDs to names
            const studySetNameMap = (studySetsData || []).reduce(
                (map, set) => {
                    map[set.id] = set.name || `Study Set #${set.id}`;
                    return map;
                },
                {} as Record<number, string>,
            );

            // Create a map of existing study set scores
            const studySetScoreMap = new Map(
                (studySetScoresData || []).map((score) => [score.id, score]),
            );

            // Check for missing study set scores and create placeholders
            const missingStudySets = (studySetsData || [])
                .filter((set) => !studySetScoreMap.has(set.id))
                .map((set) => set.id);

            console.log("Missing study set scores for sets:", missingStudySets);

            if (missingStudySets.length > 0) {
                // Create placeholder scores for missing study sets
                const placeholderScores: StudySetScoreInsert[] =
                    missingStudySets.map((studySetId) => ({
                        id: studySetId, // Study set ID is stored directly as the ID
                        questions_right: 0,
                        questions_solved: 0,
                        created_at: new Date().toISOString(),
                    }));

                console.log(
                    "Preparing to insert placeholder scores:",
                    placeholderScores,
                );

                try {
                    // Insert placeholder scores into database with on_conflict do nothing
                    // in case there's a race condition with another insert
                    const { data: insertedData, error: insertError } =
                        await supabase
                            .from("study_set_scores")
                            .upsert(placeholderScores, {
                                onConflict: "id",
                                ignoreDuplicates: true,
                            })
                            .select();

                    if (insertError) {
                        console.error(
                            "Error creating placeholder study set scores:",
                            JSON.stringify(insertError),
                        );

                        // Add placeholders to local state regardless of error
                        placeholderScores.forEach((score) => {
                            if (studySetScoresData) {
                                studySetScoresData.push(score);
                            }
                        });
                    } else {
                        console.log(
                            `Upserted ${placeholderScores.length} placeholder study set scores, received:`,
                            insertedData,
                        );

                        // Add any returned data to our state
                        if (
                            insertedData &&
                            insertedData.length > 0 &&
                            studySetScoresData
                        ) {
                            studySetScoresData.push(...insertedData);
                        } else {
                            // Fallback - add our placeholders
                            placeholderScores.forEach((score) => {
                                if (studySetScoresData) {
                                    studySetScoresData.push(score);
                                }
                            });
                        }
                    }
                } catch (insertStudySetError) {
                    console.error(
                        "Exception creating study set scores:",
                        insertStudySetError,
                    );

                    // Add placeholders to local state in case of error
                    placeholderScores.forEach((score) => {
                        if (studySetScoresData) {
                            studySetScoresData.push(score);
                        }
                    });
                }
            }

            // Format all study set scores with names
            const formattedStudySetScores = (studySetScoresData || []).map(
                (score) => {
                    // The ID in study_set_scores is the study set ID
                    const studySetId = score.id;
                    return {
                        id: score.id,
                        questions_right: score.questions_right,
                        questions_solved: score.questions_solved,
                        created_at: score.created_at,
                        study_set_name:
                            studySetNameMap[studySetId] ||
                            `Study Set #${studySetId}`,
                    };
                },
            );

            setStudySetScores(formattedStudySetScores);

            // For unstudied study sets, all are technically "unstudied" if they have 0 solved questions
            const unstudiedSets = formattedStudySetScores
                .filter((set) => set.questions_solved === 0)
                .map((set) => ({
                    id: set.id,
                    name: set.study_set_name,
                }));

            setUnstudiedStudySets(unstudiedSets);
        } catch (error) {
            console.error(
                "Error fetching scores:",
                error instanceof Error ? error.message : JSON.stringify(error),
            );
            toast.error("Failed to load performance stats");
        } finally {
            setIsLoading(false);
        }
    };

    const calculatePerformance = (right: number, total: number) => {
        if (total === 0) return 0;
        return (right / total) * 100;
    };

    const getPerformanceLabel = (percentage: number) => {
        if (percentage >= 90) return "Excellent";
        if (percentage >= 75) return "Good";
        if (percentage >= 60) return "Average";
        if (percentage >= 40) return "Need Practice";
        return "Poor";
    };

    const getPerformanceColor = (percentage: number) => {
        if (percentage >= 90) return "bg-green-100 text-green-800";
        if (percentage >= 75) return "bg-emerald-100 text-emerald-800";
        if (percentage >= 60) return "bg-blue-100 text-blue-800";
        if (percentage >= 40) return "bg-amber-100 text-amber-800";
        return "bg-red-100 text-red-800";
    };

    // Calculate overall performance across all categories and study sets
    const calculateOverallStats = () => {
        // For categories
        const categoryTotals = categoryScores
            .filter((cat) => cat.questions_solved > 0)
            .reduce(
                (acc, cat) => ({
                    right: acc.right + cat.questions_right,
                    total: acc.total + cat.questions_solved,
                }),
                { right: 0, total: 0 },
            );

        // For study sets
        const studySetTotals = studySetScores
            .filter((set) => set.questions_solved > 0)
            .reduce(
                (acc, set) => ({
                    right: acc.right + set.questions_right,
                    total: acc.total + set.questions_solved,
                }),
                { right: 0, total: 0 },
            );

        return {
            categories:
                categoryTotals.total > 0
                    ? (categoryTotals.right / categoryTotals.total) * 100
                    : 0,
            studySets:
                studySetTotals.total > 0
                    ? (studySetTotals.right / studySetTotals.total) * 100
                    : 0,
            overall:
                categoryTotals.total + studySetTotals.total > 0
                    ? ((categoryTotals.right + studySetTotals.right) /
                          (categoryTotals.total + studySetTotals.total)) *
                      100
                    : 0,
        };
    };

    const getProgressColor = (percentage: number) => {
        if (percentage >= 90) return "#4ade80"; // green-400
        if (percentage >= 75) return "#34d399"; // emerald-400
        if (percentage >= 60) return "#60a5fa"; // blue-400
        if (percentage >= 40) return "#fbbf24"; // amber-400
        return "#f87171"; // red-400
    };

    return (
        <div className="container mx-auto py-8 space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push("/")}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <Image
                            src="/study-sets-logo.png"
                            alt="Study Sets Logo"
                            width={40}
                            height={40}
                            className="rounded-md"
                        />
                        <h1 className="text-3xl font-bold">
                            Performance Stats
                        </h1>
                    </div>
                </div>
            </motion.div>

            {/* Overall Performance Charts */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}>
                <Card>
                    <CardHeader>
                        <CardTitle>Overall Performance</CardTitle>
                        <CardDescription>
                            Your overall progress in quizzes
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <p>Loading stats...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-4">
                                {/* Overall Performance */}
                                <div className="flex flex-col items-center">
                                    <CircularProgress
                                        value={calculateOverallStats().overall}
                                        color={getProgressColor(
                                            calculateOverallStats().overall,
                                        )}
                                        label="Overall Success Rate"
                                    />
                                </div>

                                {/* Categories Performance */}
                                <div className="flex flex-col items-center">
                                    <CircularProgress
                                        value={
                                            calculateOverallStats().categories
                                        }
                                        color={getProgressColor(
                                            calculateOverallStats().categories,
                                        )}
                                        label="Category Success"
                                    />
                                </div>

                                {/* Study Sets Performance */}
                                <div className="flex flex-col items-center">
                                    <CircularProgress
                                        value={
                                            calculateOverallStats().studySets
                                        }
                                        color={getProgressColor(
                                            calculateOverallStats().studySets,
                                        )}
                                        label="Study Sets Success"
                                    />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Categories Performance */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Award className="h-5 w-5 text-primary" />
                                    Categories Performance
                                </CardTitle>
                                <CardDescription>
                                    See how well you're doing in each topic
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex justify-center py-8">
                                    <p>Loading stats...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Categories with activity */}
                                    <AnimatePresence>
                                        {categoryScores.filter(
                                            (cat) => cat.questions_solved > 0,
                                        ).length > 0 ? (
                                            <div className="space-y-3">
                                                {categoryScores
                                                    .filter(
                                                        (cat) =>
                                                            cat.questions_solved >
                                                            0,
                                                    )
                                                    .map((category, index) => {
                                                        const performance =
                                                            calculatePerformance(
                                                                category.questions_right,
                                                                category.questions_solved,
                                                            );

                                                        return (
                                                            <motion.div
                                                                key={`category-${category.id}-${category.category_name}`}
                                                                initial={{
                                                                    opacity: 0,
                                                                    y: 20,
                                                                }}
                                                                animate={{
                                                                    opacity: 1,
                                                                    y: 0,
                                                                }}
                                                                transition={{
                                                                    duration: 0.4,
                                                                    delay:
                                                                        index *
                                                                        0.1,
                                                                }}
                                                                className="flex items-center cursor-pointer justify-between p-3 border rounded-md hover:border-primary hover:bg-card"
                                                                onClick={() =>
                                                                    router.push(
                                                                        `/categories/${encodeURIComponent(category.category_name)}`,
                                                                    )
                                                                }
                                                                whileHover={{
                                                                    scale: 1.02,
                                                                    boxShadow:
                                                                        "0 4px 8px rgba(0,0,0,0.05)",
                                                                }}>
                                                                <div>
                                                                    <h3 className="font-medium flex items-center gap-1">
                                                                        {
                                                                            category.category_name
                                                                        }
                                                                        <ChevronRight className="h-4 w-4 text-primary opacity-70" />
                                                                    </h3>
                                                                    <p className="text-sm text-gray-500">
                                                                        {
                                                                            category.questions_right
                                                                        }{" "}
                                                                        correct
                                                                        out of{" "}
                                                                        {
                                                                            category.questions_solved
                                                                        }
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-18 flex justify-center">
                                                                        <CircularProgress
                                                                            value={
                                                                                performance
                                                                            }
                                                                            size={
                                                                                40
                                                                            }
                                                                            strokeWidth={
                                                                                4
                                                                            }
                                                                            color={getProgressColor(
                                                                                performance,
                                                                            )}
                                                                        />
                                                                    </div>
                                                                    <div className="w-24 flex justify-end">
                                                                        <Badge
                                                                            className={getPerformanceColor(
                                                                                performance,
                                                                            )}>
                                                                            {getPerformanceLabel(
                                                                                performance,
                                                                            )}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        );
                                                    })}
                                            </div>
                                        ) : (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="text-center py-4 text-gray-500">
                                                <p>
                                                    No category stats available
                                                    yet
                                                </p>
                                                <p className="text-sm">
                                                    Complete some quizzes to see
                                                    your performance
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Unstudied categories */}
                                    {unstudiedCategories.length > 0 && (
                                        <Accordion
                                            type="single"
                                            collapsible
                                            className="mt-4">
                                            <AccordionItem value="unstudied-categories">
                                                <AccordionTrigger className="text-gray-500">
                                                    {unstudiedCategories.length}{" "}
                                                    unstudied categories
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="space-y-2 mt-2">
                                                        <AnimatePresence>
                                                            {unstudiedCategories.map(
                                                                (
                                                                    category,
                                                                    index,
                                                                ) => (
                                                                    <motion.div
                                                                        key={`unstudied-category-${index}-${category}`}
                                                                        initial={{
                                                                            opacity: 0,
                                                                            y: 10,
                                                                        }}
                                                                        animate={{
                                                                            opacity: 1,
                                                                            y: 0,
                                                                        }}
                                                                        transition={{
                                                                            duration: 0.3,
                                                                            delay:
                                                                                index *
                                                                                0.05,
                                                                        }}
                                                                        className="p-2 border rounded-md flex items-center justify-between cursor-pointer hover:border-primary hover:bg-card"
                                                                        onClick={() =>
                                                                            router.push(
                                                                                `/categories/${encodeURIComponent(category)}`,
                                                                            )
                                                                        }
                                                                        whileHover={{
                                                                            scale: 1.02,
                                                                        }}>
                                                                        <span className="flex items-center gap-1">
                                                                            {
                                                                                category
                                                                            }
                                                                            <ChevronRight className="h-4 w-4 text-primary opacity-70" />
                                                                        </span>
                                                                        <Badge variant="outline">
                                                                            Not
                                                                            studied
                                                                            yet
                                                                        </Badge>
                                                                    </motion.div>
                                                                ),
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Study Sets Performance */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.6 }}>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <BookOpen className="h-5 w-5 text-primary" />
                                    Study Sets Performance
                                </CardTitle>
                                <CardDescription>
                                    Your progress across different study sets
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex justify-center py-8">
                                    <p>Loading stats...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Study sets with activity */}
                                    <AnimatePresence>
                                        {studySetScores.filter(
                                            (set) => set.questions_solved > 0,
                                        ).length > 0 ? (
                                            <div className="space-y-3">
                                                {studySetScores
                                                    .filter(
                                                        (set) =>
                                                            set.questions_solved >
                                                            0,
                                                    )
                                                    .map((set, index) => {
                                                        const performance =
                                                            calculatePerformance(
                                                                set.questions_right,
                                                                set.questions_solved,
                                                            );

                                                        return (
                                                            <motion.div
                                                                key={`study-set-${set.id}-${set.study_set_name}`}
                                                                initial={{
                                                                    opacity: 0,
                                                                    y: 20,
                                                                }}
                                                                animate={{
                                                                    opacity: 1,
                                                                    y: 0,
                                                                }}
                                                                transition={{
                                                                    duration: 0.4,
                                                                    delay:
                                                                        index *
                                                                        0.1,
                                                                }}
                                                                className="flex items-center justify-between p-3 border rounded-md cursor-pointer hover:border-primary hover:bg-card"
                                                                onClick={() =>
                                                                    router.push(
                                                                        `/study-set/${set.id}`,
                                                                    )
                                                                }
                                                                whileHover={{
                                                                    scale: 1.02,
                                                                    boxShadow:
                                                                        "0 4px 8px rgba(0,0,0,0.05)",
                                                                }}>
                                                                <div>
                                                                    <h3 className="font-medium flex items-center gap-1">
                                                                        {
                                                                            set.study_set_name
                                                                        }
                                                                        <ChevronRight className="h-4 w-4 text-primary opacity-70" />
                                                                    </h3>
                                                                    <p className="text-sm text-gray-500">
                                                                        {
                                                                            set.questions_right
                                                                        }{" "}
                                                                        correct
                                                                        out of{" "}
                                                                        {
                                                                            set.questions_solved
                                                                        }
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-18 flex justify-center">
                                                                        <CircularProgress
                                                                            value={
                                                                                performance
                                                                            }
                                                                            size={
                                                                                40
                                                                            }
                                                                            strokeWidth={
                                                                                4
                                                                            }
                                                                            color={getProgressColor(
                                                                                performance,
                                                                            )}
                                                                        />
                                                                    </div>
                                                                    <div className="w-24 flex justify-end">
                                                                        <Badge
                                                                            className={getPerformanceColor(
                                                                                performance,
                                                                            )}>
                                                                            {getPerformanceLabel(
                                                                                performance,
                                                                            )}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        );
                                                    })}
                                            </div>
                                        ) : (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="text-center py-4 text-gray-500">
                                                <p>
                                                    No study set stats available
                                                    yet
                                                </p>
                                                <p className="text-sm">
                                                    Complete some quizzes to see
                                                    your performance
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Unstudied study sets */}
                                    {unstudiedStudySets.length > 0 && (
                                        <Accordion
                                            type="single"
                                            collapsible
                                            className="mt-4">
                                            <AccordionItem value="unstudied-study-sets">
                                                <AccordionTrigger className="text-gray-500">
                                                    {unstudiedStudySets.length}{" "}
                                                    unstudied study sets
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="space-y-2 mt-2">
                                                        <AnimatePresence>
                                                            {unstudiedStudySets.map(
                                                                (
                                                                    set,
                                                                    index,
                                                                ) => (
                                                                    <motion.div
                                                                        key={`unstudied-set-${set.id}-${set.name}`}
                                                                        initial={{
                                                                            opacity: 0,
                                                                            y: 10,
                                                                        }}
                                                                        animate={{
                                                                            opacity: 1,
                                                                            y: 0,
                                                                        }}
                                                                        transition={{
                                                                            duration: 0.3,
                                                                            delay:
                                                                                index *
                                                                                0.05,
                                                                        }}
                                                                        className="p-2 border rounded-md flex items-center justify-between cursor-pointer hover:border-primary hover:bg-card"
                                                                        onClick={() =>
                                                                            router.push(
                                                                                `/study-set/${set.id}`,
                                                                            )
                                                                        }
                                                                        whileHover={{
                                                                            scale: 1.02,
                                                                        }}>
                                                                        <span className="flex items-center gap-1">
                                                                            {
                                                                                set.name
                                                                            }
                                                                            <ChevronRight className="h-4 w-4 text-primary opacity-70" />
                                                                        </span>
                                                                        <Badge variant="outline">
                                                                            Not
                                                                            studied
                                                                            yet
                                                                        </Badge>
                                                                    </motion.div>
                                                                ),
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
