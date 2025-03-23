"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    CircleCheck,
    CircleX,
    ChevronLeft,
    ChevronRight,
    Shuffle,
    X,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import FlashCard from "./FlashCard";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export interface FlashCardQuestion {
    id: string | number;
    question: string;
    answer: string;
    explanation?: string;
    category?: string | { name: string } | null;
    related_material?: string | null;
    options?: string[];
}

interface FlashCardViewerProps {
    questions: FlashCardQuestion[];
    isOpen: boolean;
    onClose: () => void;
    title?: string;
}

export default function FlashCardViewer({
    questions,
    isOpen,
    onClose,
    title = "Flash Cards",
}: FlashCardViewerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [cardsKnown, setCardsKnown] = useState<Set<string | number>>(
        new Set(),
    );
    const [cardsUnknown, setCardsUnknown] = useState<Set<string | number>>(
        new Set(),
    );
    const [shuffledQuestions, setShuffledQuestions] = useState<
        FlashCardQuestion[]
    >([]);
    const [completedSession, setCompletedSession] = useState(false);

    // Initialize with shuffled questions
    useEffect(() => {
        if (questions.length > 0) {
            shuffleQuestions();
        }
    }, [questions]);

    const shuffleQuestions = () => {
        const shuffled = [...questions].sort(() => Math.random() - 0.5);
        setShuffledQuestions(shuffled);
        setCurrentIndex(0);
        setCardsKnown(new Set());
        setCardsUnknown(new Set());
        setCompletedSession(false);
    };

    const handleNext = () => {
        if (currentIndex < shuffledQuestions.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            setCompletedSession(true);
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const handleKnown = () => {
        const currentCardId = shuffledQuestions[currentIndex].id;
        const newKnown = new Set(cardsKnown);
        newKnown.add(currentCardId);
        setCardsKnown(newKnown);

        // Remove from unknown if it was there
        if (cardsUnknown.has(currentCardId)) {
            const newUnknown = new Set(cardsUnknown);
            newUnknown.delete(currentCardId);
            setCardsUnknown(newUnknown);
        }

        handleNext();
    };

    const handleUnknown = () => {
        const currentCardId = shuffledQuestions[currentIndex].id;
        const newUnknown = new Set(cardsUnknown);
        newUnknown.add(currentCardId);
        setCardsUnknown(newUnknown);

        // Remove from known if it was there
        if (cardsKnown.has(currentCardId)) {
            const newKnown = new Set(cardsKnown);
            newKnown.delete(currentCardId);
            setCardsKnown(newKnown);
        }

        handleNext();
    };

    const reviewUnknownCards = () => {
        // Filter to only unknown cards and start over
        const unknownCards = shuffledQuestions.filter((q) =>
            cardsUnknown.has(q.id),
        );
        if (unknownCards.length === 0) {
            toast.info("No cards to review! You've marked all as known.");
            return;
        }

        setShuffledQuestions(unknownCards);
        setCurrentIndex(0);
        setCompletedSession(false);
        toast.success(
            `Reviewing ${unknownCards.length} cards you're still learning`,
        );
    };

    const startNewSession = () => {
        shuffleQuestions();
        toast.success("Starting a new flash card session");
    };

    const calculateProgress = () => {
        return (currentIndex / shuffledQuestions.length) * 100;
    };

    const currentQuestion = shuffledQuestions[currentIndex];

    // Render the summary when all cards have been reviewed
    const renderSummary = () => (
        <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <h2 className="text-2xl font-bold">Session Complete!</h2>

            <div className="grid grid-cols-2 gap-8 w-full max-w-md">
                <div className="flex flex-col items-center">
                    <CircleCheck className="h-12 w-12 text-green-500 mb-2" />
                    <div className="text-2xl font-bold">{cardsKnown.size}</div>
                    <div className="text-gray-500">Cards Known</div>
                </div>

                <div className="flex flex-col items-center">
                    <CircleX className="h-12 w-12 text-red-500 mb-2" />
                    <div className="text-2xl font-bold">
                        {cardsUnknown.size}
                    </div>
                    <div className="text-gray-500">Still Learning</div>
                </div>
            </div>

            <div className="flex gap-4 mt-6">
                <Button
                    onClick={reviewUnknownCards}
                    disabled={cardsUnknown.size === 0}
                    variant="secondary">
                    Review Unknown Cards
                </Button>
                <Button onClick={startNewSession}>New Session</Button>
            </div>
        </div>
    );

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col [&>button]:hidden">
                <DialogHeader>
                    <div className="flex justify-between items-center">
                        <DialogTitle>{title}</DialogTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <DialogDescription>
                        {!completedSession
                            ? `Card ${currentIndex + 1} of ${shuffledQuestions.length}`
                            : `Reviewed ${shuffledQuestions.length} cards`}
                    </DialogDescription>
                    {!completedSession && shuffledQuestions.length > 0 && (
                        <Progress
                            value={calculateProgress()}
                            className="h-1 mt-2"
                        />
                    )}
                </DialogHeader>

                <div className="flex-grow overflow-auto py-6">
                    {!completedSession && shuffledQuestions.length > 0 ? (
                        <div className="h-full flex items-center justify-center">
                            {currentQuestion && (
                                <FlashCard
                                    question={currentQuestion.question}
                                    answer={currentQuestion.answer}
                                    explanation={currentQuestion.explanation}
                                    category={currentQuestion.category}
                                    related_material={
                                        currentQuestion.related_material
                                    }
                                />
                            )}
                        </div>
                    ) : (
                        <div className="h-full">{renderSummary()}</div>
                    )}
                </div>

                {!completedSession && shuffledQuestions.length > 0 && (
                    <DialogFooter className="flex justify-between">
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={handlePrevious}
                                disabled={currentIndex === 0}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={shuffleQuestions}>
                                <Shuffle className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={handleUnknown}>
                                <CircleX className="h-4 w-4 text-red-500" />
                                Still Learning
                            </Button>
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={handleKnown}>
                                <CircleCheck className="h-4 w-4 text-green-500" />
                                I Know This
                            </Button>
                            <Button
                                variant="default"
                                size="icon"
                                onClick={handleNext}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
