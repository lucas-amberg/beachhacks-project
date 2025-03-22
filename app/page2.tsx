'use client';

import { useState } from 'react';
import { FileUpload } from 'primereact/fileupload';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { Button } from 'primereact/button';
import axios from 'axios';

// Import PrimeReact styles
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

export default function Home() {
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convertedFile, setConvertedFile] = useState<{
    originalName: string;
    originalType: string;
    convertedType: string;
    size: string;
  } | null>(null);

  const handleFileUpload = async (event: any) => {
    const file = event.files[0];
    
    if (!file.name.match(/\.(ppt|pptx)$/i)) {
      setError('Please select a PowerPoint file (.ppt or .pptx)');
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

      // Create download link for the converted PDF
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.name.split('.')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Update converted file info
      setConvertedFile({
        originalName: file.name,
        originalType: file.type || 'application/vnd.ms-powerpoint',
        convertedType: 'application/pdf',
        size: formatBytes(response.data.size)
      });
    } catch (err) {
      setError('Error converting file. Please try again.');
      console.error(err);
    } finally {
      setConverting(false);
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
        <Card title="PowerPoint to PDF Converter" className="shadow-lg">
          <div className="space-y-6">
            <FileUpload
              mode="basic"
              name="file"
              accept=".ppt,.pptx"
              maxFileSize={50000000}
              customUpload
              uploadHandler={handleFileUpload}
              auto
              chooseLabel="Select PowerPoint File"
              className="w-full"
            />

            {converting && (
              <div className="flex items-center justify-center p-4">
                <ProgressSpinner 
                  style={{width: '50px', height: '50px'}}
                  strokeWidth="4"
                  animationDuration=".5s"
                />
                <span className="ml-3 text-gray-600">Converting...</span>
              </div>
            )}

            {error && (
              <Message severity="error" text={error} className="w-full" />
            )}

            {convertedFile && !converting && !error && (
              <Card title="Conversion Details" className="mt-6">
                <div className="space-y-2">
                  <p><strong>Original File:</strong> {convertedFile.originalName}</p>
                  <p><strong>Original Type:</strong> {convertedFile.originalType}</p>
                  <p><strong>Converted Type:</strong> {convertedFile.convertedType}</p>
                  <p><strong>File Size:</strong> {convertedFile.size}</p>
                  <div className="pt-4">
                    <Message 
                      severity="success" 
                      text="File converted successfully! The download should start automatically." 
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
