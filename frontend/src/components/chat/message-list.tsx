'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Message, MessageAttachment } from '@/lib/chat-api';
import Avatar from '../ui/avatar';
import { FileIcon, Download, ExternalLink, Image, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface MessageListProps {
  messages: Message[];
  hasMore: boolean;
  onLoadMore: () => void;
  isLoadingMore: boolean;
  typingUsers: { id: string; name: string }[];
  members?: { id: string; displayName: string; email: string; avatarUrl: string | null }[];
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function MessageList({
  messages,
  hasMore,
  onLoadMore,
  isLoadingMore,
  typingUsers,
  members = [],
}: MessageListProps) {
  const currentUser = useAuthStore((state) => state.user);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Lightbox State
  const [lightboxImages, setLightboxImages] = useState<MessageAttachment[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = (images: MessageAttachment[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    setLightboxImages([]);
  };

  const handlePrevImage = useCallback(() => {
    if (lightboxIndex === null || lightboxImages.length === 0) return;
    setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : lightboxImages.length - 1));
  }, [lightboxIndex, lightboxImages]);

  const handleNextImage = useCallback(() => {
    if (lightboxIndex === null || lightboxImages.length === 0) return;
    setLightboxIndex((prev) => (prev !== null && prev < lightboxImages.length - 1 ? prev + 1 : 0));
  }, [lightboxIndex, lightboxImages]);

  useEffect(() => {
    if (lightboxIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      } else if (e.key === 'Escape') {
        closeLightbox();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lightboxIndex, handlePrevImage, handleNextImage]);

  // Parse mentions in message content
  const renderMessageContent = (content: string, isSelf: boolean) => {
    if (!members || members.length === 0) {
      // Fallback regex to match @mentions (e.g. @DisplayName)
      const mentionRegex = /(@[a-zA-Z0-9_\s]+?)(?=\s|$|[.,!?;])/g;
      const parts = content.split(mentionRegex);

      return parts.map((part, index) => {
        if (part.startsWith('@')) {
          return (
            <span
              key={index}
              className={`inline-block px-1.5 py-0.5 mx-0.5 text-xs font-bold rounded-md shadow-xs border ${
                isSelf
                  ? 'bg-white/20 text-white border-white/30'
                  : 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 border-blue-100 dark:border-blue-800/50'
              }`}
            >
              {part}
            </span>
          );
        }
        return part;
      });
    }

    // Sort members by displayName length (descending) to match longest names first
    const sortedMembers = [...members].sort((a, b) => b.displayName.length - a.displayName.length);
    const escapedNames = sortedMembers.map((m) => m.displayName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    
    // Construct regex matching exactly any of the displayNames preceded by @
    const mentionRegex = new RegExp(`(@(?:${escapedNames.join('|')}))(?=\\s|$|[.,!?;])`, 'g');
    const parts = content.split(mentionRegex);

    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const nameWithoutAt = part.substring(1);
        const exists = members.some((m) => m.displayName === nameWithoutAt);
        if (exists) {
          return (
            <span
              key={index}
              className={`inline-block px-1.5 py-0.5 mx-0.5 text-xs font-bold rounded-md shadow-xs border ${
                isSelf
                  ? 'bg-white/20 text-white border-white/30'
                  : 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 border-blue-100 dark:border-blue-800/50'
              }`}
            >
              {part}
            </span>
          );
        }
      }
      return part;
    });
  };

  // Scroll to bottom logic
  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'smooth') => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  // Detect if user is scrolled near bottom
  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      // Within 150px of bottom
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 150;
    }
  };

  // Scroll to bottom on mount or new message
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom('smooth');
    }
  }, [messages, typingUsers]);

  // Load more trigger
  useEffect(() => {
    if (!hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const prevHeight = containerRef.current?.scrollHeight || 0;
          onLoadMore();

          // Keep scroll position after loading more
          setTimeout(() => {
            if (containerRef.current) {
              const currentHeight = containerRef.current.scrollHeight;
              containerRef.current.scrollTop = currentHeight - prevHeight;
            }
          }, 100);
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Group messages: group consecutive messages from same sender within 5 mins
  const groupedMessages: {
    senderId: string;
    sender: Message['sender'];
    createdAt: string;
    items: Message[];
  }[] = [];

  messages.forEach((msg) => {
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    const messageTime = new Date(msg.createdAt).getTime();
    const groupTime = lastGroup ? new Date(lastGroup.createdAt).getTime() : 0;

    if (
      lastGroup &&
      lastGroup.senderId === msg.senderId &&
      messageTime - groupTime < 5 * 60 * 1000
    ) {
      lastGroup.items.push(msg);
    } else {
      groupedMessages.push({
        senderId: msg.senderId,
        sender: msg.sender,
        createdAt: msg.createdAt,
        items: [msg],
      });
    }
  });

  return (
    <>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 transition duration-150 scrollbar-thin"
      >
      {/* Sentinel for infinite scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center p-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {groupedMessages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400 dark:text-slate-500">
          <MessageSquareIcon className="w-12 h-12 stroke-[1.5] mb-2" />
          <p className="text-sm font-semibold">No messages yet. Say hello!</p>
        </div>
      )}

      {groupedMessages.map((group, groupIdx) => {
        const isSelf = group.senderId === currentUser?.id;
        return (
          <div
            key={groupIdx}
            className={`flex items-start space-x-3.5 ${
              isSelf ? 'flex-row-reverse space-x-reverse' : ''
            }`}
          >
            {/* Avatar */}
            <Avatar name={group.sender.displayName} src={group.sender.avatarUrl} size="md" />

            {/* Bubble Container */}
            <div className={`flex flex-col max-w-[70%] ${isSelf ? 'items-end' : 'items-start'}`}>
              {/* Header Info */}
              <div className="flex items-baseline space-x-2 pb-1 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {group.sender.displayName}
                </span>
                <span className="text-slate-400 dark:text-slate-500 text-[10px]">
                  {new Date(group.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {/* Messages in Group */}
              <div className="space-y-1 w-full">
                {group.items.map((msg, msgIdx) => (
                  <div key={msg.id} className="group relative">
                    <div
                      className={`p-3 rounded-2xl text-sm leading-relaxed transition shadow-xs ${
                        isSelf
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/50 dark:border-slate-800 rounded-tl-none'
                      }`}
                    >
                      {/* Message Content */}
                      <p className="whitespace-pre-wrap">{renderMessageContent(msg.content, isSelf)}</p>

                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (() => {
                        const imageAttachments = msg.attachments.filter((att) => att.mimeType.startsWith('image/'));
                        const documentAttachments = msg.attachments.filter((att) => !att.mimeType.startsWith('image/'));

                        return (
                          <div className="mt-3.5 space-y-3">
                            {/* Inline Image Grid */}
                            {imageAttachments.length > 0 && (
                              <div>
                                {imageAttachments.length === 1 ? (
                                  <div
                                    className="relative rounded-xl overflow-hidden cursor-pointer border border-slate-200/50 dark:border-slate-850 max-h-60 max-w-xs group/img"
                                    onClick={() => openLightbox(imageAttachments, 0)}
                                  >
                                    <img
                                      src={imageAttachments[0].url}
                                      alt={imageAttachments[0].originalName}
                                      className="w-full h-full object-cover max-h-60 group-hover/img:scale-[1.02] transition duration-200"
                                    />
                                  </div>
                                ) : imageAttachments.length === 2 ? (
                                  <div className="grid grid-cols-2 gap-2 max-w-sm">
                                    {imageAttachments.map((img, idx) => (
                                      <div
                                        key={img.id}
                                        className="relative aspect-video rounded-xl overflow-hidden cursor-pointer border border-slate-200/50 dark:border-slate-850 group/img"
                                        onClick={() => openLightbox(imageAttachments, idx)}
                                      >
                                        <img
                                          src={img.url}
                                          alt={img.originalName}
                                          className="w-full h-full object-cover group-hover/img:scale-[1.02] transition duration-200"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                ) : imageAttachments.length === 3 ? (
                                  <div className="grid grid-cols-3 gap-2 max-w-sm">
                                    {imageAttachments.map((img, idx) => (
                                      <div
                                        key={img.id}
                                        className="relative aspect-square rounded-xl overflow-hidden cursor-pointer border border-slate-200/50 dark:border-slate-850 group/img"
                                        onClick={() => openLightbox(imageAttachments, idx)}
                                      >
                                        <img
                                          src={img.url}
                                          alt={img.originalName}
                                          className="w-full h-full object-cover group-hover/img:scale-[1.02] transition duration-200"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-2 max-w-sm">
                                    {imageAttachments.slice(0, 4).map((img, idx) => {
                                      const isLast = idx === 3;
                                      const extraCount = imageAttachments.length - 4;
                                      return (
                                        <div
                                          key={img.id}
                                          className="relative aspect-video rounded-xl overflow-hidden cursor-pointer border border-slate-200/50 dark:border-slate-850 group/img"
                                          onClick={() => openLightbox(imageAttachments, idx)}
                                        >
                                          <img
                                            src={img.url}
                                            alt={img.originalName}
                                            className="w-full h-full object-cover group-hover/img:scale-[1.02] transition duration-200"
                                          />
                                          {isLast && extraCount > 0 && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-base font-bold">
                                              +{extraCount}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Documents */}
                            {documentAttachments.length > 0 && (
                              <div className="space-y-2">
                                {documentAttachments.map((file) => (
                                  <div
                                    key={file.id}
                                    className={`rounded-xl border p-2 flex items-center justify-between ${
                                      isSelf
                                        ? 'bg-blue-700/40 border-blue-600/50 text-blue-100'
                                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2.5 min-w-0">
                                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">
                                        <FileIcon className="w-5 h-5" />
                                      </div>
                                      <div className="text-left min-w-0">
                                        <p className="text-xs font-bold truncate">{file.originalName}</p>
                                        <p className="text-[10px] opacity-75">{formatBytes(file.size)}</p>
                                      </div>
                                    </div>
                                    <a
                                      href={file.url}
                                      download={file.originalName}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition shrink-0"
                                    >
                                      <Download className="w-4 h-4" />
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {/* Typing indicators */}
      {typingUsers.length > 0 && (
        <div className="flex items-center space-x-2 text-xs text-slate-400 dark:text-slate-500 animate-pulse py-1">
          <div className="flex space-x-1">
            <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"></span>
            <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-100"></span>
            <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-200"></span>
          </div>
          <span>
            {typingUsers.map((u) => u.name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'}{' '}
            typing...
          </span>
        </div>
      )}
      </div>

      {/* Lightbox Overlay */}
      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center select-none">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between text-white bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex flex-col min-w-0 pr-4 text-left">
              <span className="text-sm font-bold truncate max-w-[250px] md:max-w-md">
                {lightboxImages[lightboxIndex].originalName}
              </span>
              <span className="text-[11px] text-slate-300 mt-0.5">
                {lightboxIndex + 1} of {lightboxImages.length}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <a
                href={lightboxImages[lightboxIndex].url}
                download={lightboxImages[lightboxIndex].originalName}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl hover:bg-white/10 transition text-white"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </a>
              <button
                onClick={closeLightbox}
                className="p-2 rounded-xl hover:bg-white/10 transition text-white"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Previous Button */}
          {lightboxImages.length > 1 && (
            <button
              onClick={handlePrevImage}
              className="absolute left-4 p-2.5 rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition text-white z-10 border border-white/10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Image */}
          <div className="max-w-[85%] max-h-[75vh] flex items-center justify-center">
            <img
              src={lightboxImages[lightboxIndex].url}
              alt={lightboxImages[lightboxIndex].originalName}
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl transition-all duration-150"
            />
          </div>

          {/* Next Button */}
          {lightboxImages.length > 1 && (
            <button
              onClick={handleNextImage}
              className="absolute right-4 p-2.5 rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition text-white z-10 border border-white/10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </>
  );
}

function MessageSquareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
