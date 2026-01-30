'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FilterProvider } from '@/contexts/FilterContext';
import { LoginScreen } from '@/components/LoginScreen';
import { KanbanBoard } from '@/components/KanbanBoard';
import { ErrorBoundary, FullPageErrorFallback } from '@/components/ErrorBoundary';
import { useRouter } from 'next/navigation';

interface BoardPageProps {
  params: Promise<{
    boardId: string;
  }>;
}

export default function BoardPage({ params }: BoardPageProps) {
  const { boardId } = use(params);
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const cardId = searchParams.get('card');
  const router = useRouter();

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

  return (
    <ErrorBoundary 
      context={`Board:${boardId}`}
      fallback={
        <FullPageErrorFallback 
          onRetry={() => window.location.reload()}
          onGoHome={() => router.push('/')}
        />
      }
    >
      <FilterProvider>
        <KanbanBoard boardId={boardId} selectedCardId={cardId} />
      </FilterProvider>
    </ErrorBoundary>
  );
}
