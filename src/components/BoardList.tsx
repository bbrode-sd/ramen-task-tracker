'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Board } from '@/types';
import { subscribeToBoards, createBoard } from '@/lib/firestore';
import { Header } from './Header';

interface BoardListProps {
  onSelectBoard: (boardId: string) => void;
}

export function BoardList({ onSelectBoard }: BoardListProps) {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToBoards(user.uid, (fetchedBoards) => {
      setBoards(fetchedBoards);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreateBoard = async () => {
    if (!user || !newBoardName.trim()) return;

    try {
      const boardId = await createBoard(newBoardName.trim(), user.uid);
      setNewBoardName('');
      setIsCreating(false);
      onSelectBoard(boardId);
    } catch (error) {
      console.error('Error creating board:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="relative">
            <div className="animate-spin rounded-full h-14 w-14 border-4 border-orange-200 border-t-orange-500"></div>
            <span className="absolute inset-0 flex items-center justify-center text-xl">🍜</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8 sm:mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 tracking-tight">Your Boards</h2>
          <p className="text-gray-500">Select a board or create a new one to get started</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Create new board card */}
          {isCreating ? (
            <div className="bg-white rounded-2xl shadow-lg p-5 border-2 border-orange-400 ring-4 ring-orange-100">
              <input
                type="text"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="Board name..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-4 text-gray-900 placeholder:text-slate-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateBoard();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewBoardName('');
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateBoard}
                  disabled={!newBoardName.trim()}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-xl hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  Create Board
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewBoardName('');
                  }}
                  className="px-4 py-2.5 bg-gray-100 text-gray-600 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="bg-white/60 hover:bg-white rounded-2xl shadow-md hover:shadow-xl p-6 border-2 border-dashed border-gray-200 hover:border-orange-400 transition-all duration-200 group flex flex-col items-center justify-center min-h-[140px] backdrop-blur-sm"
            >
              <div className="w-14 h-14 rounded-2xl bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center mb-3 transition-colors">
                <svg
                  className="w-7 h-7 text-orange-400 group-hover:text-orange-500 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <span className="text-gray-500 group-hover:text-gray-700 font-medium transition-colors">
                Create new board
              </span>
            </button>
          )}

          {/* Existing boards */}
          {boards.map((board, index) => (
            <button
              key={board.id}
              onClick={() => onSelectBoard(board.id)}
              className="group relative bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 hover:from-orange-500 hover:via-orange-600 hover:to-red-600 rounded-2xl shadow-lg hover:shadow-xl p-6 text-left transition-all duration-200 hover:-translate-y-1 min-h-[140px] overflow-hidden"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Decorative pattern */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50"></div>
              
              {/* Shine effect on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-tr from-transparent via-white/10 to-transparent"></div>
              
              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">📋</span>
                  <svg className="w-5 h-5 text-white/50 group-hover:text-white/80 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">{board.name}</h3>
                <p className="text-white/70 text-sm flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {board.createdAt?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </button>
          ))}
        </div>

        {boards.length === 0 && !isCreating && (
          <div className="text-center py-16">
            <div className="inline-block mb-6 p-6 bg-white rounded-3xl shadow-lg">
              <span className="text-6xl block animate-float">📋</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">No boards yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Create your first board to start organizing your tasks with bilingual support
            </p>
            <button
              onClick={() => setIsCreating(true)}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-xl hover:from-orange-600 hover:to-red-600 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
            >
              Create Your First Board
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
