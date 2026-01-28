'use client';

import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

interface HeaderProps {
  boardName?: string;
  onBoardNameChange?: (name: string) => void;
  onBackToBoards?: () => void;
}

export function Header({ boardName, onBoardNameChange, onBackToBoards }: HeaderProps) {
  const { user, signOut } = useAuth();

  return (
    <header className="bg-gradient-to-r from-orange-500 to-red-500 shadow-lg">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBackToBoards && (
            <button
              onClick={onBackToBoards}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍜</span>
            {boardName ? (
              <input
                type="text"
                value={boardName}
                onChange={(e) => onBoardNameChange?.(e.target.value)}
                className="text-xl font-bold text-white bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-white/30 rounded px-2 py-1"
              />
            ) : (
              <h1 className="text-xl font-bold text-white">Ramen Task Tracker</h1>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {user && (
            <>
              <div className="flex items-center gap-2">
                {user.photoURL && (
                  <Image
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                )}
                <span className="text-white/90 text-sm hidden sm:block">
                  {user.displayName || user.email}
                </span>
              </div>
              <button
                onClick={signOut}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-sm rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
