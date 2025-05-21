'use client';

import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { AuthModal } from '@/components/ui/auth-modal';

// Validation constants
const MAX_FILE_SIZE = 750 * 1024 * 1024; // 750MB in bytes
const MAX_DURATION = 20 * 60; // 20 minutes in seconds

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();
  
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
  
  // Process video 
  const handleProcessVideo = async () => {
    if (!file) return;
    
    // Check if user is authenticated
    if (!user) {
      setShowAuthModal(true)
      return
    }
    
    try {
      setIsUploading(true)
      setError(null)
      
      // Step 1: Get a signed upload URL from our API
      const response = await fetch('/api/get-upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get upload URL');
      }
      
      const { jobId, url } = await response.json();
      setJobId(jobId); // Save jobId for status polling
      
      // Step 2: Upload the file to the signed URL using PUT with XMLHttpRequest to track progress
      const xhr = new XMLHttpRequest();
      
      // Set up progress tracking
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded * 100) / event.total);
          setUploadProgress(progress);
        }
      };
      
      // Set up completion and error handlers
      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Upload completed successfully
          setUploadProgress(100);
          setIsUploading(false);
          setIsProcessing(true);
          
          try {
            // Queue the job for processing
            const queueResponse = await fetch('/api/queue-job', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ jobId }),
            });
            
            if (!queueResponse.ok) {
              const errorData = await queueResponse.json();
              throw new Error(errorData.error || 'Failed to queue job for processing');
            }
            
            // Job queued successfully - redirect to SOP view
            window.location.href = `/sop/${jobId}`;
          } catch (queueError: any) {
            setIsProcessing(false);
            setError(queueError.message || 'Error starting video processing. Please try again.');
            console.error('Queue error:', queueError);
          }
        } else {
          throw new Error('Failed to upload file');
        }
      };
      
      xhr.onerror = () => {
        throw new Error('Network error occurred during upload');
      };
      
      // Initialize request and send file
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
      
    } catch (error: any) {
      setIsUploading(false);
      setError(error.message || 'Something went wrong. Please try again.');
      console.error('Upload error:', error);
    }
  };
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-white">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-light tracking-tight">
            Standard Operating Procedures
          </h1>
          
          <p className="text-gray-500">
            Transform your workflow video into a clear, structured SOP
          </p>
        </div>
        
        {/* Hidden video element for duration validation */}
        <video ref={videoRef} className="hidden" />
        
        {/* Authentication Modal */}
        <AuthModal 
          open={showAuthModal} 
          onOpenChange={setShowAuthModal} 
        />
        
        {/* Status indicator */}
        {isUploading && (
          <div className="w-full mt-4 space-y-2">
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300 ease-in-out" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500 text-center">
              {uploadProgress < 100 ? `Uploading: ${uploadProgress}%` : 'Upload complete'}
            </p>
          </div>
        )}
        
        {isProcessing && (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-t-2 border-r-2 border-blue-500 animate-spin"></div>
            </div>
            <p className="text-gray-500 mt-4">AI magic in progress...</p>
          </div>
        )}
        
        {/* Main content - controls visibility based on state */}
        {!isUploading && !isProcessing && (
          <>
            {/* Upload zone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300",
                "shadow-sm hover:shadow-md",
                isDragging 
                  ? "border-blue-500 bg-blue-50" 
                  : "border-gray-200 hover:border-blue-400 hover:bg-gray-50",
                fileInfo ? "bg-gray-50" : ""
              )}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={fileInfo ? undefined : handleChooseFileClick}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept="video/*"
                className="hidden"
              />
              
              {fileInfo ? (
                <div className="space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-800">{fileInfo.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{fileInfo.size}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="w-20 h-20 mx-auto rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">
                      Drag and drop your video
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      or click to browse your files
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Error message */}
            {error && (
              <div className="text-red-500 text-center p-3 rounded-lg bg-red-50 border border-red-100">
                {error}
              </div>
            )}
            
            {/* File requirements */}
            <div className="text-sm text-gray-400 text-center flex flex-col gap-1">
              <p>Accepted file types: MP4, MOV, AVI</p>
              <p>Maximum file size: 750 MB • Maximum duration: 20 minutes</p>
            </div>
            
            {/* Process button - only shown when file is selected */}
            {fileInfo && (
              <div className="flex justify-center mt-6">
                <button 
                  onClick={handleProcessVideo} 
                  className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white py-3 px-8 rounded-lg transition-colors duration-200 font-medium shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
                >
                  Create SOP
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
} 