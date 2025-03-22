import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

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

        // Create temporary directory
        const tempDir = await fs.mkdtemp(
            path.join(os.tmpdir(), "doc-convert-"),
        );
        const inputPath = path.join(tempDir, file.name);
        // The output PDF will have the same name as input but with .pdf extension
        const outputPath = path.join(
            tempDir,
            `${path.parse(file.name).name}.pdf`,
        );

        // Write uploaded file to temp directory
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(inputPath, buffer);

        try {
            // Convert using LibreOffice
            const { stdout, stderr } = await execAsync(
                `soffice --headless --convert-to pdf --outdir "${tempDir}" "${inputPath}"`,
            );
            console.log("Conversion output:", stdout);
            console.log("Conversion errors:", stderr);

            // Check if the output file exists
            await fs.access(outputPath);

            // Read the converted PDF
            const pdfBuffer = await fs.readFile(outputPath);

            // Clean up temp files
            await fs.rm(tempDir, { recursive: true, force: true });

            // Return the PDF
            return new NextResponse(pdfBuffer, {
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": `attachment; filename="${path.parse(file.name).name}.pdf"`,
                },
            });
        } catch (conversionError) {
            console.error("Conversion error:", conversionError);
            // Clean up temp files even if conversion fails
            await fs.rm(tempDir, { recursive: true, force: true });
            throw conversionError;
        }
    } catch (error) {
        console.error("Error:", error);
        return NextResponse.json(
            { error: "Error converting file" },
            { status: 500 },
        );
    }
}
