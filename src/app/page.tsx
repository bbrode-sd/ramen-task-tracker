'use client';

import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { LoginScreen } from '@/components/LoginScreen';
import { BoardList } from '@/components/BoardList';

export default function Home() {
  const { user, loading } = useAuth();

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

  return <BoardList />;
}
