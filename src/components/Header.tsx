'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

interface HeaderProps {
  boardName?: string;
  onBoardNameChange?: (name: string) => void;
  boardId?: string;
}

export function Header({ boardName, onBoardNameChange, boardId }: HeaderProps) {
  const { user, signOut } = useAuth();

  return (
    <header className="bg-gradient-to-r from-orange-500 via-orange-500 to-red-500 shadow-lg relative overflow-hidden">
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50"></div>
      
      <div className="relative px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          {boardId && (
            <Link
              href="/"
              className="p-2 -ml-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
              aria-label="Back to boards"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          )}
          <div className="flex items-center gap-2.5">
            <span className="text-2xl drop-shadow-sm">🍜</span>
            {boardName ? (
              <input
                type="text"
                value={boardName}
                onChange={(e) => onBoardNameChange?.(e.target.value)}
                className="text-lg sm:text-xl font-bold text-white bg-white/10 border border-white/20 focus:bg-white/20 focus:border-white/40 focus:outline-none rounded-lg px-3 py-1.5 min-w-0 max-w-[200px] sm:max-w-none transition-all placeholder:text-white/50"
              />
            ) : (
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Ramen Task Tracker
              </h1>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          {user && (
            <>
              <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 bg-white/10 rounded-xl backdrop-blur-sm">
                {user.photoURL && (
                  <Image
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    width={28}
                    height={28}
                    className="rounded-full ring-2 ring-white/30"
                  />
                )}
                <span className="text-white/90 text-sm font-medium hidden sm:block max-w-[150px] truncate">
                  {user.displayName || user.email}
                </span>
              </div>
              <button
                onClick={signOut}
                className="px-3 sm:px-4 py-2 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white text-sm font-medium rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/10 hover:border-white/20"
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
