"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tag, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type Category = {
    name: string;
    created_at?: string;
    question_count: number;
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
                setError("Database connection not available. Please try again later.");
                setIsLoading(false);
                return;
            }

            // Get all categories
            const { data: categoriesData, error: categoriesError } = await supabase
                .from("categories")
                .select("name, created_at")
                .order("name");

            if (categoriesError) {
                setError(`Error fetching categories: ${categoriesError.message}`);
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

                if (countsError) {
                    // Just log the error but continue with empty counts
                    console.warn("Error fetching question counts:", countsError);
                    
                    // Still show categories but with 0 question counts
                    const categoriesWithZeroCounts = categoriesData.map(category => ({
                        name: category.name,
                        created_at: category.created_at,
                        question_count: 0
                    }));
                    
                    setCategories(categoriesWithZeroCounts);
                    setIsLoading(false);
                    return;
                }

                // Count questions per category
                const questionCounts = counts?.reduce<Record<string, number>>((acc, curr) => {
                    const category = curr.category;
                    if (category) {
                        acc[category] = (acc[category] || 0) + 1;
                    }
                    return acc;
                }, {}) || {};

                // Combine categories with their counts
                const categoriesWithCounts = categoriesData.map(category => ({
                    name: category.name,
                    created_at: category.created_at,
                    question_count: questionCounts[category.name] || 0
                }));

                setCategories(categoriesWithCounts);
            } catch (countError) {
                // If count query fails, still show categories with 0 counts
                console.warn("Error processing question counts:", countError);
                
                const categoriesWithZeroCounts = categoriesData.map(category => ({
                    name: category.name,
                    created_at: category.created_at,
                    question_count: 0
                }));
                
                setCategories(categoriesWithZeroCounts);
            }
        } catch (error) {
            setError("An unexpected error occurred. Please try again later.");
            console.error("Error in fetchCategories:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredCategories = categories.filter(category =>
        category.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <Card key={i} className="p-6">
                            <Skeleton className="h-6 w-32 mb-2" />
                            <Skeleton className="h-4 w-24" />
                        </Card>
                    ))}
                </div>
            );
        }

        if (error) {
            return (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            );
        }

        if (filteredCategories.length === 0) {
            return (
                <div className="text-center py-8">
                    <p className="text-gray-500">
                        {categories.length === 0 
                            ? "No categories available" 
                            : "No categories match your search"}
                    </p>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCategories.map((category) => (
                    <Card
                        key={category.name}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => router.push(`/categories/${encodeURIComponent(category.name)}`)}
                    >
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Tag className="h-4 w-4" />
                                    <h3 className="font-medium">{category.name}</h3>
                                </div>
                                <Badge variant="secondary">
                                    {category.question_count} questions
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    };

    return (
        <div className="container mx-auto py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Categories</h1>
                    <p className="text-gray-500 mt-1">Browse all available question categories</p>
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

            {renderContent()}
        </div>
    );
} 