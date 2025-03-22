"use client";

import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PDFViewerProps {
    file: string;
}

export default function PDFViewer({ file }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Initialize PDF.js with CDN worker
    useEffect(() => {
        pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
    }, []);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setIsLoading(false);
    }

    const goToPrevPage = () => {
        setPageNumber((prev) => Math.max(prev - 1, 1));
    };

    const goToNextPage = () => {
        setPageNumber((prev) => Math.min(prev + 1, numPages || 1));
    };

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
                    onLoadError={() => console.error("Error loading PDF")}
                    className="max-w-full">
                    <Page
                        pageNumber={pageNumber}
                        width={450}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
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
