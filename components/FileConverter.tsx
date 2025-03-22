"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";

export default function FileConverter() {
    const [isConverting, setIsConverting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onDrop = async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        // Check if file is a PowerPoint file
        if (!file.name.match(/\.(ppt|pptx)$/i)) {
            setError("Please select a PowerPoint file (.ppt or .pptx)");
            return;
        }

        setIsConverting(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await axios.post("/api/convert", formData, {
                responseType: "blob",
            });

            // Create download link for the converted PDF
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.download = `${file.name.split(".")[0]}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError("Error converting file. Please try again.");
            console.error(err);
        } finally {
            setIsConverting(false);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "application/vnd.ms-powerpoint": [".ppt"],
            "application/vnd.openxmlformats-officedocument.presentationml.presentation":
                [".pptx"],
        },
        multiple: false,
    });

    return (
        <div className="flex flex-col items-center justify-center p-6 space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">
                PowerPoint to PDF Converter
            </h2>

            <div
                {...getRootProps()}
                className={`w-full max-w-md p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors
          ${
              isDragActive
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 bg-gray-50 hover:bg-gray-100"
          }`}>
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center space-y-2">
                    <svg
                        className="w-12 h-12 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                    </svg>
                    <p className="text-sm text-gray-600">
                        {isDragActive
                            ? "Drop the PowerPoint file here"
                            : "Drag & drop a PowerPoint file here, or click to select"}
                    </p>
                    <p className="text-xs text-gray-500">
                        Supports .ppt and .pptx files
                    </p>
                </div>
            </div>

            {isConverting && (
                <div className="flex items-center space-x-2 text-blue-600">
                    <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24">
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                    <span>Converting...</span>
                </div>
            )}

            {error && <div className="text-red-600">{error}</div>}
        </div>
    );
}
