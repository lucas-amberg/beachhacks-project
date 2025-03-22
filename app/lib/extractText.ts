import * as pdfjs from "pdfjs-dist";

// Initialize PDF.js worker
if (typeof window === "undefined") {
    // Server-side
    const pdfjsWorker = require("pdfjs-dist/build/pdf.worker.js");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
} else {
    // Client-side
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

/**
 * Extract text content from a PDF buffer
 * @param buffer ArrayBuffer containing the PDF data
 * @returns Promise that resolves to the extracted text
 */
export async function getTextFromPDF(buffer: ArrayBuffer): Promise<string> {
    try {
        // Load the PDF document
        const loadingTask = pdfjs.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;

        let fullText = "";

        // Loop through each page
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Extract text items and join them with spaces
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(" ");

            fullText += pageText + "\n\n";
        }

        return fullText;
    } catch (error) {
        console.error("Error extracting text from PDF:", error);
        throw new Error("Failed to extract text from PDF");
    }
}
