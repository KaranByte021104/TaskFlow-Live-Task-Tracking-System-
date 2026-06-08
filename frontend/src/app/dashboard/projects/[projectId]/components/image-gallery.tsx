'use client';

import React, { useState, useEffect } from 'react';
import { Eye, Trash2, X, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { deleteTaskImageApi, TaskImage } from '@/lib/tasks-api';
import Avatar from '@/components/ui/avatar';

interface ImageGalleryProps {
  images: TaskImage[];
  isReadOnly?: boolean;
  isAdmin?: boolean;
  onDeleted?: (imageId: string) => void;
}

export default function ImageGallery({
  images = [],
  isReadOnly = false,
  isAdmin = false,
  onDeleted,
}: ImageGalleryProps) {
  const currentUser = useAuthStore((state) => state.user);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev !== null && prev < images.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, images.length]);

  const handleDelete = async (imageId: string) => {
    setDeletingId(imageId);
    try {
      await deleteTaskImageApi(imageId);
      if (onDeleted) {
        onDeleted(imageId);
      }
    } catch (err) {
      console.error('Failed to delete image:', err);
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Grid of images */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
        {images.map((img, idx) => {
          const isUploader = img.uploaderId === currentUser?.id;
          const canDelete = !isReadOnly && (isUploader || isAdmin);
          const showDeleteConfirm = deleteConfirmId === img.id;

          return (
            <div
              key={img.id}
              className="relative w-[110px] h-[110px] sm:w-[120px] sm:h-[120px] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs group bg-slate-50 dark:bg-slate-900 flex-shrink-0"
            >
              {/* Thumbnail Image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.originalName}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setLightboxIndex(idx)}
              />

              {/* Hover overlay controls */}
              {!showDeleteConfirm ? (
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center space-x-2.5">
                  <button
                    onClick={() => setLightboxIndex(idx)}
                    className="p-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-lg hover:scale-105 transition"
                    title="View Fullsize"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => setDeleteConfirmId(img.id)}
                      className="p-1.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-lg hover:scale-105 transition"
                      title="Delete attachment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                // Delete confirmation overlay
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-2 text-center select-none text-[10px]">
                  <p className="text-white font-bold leading-tight mb-2">Delete?</p>
                  <div className="flex gap-2">
                    <button
                      disabled={deletingId === img.id}
                      onClick={() => handleDelete(img.id)}
                      className="px-2 py-1 bg-rose-600 text-white rounded font-bold hover:bg-rose-700 disabled:opacity-50"
                    >
                      {deletingId === img.id ? '...' : 'Yes'}
                    </button>
                    <button
                      disabled={deletingId === img.id}
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-2 py-1 bg-slate-700 text-white rounded font-bold hover:bg-slate-600"
                    >
                      No
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal overlay */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center z-50 animate-fade-in select-none">
          {/* Close button */}
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Previous Arrow */}
          {lightboxIndex > 0 && (
            <button
              onClick={() => setLightboxIndex(lightboxIndex - 1)}
              className="absolute left-4 sm:left-8 text-slate-400 hover:text-white p-3 rounded-full hover:bg-white/10 transition"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Current Large Image */}
          <div className="max-w-4xl max-h-[80vh] px-4 flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[lightboxIndex].url}
              alt="fullscreen"
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
            />
            {/* Uploader Meta info */}
            <div className="flex items-center space-x-2.5 mt-4 text-xs text-slate-400">
              <span>{images[lightboxIndex].originalName}</span>
              <span>•</span>
              <span>{(images[lightboxIndex].size / 1024).toFixed(1)} KB</span>
            </div>
          </div>

          {/* Next Arrow */}
          {lightboxIndex < images.length - 1 && (
            <button
              onClick={() => setLightboxIndex(lightboxIndex + 1)}
              className="absolute right-4 sm:right-8 text-slate-400 hover:text-white p-3 rounded-full hover:bg-white/10 transition"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
