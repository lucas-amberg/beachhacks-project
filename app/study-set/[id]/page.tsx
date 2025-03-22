"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import supabase from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import { UploadCloud, FileIcon, FileImage, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type StorageFile = {
  name: string;
  id: string;
  created_at: string;
  type: string;
}

const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

export default function StudySetPage() {
  const { id } = useParams();
  const [studySet, setStudySet] = useState<any>(null);
  const [materials, setMaterials] = useState<StorageFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchStudySet();
    fetchStudyMaterials();
  }, [id]);

  const fetchStudySet = async () => {
    try {
      const { data, error } = await supabase
        .from("study_sets")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setStudySet(data);
    } catch (error) {
      console.error("Error fetching study set:", error);
      toast.error("Failed to load study set");
    }
  };

  const fetchStudyMaterials = async () => {
    try {
      setIsLoading(true);
      const { data: dbMaterials, error: dbError } = await supabase
        .from("study_materials")
        .select(`id, created_at, study_set`)
        .eq("study_set", id)
        .order("created_at", { ascending: false });

      if (dbError) throw dbError;

      const materials: StorageFile[] = [];

      for (const material of dbMaterials) {
        const { data: storageData, error: storageError } = await supabase.storage
          .from("study-materials")
          .list(material.id, {
            limit: 1,
            sortBy: { column: 'name', order: 'asc' }
          });

        if (storageError) {
          console.error("Error getting files for material", material.id, storageError);
          continue;
        }

        if (storageData && storageData.length > 0) {
          const file = storageData[0];
          materials.push({
            name: file.name,
            id: material.id,
            created_at: material.created_at,
            type: file.name.split('.').pop() || ''
          });
        }
      }

      setMaterials(materials);
    } catch (error) {
      console.error("Error fetching study materials:", error);
      toast.error("Failed to load study materials");
    } finally {
      setIsLoading(false);
    }
  };

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
            
      const { error: studyMaterialError } = await supabase
        .from("study_materials")
        .insert({
          id: folderId,
          study_set: id
        });
      
      if (studyMaterialError) {
        throw new Error(`Failed to create study material: ${studyMaterialError.message}`);
      }
      
      toast.success("File uploaded successfully!");
      setFile(null);
      fetchStudyMaterials();
      
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "An unknown error occurred");
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (fileType: string) => {
    switch(fileType.toLowerCase()) {
      case 'pdf':
        return <FileIcon className="h-5 w-5 text-red-500" />;
      case 'pptx':
        return <FileIcon className="h-5 w-5 text-orange-500" />;
      case 'png':
        return <FileImage className="h-5 w-5 text-blue-500" />;
      case 'docx':
        return <FileText className="h-5 w-5 text-blue-700" />;
      default:
        return <FileIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getDownloadUrl = async (id: string, filename: string) => {
    const { data } = await supabase.storage
      .from("study-materials")
      .getPublicUrl(`${id}/${filename}`);
    
    return data.publicUrl;
  };

  const handleDownload = async (material: StorageFile) => {
    const url = await getDownloadUrl(material.id, material.name);
    window.open(url, '_blank');
  };

  if (!studySet) {
    return (
      <div className="flex justify-center items-center h-full">
        <p>Loading study set...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Study Set #{id}</h1>
        <p className="text-sm text-gray-500">
          Created: {new Date(studySet.created_at).toLocaleString()}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Upload Study Material</CardTitle>
            <CardDescription>
              Add new materials to this study set. Accepts PDF, PPTX, PNG, and DOCX files.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
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
              <Button 
                onClick={handleUpload} 
                disabled={!file || isUploading}
                className="w-full flex items-center gap-2"
              >
                <UploadCloud className="h-5 w-5" />
                {isUploading ? "Uploading..." : "Upload File"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Study Materials</CardTitle>
            <CardDescription>
              All materials in this study set
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <p>Loading study materials...</p>
              </div>
            ) : materials.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-40 text-center">
                <p className="text-gray-500">No materials in this study set yet</p>
                <p className="text-sm text-gray-400">Upload your first file using the form</p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.map((material) => (
                      <TableRow key={material.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getFileIcon(material.type)}
                            <span className="font-medium">{material.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(material.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(material)}
                          >
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 