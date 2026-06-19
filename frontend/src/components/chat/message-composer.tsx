'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, X, FileIcon } from 'lucide-react';
import Avatar from '../ui/avatar';

interface MessageComposerProps {
  onSend: (content: string, mentionedUserIds: string[], files?: File[]) => Promise<void>;
  members: { id: string; displayName: string; email: string; avatarUrl: string | null }[];
  onTyping: (isTyping: boolean) => void;
}

export default function MessageComposer({ onSend, members, onTyping }: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Previews map for files
  const [filePreviews, setFilePreviews] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const newPreviews: { [key: string]: string } = {};
    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        newPreviews[key] = URL.createObjectURL(file);
      }
    });

    setFilePreviews((prev) => {
      // Revoke old previews
      Object.keys(prev).forEach((key) => {
        if (!newPreviews[key]) {
          URL.revokeObjectURL(prev[key]);
        }
      });
      return newPreviews;
    });

    return () => {
      Object.values(newPreviews).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  // Filtered members for mention autocomplete
  const filteredMembers = members.filter((m) =>
    m.displayName.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // Manage typing state and debounce stop typing
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Mention list keyboard navigation
    if (showMentions && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev + 1) % filteredMembers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        insertMention(filteredMembers[selectedMentionIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setContent(text);

    // Trigger typing start
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTyping(true);
    }

    // Reset typing stop debounce
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTyping(false);
    }, 3000);

    // Mention trigger logic
    const selectionStart = e.target.selectionStart;
    const textBeforeCursor = text.slice(0, selectionStart);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1 && (lastAtIndex === 0 || /\s/.test(textBeforeCursor[lastAtIndex - 1]))) {
      const searchStr = textBeforeCursor.slice(lastAtIndex + 1);
      if (!/\s/.test(searchStr)) {
        setShowMentions(true);
        setMentionSearch(searchStr);
        setMentionTriggerIndex(lastAtIndex);
        setSelectedMentionIndex(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (member: typeof members[0]) => {
    if (mentionTriggerIndex === -1 || !inputRef.current) return;

    const beforeMention = content.slice(0, mentionTriggerIndex);
    const afterMention = content.slice(inputRef.current.selectionStart);
    const newContent = `${beforeMention}@${member.displayName} ${afterMention}`;

    setContent(newContent);
    setShowMentions(false);
    
    // Put focus back to input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const cursorPosition = mentionTriggerIndex + member.displayName.length + 2; // @ + name + space
        inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 50);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      
      // Limit 10MB
      const validFiles = selectedFiles.filter((file) => {
        if (file.size > 10 * 1024 * 1024) {
          alert(`File ${file.name} is larger than 10MB`);
          return false;
        }
        return true;
      });

      setFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (isSending) return;
    if (!content.trim() && files.length === 0) return;

    setIsSending(true);

    try {
      // Find all @mentions inside content
      const mentionedUserIds: string[] = [];
      members.forEach((m) => {
        if (content.includes(`@${m.displayName}`)) {
          mentionedUserIds.push(m.id);
        }
      });

      await onSend(content, mentionedUserIds, files);
      setContent('');
      setFiles([]);
      
      // Stop typing immediately
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      isTypingRef.current = false;
      onTyping(false);

      if (inputRef.current) inputRef.current.focus();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (isTypingRef.current) {
        onTyping(false);
      }
    };
  }, [onTyping]);

  return (
    <div className="relative border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-2 space-y-2 shadow-xs transition duration-150">
      {/* Mention Autocomplete Popover */}
      {showMentions && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-64 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-30 p-1 divide-y divide-slate-100 dark:divide-slate-700/50">
          {filteredMembers.map((member, idx) => (
            <button
              key={member.id}
              onClick={() => insertMention(member)}
              onMouseEnter={() => setSelectedMentionIndex(idx)}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 text-sm text-left rounded-md transition ${
                idx === selectedMentionIndex
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-450 font-semibold'
                  : 'text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <Avatar name={member.displayName} src={member.avatarUrl} size="sm" />
              <span className="truncate">{member.displayName}</span>
            </button>
          ))}
        </div>
      )}

      {/* Uploaded File Previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2.5 pb-2">
          {files.map((file, idx) => {
            const isImage = file.type.startsWith('image/');
            const previewKey = `${file.name}-${file.size}-${file.lastModified}`;
            const previewUrl = filePreviews[previewKey];

            if (isImage && previewUrl) {
              return (
                <div
                  key={idx}
                  className="relative group w-14 h-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-850 shrink-0 shadow-xs"
                >
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={idx}
                className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 pr-2.5 text-xs font-semibold text-slate-700 dark:text-slate-350"
              >
                <div className="p-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-450 shrink-0">
                  <FileIcon className="w-4 h-4" />
                </div>
                <span className="truncate max-w-[120px]">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Input Composer Box */}
      <div className="flex items-end space-x-2">
        <label className="p-2 cursor-pointer text-slate-450 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition duration-150 shrink-0">
          <Paperclip className="w-5 h-5" />
          <input
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </label>

        <textarea
          ref={inputRef}
          value={content}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Write a message... Use @ to mention someone"
          rows={1}
          className="flex-1 resize-none max-h-32 min-h-[40px] py-2 px-3 border-0 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-0 focus:outline-none scrollbar-none"
          style={{ height: 'auto' }}
        />

        <button
          onClick={handleSubmit}
          disabled={isSending || (!content.trim() && files.length === 0)}
          className={`p-2.5 rounded-xl text-white transition shrink-0 ${
            content.trim() || files.length > 0
              ? 'bg-blue-600 hover:bg-blue-700 shadow-sm'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
          }`}
        >
          <Send className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  );
}
