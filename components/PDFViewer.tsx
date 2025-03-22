"use client";

import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PDFViewerProps {
    file: string;
    onError?: () => void;
}

export default function PDFViewer({ file, onError }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<boolean>(false);

    // Initialize PDF.js with worker
    useEffect(() => {
        // Hard-code the version to ensure it matches the installed worker
        pdfjs.GlobalWorkerOptions.workerSrc =
            "https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js";
    }, []);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setIsLoading(false);
        setError(false);
    }

    function onDocumentLoadError(err: Error) {
        console.error("Error loading PDF", err);
        setError(true);
        setIsLoading(false);
        if (onError) onError();
    }

    const goToPrevPage = () => {
        setPageNumber((prev) => Math.max(prev - 1, 1));
    };

    const goToNextPage = () => {
        setPageNumber((prev) => Math.min(prev + 1, numPages || 1));
    };

    if (error) {
        return (
            <div className="flex justify-center items-center h-[300px] w-[450px] bg-gray-50 rounded-md border">
                <p className="text-red-500">Failed to load PDF preview</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center">
            <div className="relative border rounded-md overflow-hidden bg-white">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-70">
                        <p>Loading PDF...</p>
                    </div>
                )}
                <Document
                    file={file}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    className="max-w-full"
                    loading={
                        <div className="h-[400px] w-[450px] flex items-center justify-center">
                            <p>Loading PDF document...</p>
                        </div>
                    }
                    error={
                        <div className="h-[400px] w-[450px] flex items-center justify-center">
                            <p className="text-red-500">Failed to load PDF</p>
                        </div>
                    }>
                    <Page
                        pageNumber={pageNumber}
                        width={450}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        loading={
                            <div className="h-[400px] w-[450px] flex items-center justify-center">
                                <p>Loading page...</p>
                            </div>
                        }
                        error={
                            <div className="h-[400px] w-[450px] flex items-center justify-center">
                                <p className="text-red-500">
                                    Error loading page
                                </p>
                            </div>
                        }
                    />
                </Document>
            </div>
            {numPages && numPages > 1 && (
                <div className="flex items-center gap-4 mt-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={goToPrevPage}
                        disabled={pageNumber <= 1}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <p className="text-sm">
                        Page {pageNumber} of {numPages}
                    </p>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={goToNextPage}
                        disabled={pageNumber >= (numPages || 1)}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
