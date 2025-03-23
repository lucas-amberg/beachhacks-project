"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag, RefreshCw } from "lucide-react";

export interface FlashCardProps {
    question: string;
    answer: string;
    explanation?: string;
    category?: string | { name: string } | null;
    onNext?: () => void;
    onPrevious?: () => void;
}

export default function FlashCard({
    question,
    answer,
    explanation,
    category,
    onNext,
    onPrevious,
}: FlashCardProps) {
    const [isFlipped, setIsFlipped] = useState(false);

    const handleFlip = () => {
        setIsFlipped(!isFlipped);
    };

    const categoryName =
        typeof category === "object" && category !== null
            ? category.name
            : typeof category === "string"
              ? category
              : null;

    return (
        <div className="w-full max-w-3xl mx-auto h-[400px]">
            <div
                className="relative w-full h-full"
                style={{ perspective: "1500px" }}>
                {/* Card container */}
                <div
                    className="w-full h-full transition-all duration-500"
                    style={{
                        transformStyle: "preserve-3d",
                        transform: isFlipped
                            ? "rotateY(180deg)"
                            : "rotateY(0deg)",
                    }}>
                    {/* Front of card (Question) */}
                    <div
                        className="absolute inset-0 w-full h-full backface-hidden"
                        style={{ zIndex: isFlipped ? "0" : "1" }}>
                        <Card className="w-full h-full flex flex-col p-6 shadow-md">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-sm font-medium text-gray-500">
                                    Question
                                </h3>
                                {categoryName && (
                                    <Badge
                                        variant="outline"
                                        className="flex items-center gap-1">
                                        <Tag className="h-3 w-3" />
                                        {categoryName}
                                    </Badge>
                                )}
                            </div>

                            <div className="flex-grow flex items-center justify-center p-4">
                                <p className="text-xl font-medium text-center">
                                    {question}
                                </p>
                            </div>

                            <div className="flex justify-center mt-4">
                                <Button
                                    onClick={handleFlip}
                                    className="gap-2"
                                    variant="outline">
                                    <RefreshCw className="h-4 w-4" />
                                    Flip to see answer
                                </Button>
                            </div>
                        </Card>
                    </div>

                    {/* Back of card (Answer) */}
                    <div
                        className="absolute inset-0 w-full h-full backface-hidden rotate-y-180"
                        style={{ zIndex: isFlipped ? "1" : "0" }}>
                        <Card className="w-full h-full flex flex-col p-6 shadow-md border-green-100">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-sm font-medium text-green-600">
                                    Answer
                                </h3>
                                {categoryName && (
                                    <Badge
                                        variant="outline"
                                        className="flex items-center gap-1">
                                        <Tag className="h-3 w-3" />
                                        {categoryName}
                                    </Badge>
                                )}
                            </div>

                            <div className="flex-grow flex flex-col items-center justify-center p-4 overflow-auto">
                                <p className="text-xl font-medium text-center text-green-700 mb-4">
                                    {answer}
                                </p>
                                {explanation && (
                                    <div className="mt-4 border-t pt-4 w-full">
                                        <h4 className="text-sm font-medium text-gray-500 mb-2">
                                            Explanation:
                                        </h4>
                                        <p className="text-gray-700">
                                            {explanation}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-center mt-4">
                                <Button
                                    onClick={handleFlip}
                                    className="gap-2"
                                    variant="outline">
                                    <RefreshCw className="h-4 w-4" />
                                    Flip to question
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
