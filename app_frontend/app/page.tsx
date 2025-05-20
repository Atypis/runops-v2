'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TestComponent } from '@/components/test-component';

// Validation constants
const MAX_FILE_SIZE = 750 * 1024 * 1024; // 750MB in bytes
const MAX_DURATION = 20 * 60; // 20 minutes in seconds

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Format bytes to human-readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };
  
  // Handle file validation
  const validateFile = (file: File): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      // Check if it's a video file
      if (!file.type.startsWith('video/')) {
        setError('Please upload a video file.');
        resolve(false);
        return;
      }
      
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        setError(`File is too large. Maximum size is ${formatBytes(MAX_FILE_SIZE)}.`);
        resolve(false);
        return;
      }
      
      // Check video duration
      const video = videoRef.current;
      if (!video) {
        reject(new Error('Video element not found'));
        return;
      }
      
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl);
        
        if (video.duration > MAX_DURATION) {
          setError(`Video is too long. Maximum duration is 20 minutes.`);
          resolve(false);
        } else {
          setError(null);
          resolve(true);
        }
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setError('Failed to load video. The file might be corrupted.');
        resolve(false);
      };
    });
  };
  
  // Handle file selection
  const handleFileSelect = async (file: File) => {
    const isValid = await validateFile(file);
    
    if (isValid) {
      setFile(file);
      setFileInfo({
        name: file.name,
        size: formatBytes(file.size)
      });
    } else {
      setFile(null);
      setFileInfo(null);
    }
  };
  
  // Handle drag events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileSelect(e.dataTransfer.files[0]);
    }
  };
  
  // Handle file input change
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFileSelect(e.target.files[0]);
    }
  };
  
  // Trigger file input click
  const handleChooseFileClick = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-white">
      <TestComponent />
      <div className="w-full max-w-3xl space-y-6 mt-6">
        <h1 className="text-3xl font-bold text-center">
          Standard Operating Procedures
        </h1>
        
        <p className="text-center text-gray-500">
          Upload your video to create a new Standard Operating Procedure.
        </p>
        
        {/* Hidden video element for duration validation */}
        <video ref={videoRef} className="hidden" />
        
        {/* Upload zone */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
            isDragging 
              ? "border-blue-500 bg-blue-50" 
              : "border-gray-300 hover:border-blue-500/50 hover:bg-gray-50",
            fileInfo ? "bg-gray-50" : ""
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleChooseFileClick}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept="video/*"
            className="hidden"
          />
          
          {fileInfo ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h3 className="font-medium">{fileInfo.name}</h3>
              <p className="text-sm text-gray-500">{fileInfo.size}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <div>
                <p className="font-medium">
                  Drag and drop your video here
                </p>
                <p className="text-sm text-gray-500">
                  or click to browse your files
                </p>
              </div>
              <div className="pt-2">
                <button className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md text-sm">
                  Choose file
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Error message */}
        {error && (
          <div className="text-red-500 text-center p-2 rounded bg-red-50">
            {error}
          </div>
        )}
        
        {/* File requirements */}
        <div className="text-sm text-gray-500 text-center">
          <p>Accepted file types: MP4, MOV, AVI</p>
          <p>Maximum file size: 750 MB</p>
          <p>Maximum duration: 20 minutes</p>
        </div>
      </div>
    </main>
  );
} 