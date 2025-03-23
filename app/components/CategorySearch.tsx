"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = {
    id: number;
    name: string;
    question_count: number;
};

export default function CategorySearch() {
    const [open, setOpen] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [selectedValue, setSelectedValue] = useState("");
    const router = useRouter();

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            // Get all categories
            const { data: categoriesData, error: categoriesError } = await supabase
                .from("categories")
                .select("id, name")
                .order("name");

            if (categoriesError) {
                console.error("Error fetching categories:", categoriesError);
                return;
            }

            if (!categoriesData || categoriesData.length === 0) {
                setCategories([]);
                return;
            }

            // Get all question counts in a single query
            const { data: counts, error: countsError } = await supabase
                .from("quiz_questions")
                .select("category")
                .in("category", categoriesData.map(c => c.name));

            if (countsError) {
                console.error("Error fetching question counts:", countsError);
                return;
            }

            // Count questions per category
            const questionCounts = counts?.reduce<Record<string, number>>((acc, curr) => {
                acc[curr.category] = (acc[curr.category] || 0) + 1;
                return acc;
            }, {}) || {};

            // Combine categories with their counts
            const categoriesWithCounts = categoriesData.map(category => ({
                id: category.id,
                name: category.name,
                question_count: questionCounts[category.name] || 0
            }));

            setCategories(categoriesWithCounts);
        } catch (error) {
            console.error("Error in fetchCategories:", error);
        }
    };

    // Filter categories based on input
    const filteredCategories = inputValue === "" 
        ? categories 
        : categories.filter((category) =>
            category.name.toLowerCase().includes(inputValue.toLowerCase())
        );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between md:w-[300px] lg:w-[400px]"
                >
                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        {selectedValue
                            ? categories.find((category) => category.name === selectedValue)?.name
                            : "Search categories..."}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full md:w-[300px] lg:w-[400px] p-0">
                <Command>
                    <CommandInput 
                        placeholder="Search categories..." 
                        value={inputValue}
                        onValueChange={setInputValue}
                    />
                    <CommandList>
                        <CommandEmpty>No category found.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-auto">
                            {filteredCategories.map((category) => (
                                <CommandItem
                                    key={category.id}
                                    value={category.name}
                                    onSelect={(currentValue) => {
                                        setSelectedValue(currentValue === selectedValue ? "" : currentValue);
                                        setInputValue("");
                                        setOpen(false);
                                        router.push(`/categories/${category.id}`);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedValue === category.name ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex items-center justify-between w-full">
                                        <span>{category.name}</span>
                                        <span className="text-sm text-gray-500">
                                            {category.question_count} questions
                                        </span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
} 