'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
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
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-[3px] border-[var(--border)] border-t-[var(--primary)] animate-spin"></div>
          <span className="absolute inset-0 flex items-center justify-center">
            <Image src="/logo-white.png" alt="Loading" width={40} height={40} className="opacity-30 dark:opacity-50" />
          </span>
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
