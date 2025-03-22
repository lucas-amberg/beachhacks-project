'use client';

import { useState, useRef } from 'react';
import { FileUpload } from 'primereact/fileupload';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import axios from 'axios';

// Import PrimeReact styles
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

export default function Home() {
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileUploadRef = useRef<FileUpload>(null);
  const [convertedFile, setConvertedFile] = useState<{
    originalName: string;
    originalType: string;
    convertedType: string;
    size: string;
    wasConverted: boolean;
  } | null>(null);

  const handleFileUpload = async (event: any) => {
    const file = event.files[0];
    
    // Check if file is a supported type
    if (!file.name.match(/\.(pdf|doc|docx|ppt|pptx)$/i)) {
      setError('Please select a PDF, Word document (.doc, .docx), or PowerPoint file (.ppt, .pptx)');
      return;
    }

    setConverting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('/api/convert', formData, {
        responseType: 'blob',
      });

      // Create download link for the file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name.endsWith('.pdf') 
        ? file.name 
        : `${file.name.split('.')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Determine if conversion was needed
      const wasPDF = file.name.toLowerCase().endsWith('.pdf');

      // Update converted file info
      setConvertedFile({
        originalName: file.name,
        originalType: file.type || getFileType(file.name),
        convertedType: 'application/pdf',
        size: formatBytes(response.data.size),
        wasConverted: !wasPDF
      });
    } catch (err) {
      setError('Error processing file. Please try again.');
      console.error(err);
    } finally {
      setConverting(false);
      // Clear the FileUpload component
      if (fileUploadRef.current) {
        fileUploadRef.current.clear();
      }
    }
  };

  const getFileType = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf':
        return 'application/pdf';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'ppt':
        return 'application/vnd.ms-powerpoint';
      case 'pptx':
        return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      default:
        return 'application/octet-stream';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Card title="Document to PDF Converter" className="shadow-lg">
          <div className="space-y-6">
            <FileUpload
              ref={fileUploadRef}
              mode="basic"
              name="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx"
              maxFileSize={50000000}
              customUpload
              uploadHandler={handleFileUpload}
              auto
              chooseLabel="Select Document"
              className="w-full"
            />

            {converting && (
              <div className="flex items-center justify-center p-4">
                <ProgressSpinner 
                  style={{width: '50px', height: '50px'}}
                  strokeWidth="4"
                  animationDuration=".5s"
                />
                <span className="ml-3 text-gray-600">
                  {convertedFile?.wasConverted ? 'Converting...' : 'Processing...'}
                </span>
              </div>
            )}

            {error && (
              <Message severity="error" text={error} className="w-full" />
            )}

            {convertedFile && !converting && !error && (
              <Card title="File Details" className="mt-6">
                <div className="space-y-2">
                  <p><strong>Original File:</strong> {convertedFile.originalName}</p>
                  <p><strong>Original Type:</strong> {convertedFile.originalType}</p>
                  <p><strong>Output Type:</strong> {convertedFile.convertedType}</p>
                  <p><strong>File Size:</strong> {convertedFile.size}</p>
                  <div className="pt-4">
                    <Message 
                      severity="success" 
                      text={convertedFile.wasConverted 
                        ? "File converted successfully! The download should start automatically."
                        : "PDF file processed successfully! The download should start automatically."
                      } 
                      className="w-full"
                    />
                  </div>
                </div>
              </Card>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
