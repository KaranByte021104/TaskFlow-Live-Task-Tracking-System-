import React from 'react';
import { clsx } from 'clsx';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const getInitials = (userName: string) => {
    const parts = userName.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return userName.slice(0, Math.min(2, userName.length)).toUpperCase();
  };

  const sizes = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
  };

  // Generate a premium background gradient color based on user name initials
  const getBgColor = (userName: string) => {
    const hash = userName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const gradients = [
      'from-blue-500 to-indigo-600',
      'from-purple-500 to-pink-600',
      'from-teal-500 to-emerald-600',
      'from-orange-400 to-red-500',
      'from-rose-500 to-pink-600',
      'from-violet-500 to-purple-700',
    ];
    return gradients[hash % gradients.length];
  };

  return (
    <div
      className={clsx(
        'relative inline-flex items-center justify-center rounded-full overflow-hidden font-bold select-none border border-white shadow-sm',
        sizes[size],
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div
          className={clsx(
            'w-full h-full flex items-center justify-center bg-gradient-to-br text-white',
            getBgColor(name)
          )}
        >
          {getInitials(name)}
        </div>
      )}
    </div>
  );
}
