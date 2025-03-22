import FileUploadForm from "@/components/FileUploadForm";
import StudyMaterialsList from "@/components/StudyMaterialsList";
import { Toaster } from "@/components/ui/sonner";

export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <main className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold mb-8 text-center">Study Materials Manager</h1>
        
        <div className="grid gap-8 md:grid-cols-2 grid-cols-1">
          <div>
            <FileUploadForm />
          </div>
          <div>
            <StudyMaterialsList />
          </div>
        </div>
        
        <Toaster position="bottom-right" />
      </main>
    </div>
  );
}
