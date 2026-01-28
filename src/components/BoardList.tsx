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
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Boards</h2>
          <p className="text-gray-600">Select a board or create a new one</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Create new board card */}
          {isCreating ? (
            <div className="bg-white rounded-xl shadow-md p-4 border-2 border-orange-500">
              <input
                type="text"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="Board name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mb-3 placeholder:text-gray-500"
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
                  className="flex-1 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewBoardName('');
                  }}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="bg-white/50 hover:bg-white rounded-xl shadow-md p-6 border-2 border-dashed border-gray-300 hover:border-orange-500 transition-all group flex flex-col items-center justify-center min-h-[120px]"
            >
              <svg
                className="w-10 h-10 text-gray-400 group-hover:text-orange-500 transition-colors mb-2"
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
              <span className="text-gray-600 group-hover:text-orange-600 font-medium">
                Create new board
              </span>
            </button>
          )}

          {/* Existing boards */}
          {boards.map((board) => (
            <button
              key={board.id}
              onClick={() => onSelectBoard(board.id)}
              className="bg-gradient-to-br from-orange-400 to-red-500 hover:from-orange-500 hover:to-red-600 rounded-xl shadow-md p-6 text-left transition-all hover:shadow-lg hover:scale-[1.02] min-h-[120px]"
            >
              <h3 className="text-lg font-bold text-white mb-2">{board.name}</h3>
              <p className="text-white/80 text-sm">
                Created {board.createdAt?.toDate().toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>

        {boards.length === 0 && !isCreating && (
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">📋</span>
            <h3 className="text-xl font-medium text-gray-700 mb-2">No boards yet</h3>
            <p className="text-gray-500">Create your first board to get started!</p>
          </div>
        )}
      </main>
    </div>
  );
}
