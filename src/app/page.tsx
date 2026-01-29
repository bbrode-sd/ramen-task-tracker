'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoginScreen } from '@/components/LoginScreen';
import { BoardList } from '@/components/BoardList';
import { KanbanBoard } from '@/components/KanbanBoard';

export default function Home() {
  const { user, loading } = useAuth();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-400 via-orange-500 to-red-500">
        <div className="relative">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-white/30 border-t-white"></div>
          <span className="absolute inset-0 flex items-center justify-center text-2xl">🍜</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (selectedBoardId) {
    return (
      <KanbanBoard
        boardId={selectedBoardId}
        onBackToBoards={() => setSelectedBoardId(null)}
      />
    );
  }

  return <BoardList onSelectBoard={setSelectedBoardId} />;
}
