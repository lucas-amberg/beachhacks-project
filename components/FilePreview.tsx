"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
    FileIcon,
    FileImage,
    FileText,
    ChevronLeft,
    ChevronRight,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

// Dynamically import react-pdf to avoid SSR issues
const PDFViewer = dynamic(() => import("./PDFViewer"), {
    ssr: false,
    loading: () => (
        <div className="flex justify-center items-center h-[450px] w-[450px] bg-gray-100 rounded-md">
            <p>Loading PDF viewer...</p>
        </div>
    ),
});

type FilePreviewProps = {
    url: string;
    fileType: string;
    fileName: string;
    onClose: () => void;
};

export default function FilePreview({
    url,
    fileType,
    fileName,
    onClose,
}: FilePreviewProps) {
    const renderPreview = () => {
        const lowerFileType = fileType.toLowerCase();

        if (lowerFileType === "pdf") {
            return <PDFViewer file={url} />;
        } else if (lowerFileType === "png") {
            return (
                <div className="border rounded-md overflow-hidden bg-white p-2">
                    <Image
                        src={url}
                        alt={fileName}
                        width={450}
                        height={450}
                        className="object-contain max-h-[450px]"
                        unoptimized
                    />
                </div>
            );
        } else {
            // For other file types like PPTX, DOCX, etc.
            const getFileTypeIcon = () => {
                switch (lowerFileType) {
                    case "pptx":
                        return (
                            <FileIcon className="h-24 w-24 text-orange-500" />
                        );
                    case "docx":
                        return <FileText className="h-24 w-24 text-blue-700" />;
                    default:
                        return <FileIcon className="h-24 w-24 text-gray-500" />;
                }
            };

            return (
                <div className="flex flex-col items-center justify-center gap-4 p-8 border rounded-md bg-gray-50">
                    {getFileTypeIcon()}
                    <p className="text-center font-medium">{fileName}</p>
                    <p className="text-sm text-gray-500">
                        Preview not available
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(url, "_blank")}>
                        Download to View
                    </Button>
                </div>
            );
        }
    };

    return (
        <div className="relative p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">{fileName}</h3>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700">
                    <X className="h-4 w-4" />
                </Button>
            </div>
            <div className="flex justify-center">{renderPreview()}</div>
        </div>
    );
}
