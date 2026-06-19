'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProjectFilesApi, uploadProjectFilesApi, deleteProjectFileApi, ProjectFile } from '@/lib/files-api';
import { getProjectApi } from '@/lib/projects-api';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/useAuthStore';
import Avatar from '@/components/ui/avatar';
import Spinner from '@/components/ui/spinner';
import {
  FileIcon,
  FileText,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon,
  Download,
  Trash2,
  UploadCloud,
  ChevronRight,
  Eye,
  X,
} from 'lucide-react';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-emerald-500" />;
  if (mimeType === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />;
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv')
  ) {
    return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
  }
  if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('tar')) {
    return <FileArchive className="w-5 h-5 text-amber-500" />;
  }
  return <FileIcon className="w-5 h-5 text-blue-500" />;
}

export default function ProjectFilesPage({ params }: { params: { projectId: string } }) {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const currentUser = useAuthStore((state) => state.user);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<string[][] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!previewFile) {
      setPreviewContent(null);
      setCsvRows(null);
      return;
    }

    const isText = previewFile.mimeType === 'text/plain';
    const isCsv = previewFile.mimeType === 'text/csv' || previewFile.originalName.endsWith('.csv');

    if (isText || isCsv) {
      setLoadingPreview(true);
      fetch(previewFile.url)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch file content');
          return res.text();
        })
        .then((text) => {
          if (isCsv) {
            const parsed = parseCSV(text);
            setCsvRows(parsed);
          } else {
            setPreviewContent(text);
          }
        })
        .catch((err) => {
          console.error(err);
          setPreviewContent('Failed to load file contents for preview.');
        })
        .finally(() => {
          setLoadingPreview(false);
        });
    }
  }, [previewFile]);

  const parseCSV = (text: string): string[][] => {
    return text
      .split('\n')
      .map((line) => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      })
      .filter((row) => row.length > 0 && row.some((cell) => cell !== ''));
  };

  const projectId = params.projectId;

  // Query Project details for roles check
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectApi(projectId),
    enabled: !!projectId,
  });

  // Query Project Files
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['project-files', projectId],
    queryFn: () => getProjectFilesApi(projectId),
    enabled: !!projectId,
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: (filesToUpload: File[]) => uploadProjectFilesApi(projectId, filesToUpload),
    onSuccess: (newFiles) => {
      queryClient.setQueryData<ProjectFile[]>(['project-files', projectId], (old) => {
        if (!old) return newFiles;
        // avoid duplicates
        const unique = newFiles.filter((nf) => !old.some((of) => of.id === nf.id));
        return [...unique, ...old];
      });
      queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] });
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => deleteProjectFileApi(projectId, fileId),
    onSuccess: (_, fileId) => {
      queryClient.setQueryData<ProjectFile[]>(['project-files', projectId], (old) => {
        if (!old) return [];
        return old.filter((f) => f.id !== fileId);
      });
      queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] });
    },
  });

  // Listen to Socket.IO live updates
  useEffect(() => {
    if (!socket || !projectId) return;

    // Join room just in case
    socket.emit('joinProject', projectId);

    const handleFileUploaded = (newFiles: ProjectFile[]) => {
      queryClient.setQueryData<ProjectFile[]>(['project-files', projectId], (old) => {
        if (!old) return newFiles;
        const unique = newFiles.filter((nf) => !old.some((of) => of.id === nf.id));
        return [...unique, ...old];
      });
    };

    const handleFileDeleted = (data: { fileId: string }) => {
      queryClient.setQueryData<ProjectFile[]>(['project-files', projectId], (old) => {
        if (!old) return [];
        return old.filter((f) => f.id !== data.fileId);
      });
    };

    socket.on('project:file_uploaded', handleFileUploaded);
    socket.on('project:file_deleted', handleFileDeleted);

    return () => {
      socket.off('project:file_uploaded', handleFileUploaded);
      socket.off('project:file_deleted', handleFileDeleted);
    };
  }, [socket, projectId, queryClient]);

  // Drag & Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      const validFiles = droppedFiles.filter((f) => f.size <= 20 * 1024 * 1024);
      if (validFiles.length > 0) {
        uploadMutation.mutate(validFiles);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFiles = Array.from(e.target.files);
      const validFiles = selectedFiles.filter((f) => f.size <= 20 * 1024 * 1024);
      if (validFiles.length > 0) {
        uploadMutation.mutate(validFiles);
      }
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleDelete = (fileId: string) => {
    if (confirm('Are you sure you want to delete this file?')) {
      deleteMutation.mutate(fileId);
    }
  };

  // Find user's member role
  const userMember = project?.members.find((m) => m.userId === currentUser?.id);
  const isPrivileged = userMember?.role === 'ADMIN' || userMember?.role === 'MANAGER';

  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
        className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition duration-150 ${
          dragActive
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
            : 'border-slate-200 dark:border-slate-800 hover:border-blue-400 hover:bg-slate-50/40 dark:hover:bg-slate-800/10'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-2xl mb-3 shadow-xs">
          <UploadCloud className="w-6 h-6 animate-pulse" />
        </div>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Drag and drop files here, or click to browse
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Supports PDFs, Word, Excel, ZIPs, CSVs and images up to 20MB
        </p>
      </div>

      {/* Files List Table */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 dark:text-white">Project Files ({files.length})</h2>
        </div>

        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-500">
            <UploadCloud className="w-12 h-12 stroke-[1.5] mb-2 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-semibold">No files attached to this project yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-450 dark:text-slate-500 tracking-wider">
                  <th className="py-3.5 px-6">Name</th>
                  <th className="py-3.5 px-6">Size</th>
                  <th className="py-3.5 px-6">Uploaded By</th>
                  <th className="py-3.5 px-6">Date</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-sm">
                {files.map((file) => {
                  const canDelete = isPrivileged || file.uploaderId === currentUser?.id;
                  return (
                    <tr
                      key={file.id}
                      className="hover:bg-slate-50/55 dark:hover:bg-slate-800/20 transition duration-100"
                    >
                      {/* Name column */}
                      <td className="py-4 px-6 font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-3.5">
                        <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl shrink-0">
                          {getFileIcon(file.mimeType)}
                        </div>
                        <span className="truncate max-w-[200px] sm:max-w-xs">{file.originalName}</span>
                      </td>

                      {/* Size column */}
                      <td className="py-4 px-6 text-slate-500 dark:text-slate-400 font-medium">
                        {formatBytes(file.size)}
                      </td>

                      {/* Uploader column */}
                      <td className="py-4 px-6 text-slate-500 dark:text-slate-400">
                        <div className="flex items-center space-x-2">
                          <Avatar
                            name={file.uploader.displayName}
                            src={file.uploader.avatarUrl}
                            size="sm"
                          />
                          <span className="font-semibold text-slate-700 dark:text-slate-350">
                            {file.uploader.displayName}
                          </span>
                        </div>
                      </td>

                      {/* Date column */}
                      <td className="py-4 px-6 text-slate-500 dark:text-slate-400 font-medium">
                        {new Date(file.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions column */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => setPreviewFile(file)}
                            className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition duration-150"
                            title="Preview"
                          >
                            <Eye className="w-4.5 h-4.5" />
                          </button>
                          <a
                            href={file.url}
                            download={file.originalName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl text-slate-500 hover:text-slate-750 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition duration-150"
                            title="Download"
                          >
                            <Download className="w-4.5 h-4.5" />
                          </a>
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(file.id)}
                              className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition duration-150"
                              title="Delete"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col transition duration-150 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/80">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  {getFileIcon(previewFile.mimeType)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-md sm:max-w-xl">
                    {previewFile.originalName}
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {formatBytes(previewFile.size)} • Uploaded by {previewFile.uploader.displayName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-2 rounded-xl text-slate-450 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5.5 h-5.5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50/30 dark:bg-slate-950/20">
              {loadingPreview ? (
                <div className="h-64 flex items-center justify-center">
                  <Spinner />
                </div>
              ) : (() => {
                const mime = previewFile.mimeType;
                const isImage = mime.startsWith('image/');
                const isPdf = mime === 'application/pdf';
                const isCsv = mime === 'text/csv' || previewFile.originalName.endsWith('.csv');
                const isText = mime === 'text/plain';

                if (isImage) {
                  return (
                    <div className="flex justify-center items-center h-full min-h-[300px]">
                      <img
                        src={previewFile.url}
                        alt={previewFile.originalName}
                        className="max-w-full max-h-[60vh] object-contain rounded-2xl shadow-md border border-slate-200/50 dark:border-slate-800"
                      />
                    </div>
                  );
                }

                if (isPdf) {
                  return (
                    <iframe
                      src={previewFile.url}
                      title={previewFile.originalName}
                      className="w-full h-[65vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs"
                    />
                  );
                }

                if (isCsv && csvRows) {
                  return (
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm max-h-[60vh]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider sticky top-0">
                            {csvRows[0]?.map((cell, idx) => (
                              <th key={idx} className="py-3 px-4 whitespace-nowrap">
                                {cell || `Column ${idx + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                          {csvRows.slice(1).map((row, rowIdx) => (
                            <tr
                              key={rowIdx}
                              className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition duration-75"
                            >
                              {row.map((cell, cellIdx) => (
                                <td key={cellIdx} className="py-2.5 px-4 whitespace-nowrap">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }

                if (isText && previewContent !== null) {
                  return (
                    <pre className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl overflow-auto text-xs max-h-[60vh] font-mono leading-relaxed shadow-sm whitespace-pre-wrap">
                      {previewContent}
                    </pre>
                  );
                }

                return (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl text-slate-400 dark:text-slate-650 mb-4">
                      {getFileIcon(previewFile.mimeType)}
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                      No preview available for this file type
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                      You can still download the file to view it on your device.
                    </p>
                    <a
                      href={previewFile.url}
                      download={previewFile.originalName}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition duration-150 shadow-sm"
                    >
                      Download File
                    </a>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
