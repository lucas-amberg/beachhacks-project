import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";
import libre from "libreoffice-convert";
import { promisify } from "util";

// Promisify the convert function
const convertAsync = promisify(libre.convert);

// Check if LibreOffice is available
async function isLibreOfficeAvailable() {
    try {
        // Try a small test conversion
        const testBuffer = Buffer.from("test");
        await convertAsync(testBuffer, ".pdf", undefined);
        return true;
    } catch (error: any) {
        if (error.message && error.message.includes("Command failed")) {
            // LibreOffice command exists but failed for some other reason
            return true;
        }
        // If it's a "command not found" type error, LibreOffice is not installed
        return false;
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 },
            );
        }

        // If it's already a PDF, just return it
        if (file.name.toLowerCase().endsWith(".pdf")) {
            const buffer = Buffer.from(await file.arrayBuffer());
            return new NextResponse(buffer, {
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": `attachment; filename="${file.name}"`,
                },
            });
        }

        // Check if file is a supported type
        if (!file.name.match(/\.(doc|docx|ppt|pptx)$/i)) {
            return NextResponse.json(
                {
                    error: "Unsupported file type. Please provide a Word document (.doc, .docx) or PowerPoint file (.ppt, .pptx)",
                },
                { status: 400 },
            );
        }

        // Check if LibreOffice is available
        const libreAvailable = await isLibreOfficeAvailable();

        if (!libreAvailable) {
            return NextResponse.json(
                {
                    error: "LibreOffice is not installed on the server.",
                    notInstalled: true,
                    installInstructions: {
                        ubuntu: "sudo apt-get install libreoffice",
                        mac: "brew install --cask libreoffice",
                        windows:
                            "Install LibreOffice from https://www.libreoffice.org/download/download/",
                    },
                },
                { status: 500 },
            );
        }

        // Convert the file to PDF using libreoffice-convert
        try {
            // Get file buffer
            const inputBuffer = Buffer.from(await file.arrayBuffer());

            // Convert to PDF
            const pdfBuffer = await convertAsync(
                inputBuffer,
                ".pdf",
                undefined,
            );

            // Return the PDF
            return new NextResponse(pdfBuffer, {
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": `attachment; filename="${path.parse(file.name).name}.pdf"`,
                },
            });
        } catch (conversionError) {
            console.error("Conversion error:", conversionError);
            return NextResponse.json(
                { error: "Error converting file to PDF" },
                { status: 500 },
            );
        }
    } catch (error) {
        console.error("Error:", error);
        return NextResponse.json(
            { error: "Error processing file" },
            { status: 500 },
        );
    }
}
