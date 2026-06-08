'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, AlertCircle, FileImage } from 'lucide-react';
import { uploadTaskImagesApi, TaskImage } from '@/lib/tasks-api';
import Button from '@/components/ui/button';

interface ImageUploaderProps {
  taskId?: string;
  isPendingMode?: boolean;
  onFilesChange?: (files: File[]) => void;
  onUploaded?: (newImages: TaskImage[]) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export default function ImageUploader({
  taskId,
  isPendingMode = false,
  onFilesChange,
  onUploaded,
}: ImageUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; id: string; preview: string }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (filesList: FileList) => {
    const newFiles: { file: File; id: string; preview: string }[] = [];
    const newErrors: string[] = [];

    Array.from(filesList).forEach((file) => {
      // Validate type
      if (!ALLOWED_TYPES.includes(file.type)) {
        newErrors.push(`${file.name}: Only JPEG, PNG, WebP, and GIF images are allowed.`);
        return;
      }
      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        newErrors.push(`${file.name}: Size exceeds 5 MB limit.`);
        return;
      }

      const id = Math.random().toString(36).substring(2, 9);
      const preview = URL.createObjectURL(file);
      newFiles.push({ file, id, preview });
    });

    if (newErrors.length > 0) {
      setErrors((prev) => [...prev, ...newErrors]);
      setTimeout(() => {
        setErrors((prev) => prev.filter((err) => !newErrors.includes(err)));
      }, 5000);
    }

    if (newFiles.length > 0) {
      const updated = [...selectedFiles, ...newFiles];
      setSelectedFiles(updated);
      if (isPendingMode && onFilesChange) {
        onFilesChange(updated.map((f) => f.file));
      }
    }
  };

  const removeFile = (idToRemove: string) => {
    const fileToRemove = selectedFiles.find((f) => f.id === idToRemove);
    if (fileToRemove) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
    const updated = selectedFiles.filter((f) => f.id !== idToRemove);
    setSelectedFiles(updated);
    if (isPendingMode && onFilesChange) {
      onFilesChange(updated.map((f) => f.file));
    }
  };

  const clearSelection = () => {
    selectedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    setSelectedFiles([]);
    if (isPendingMode && onFilesChange) {
      onFilesChange([]);
    }
  };

  const handleUpload = async () => {
    if (!taskId || selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      selectedFiles.forEach((f) => {
        formData.append('images', f.file);
      });

      const result = await uploadTaskImagesApi(taskId, formData);
      setUploadSuccess(true);
      clearSelection();

      if (onUploaded) {
        onUploaded(result);
      }

      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err: any) {
      setErrors((prev) => [...prev, err.response?.data?.message || 'Failed to upload images.']);
    } finally {
      setIsUploading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-4">
      {/* Dashed dropzone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition select-none ${
          isDragging
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
            : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-slate-50/50 dark:bg-slate-900/20 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          multiple
          accept="image/*"
          className="hidden"
        />
        <Upload className={`w-8 h-8 mb-2 ${isDragging ? 'text-blue-500 animate-bounce' : 'text-slate-400 dark:text-slate-550'}`} />
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Drag & drop images here, or <span className="text-blue-600 dark:text-blue-400 font-bold hover:underline">browse</span>
        </p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">
          Supports JPEG, PNG, WebP, GIF (Max 5MB each)
        </p>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((err, idx) => (
            <div key={idx} className="flex items-center space-x-1.5 text-rose-600 text-[11px] font-semibold">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* Success banner */}
      {uploadSuccess && (
        <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-xs font-bold border border-green-100 dark:border-green-900/40 flex items-center">
          Images uploaded successfully!
        </div>
      )}

      {/* Local Previews */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Selected ({selectedFiles.length})
            </span>
            {!isPendingMode && (
              <button
                onClick={clearSelection}
                className="text-[10px] font-bold text-slate-505 hover:text-slate-700 dark:text-slate-405 dark:hover:text-slate-300"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {selectedFiles.map((f) => (
              <div key={f.id} className="relative w-16 h-16 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs group bg-slate-50 dark:bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.preview} alt="preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(f.id);
                  }}
                  className="absolute -top-1 -right-1 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full p-0.5 opacity-90 hover:scale-105 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Upload Button for immediate mode */}
          {!isPendingMode && taskId && (
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full text-xs"
            >
              {isUploading ? 'Uploading...' : 'Upload Images'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
