"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

export default function FileUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (!selectedFile) return;
    
    if (!ACCEPTED_FILE_TYPES.includes(selectedFile.type)) {
      toast.error("Invalid file type. Please upload PDF, PPTX, PNG, or DOCX files only.");
      return;
    }
    
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }

    try {
      setIsUploading(true);
      
      const folderId = uuidv4();
      const filePath = `${folderId}/${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("study-materials")
        .upload(filePath, file);
      
      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
      
      const { data: studySet, error: studySetError } = await supabase
        .from("study_sets")
        .insert({})
        .select();
      
      if (studySetError || !studySet || studySet.length === 0) {
        throw new Error(`Failed to create study set: ${studySetError?.message || "Unknown error"}`);
      }
      
      const { error: studyMaterialError } = await supabase
        .from("study_materials")
        .insert({
          id: folderId,
          study_set: studySet[0].id
        });
      
      if (studyMaterialError) {
        throw new Error(`Failed to create study material: ${studyMaterialError.message}`);
      }
      
      toast.success("File uploaded successfully!");
      router.refresh();
      setFile(null);
      
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "An unknown error occurred");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Upload Study Material</CardTitle>
        <CardDescription>
          Upload your study materials. Accepted file types: PDF, PPTX, PNG, DOCX.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input
              id="file"
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.pptx,.png,.docx"
              disabled={isUploading}
            />
          </div>
          {file && (
            <div className="text-sm">
              Selected file: <span className="font-medium">{file.name}</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleUpload} 
          disabled={!file || isUploading} 
          className="w-full"
        >
          {isUploading ? "Uploading..." : "Upload File"}
        </Button>
      </CardFooter>
    </Card>
  );
} 