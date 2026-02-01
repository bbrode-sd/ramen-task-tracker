'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useLocale } from '@/contexts/LocaleContext';
import { Board, BoardTemplate } from '@/types';
import { subscribeToBoardsExcludingSubBoards, createBoard, getBoardTemplates, createBoardFromTemplate, BUILT_IN_BOARD_TEMPLATES } from '@/lib/firestore';
import { Header } from './Header';
import { EmptyState } from './EmptyState';
import { ReplayTourButton } from './OnboardingTour';
import { ShortcutHint } from './Tooltip';

export function BoardList() {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale } = useLocale();
  const { 
    hasCompletedOnboarding, 
    setIsNewUser, 
    startOnboarding,
  } = useOnboarding();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Template state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [boardTemplates, setBoardTemplates] = useState<BoardTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);

  // Use refs to avoid re-running the subscription effect when these values change
  const hasCompletedOnboardingRef = useRef(hasCompletedOnboarding);
  const onboardingTriggeredRef = useRef(false);
  
  // Keep the ref in sync with the state
  useEffect(() => {
    hasCompletedOnboardingRef.current = hasCompletedOnboarding;
  }, [hasCompletedOnboarding]);

  useEffect(() => {
    if (!user) return;

    // Reset onboarding trigger flag when user changes
    onboardingTriggeredRef.current = false;

    // Use subscribeToBoardsExcludingSubBoards to filter out sub-boards from the list
    const unsubscribe = subscribeToBoardsExcludingSubBoards(
      user.uid,
      (fetchedBoards) => {
        setBoards(fetchedBoards);
        setLoading(false);
        setError(null);
        
        // Detect new user (no boards) and trigger onboarding
        // Use ref to get latest value without causing effect re-run
        // Also prevent triggering multiple times
        if (fetchedBoards.length === 0 && !hasCompletedOnboardingRef.current && !onboardingTriggeredRef.current) {
          onboardingTriggeredRef.current = true;
          setIsNewUser(true);
          // Small delay to let the UI render first
          setTimeout(() => {
            startOnboarding();
          }, 500);
        }
      },
      (err) => {
        console.error('Error subscribing to boards:', err);
        setError('Failed to load boards. Please try again.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, setIsNewUser, startOnboarding]);

  // Fetch templates when picker opens
  useEffect(() => {
    const fetchTemplates = async () => {
      if (showTemplatePicker && user) {
        setIsLoadingTemplates(true);
        try {
          const templates = await getBoardTemplates(user.uid);
          setBoardTemplates(templates);
        } catch (error) {
          console.error('Failed to fetch templates:', error);
        } finally {
          setIsLoadingTemplates(false);
        }
      }
    };
    fetchTemplates();
  }, [showTemplatePicker, user]);

  const handleCreateBoard = async () => {
    if (!user || !newBoardName.trim()) return;

    setIsCreatingBoard(true);
    try {
      let boardId: string;
      
      if (selectedTemplate) {
        boardId = await createBoardFromTemplate(selectedTemplate, newBoardName.trim(), user.uid);
      } else {
        boardId = await createBoard(newBoardName.trim(), user.uid);
      }
      
      setNewBoardName('');
      setIsCreating(false);
      setShowTemplatePicker(false);
      setSelectedTemplate(null);
      router.push(`/boards/${boardId}`);
    } catch (error) {
      console.error('Error creating board:', error);
    } finally {
      setIsCreatingBoard(false);
    }
  };

  const handleSelectTemplate = (templateId: string | null) => {
    setSelectedTemplate(templateId);
    setShowTemplatePicker(false);
    setIsCreating(true);
  };

  const getTemplateInfo = (templateId: string | null) => {
    if (!templateId) return null;
    return boardTemplates.find(t => t.id === templateId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-[3px] border-[var(--border)] border-t-[var(--primary)] animate-spin"></div>
            <span className="absolute inset-0 flex items-center justify-center">
              <Image src="/logo-white.png" alt="Loading" width={32} height={32} className="opacity-30 dark:opacity-50" />
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-64px)] p-4">
          <div className="bg-[var(--surface)] rounded-2xl shadow-xl border border-[var(--border)] p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-[var(--error-bg)] rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">{t('boards.errorLoading')}</h2>
            <p className="text-[var(--text-secondary)] mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gradient-to-r from-[var(--primary)] to-rose-500 text-white font-medium rounded-xl hover:opacity-90 transition-all shadow-md hover:shadow-lg"
            >
              {t('common.tryAgain')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Page header with refined typography */}
        <div className="mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-2 tracking-tight">{t('boards.title')}</h2>
          <p className="text-[var(--text-secondary)]">{t('boards.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Create new board card */}
          {showTemplatePicker ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 border-2 border-purple-400 dark:border-purple-500 ring-4 ring-purple-100 dark:ring-purple-900/30 col-span-1 sm:col-span-2 md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900 dark:to-purple-800 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t('boards.templates.title')}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{t('boards.templates.subtitle')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTemplatePicker(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-200 border-t-purple-500"></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {/* Blank board option */}
                  <button
                    onClick={() => handleSelectTemplate(null)}
                    className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 flex items-center justify-center mb-3 transition-colors">
                      <svg className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{t('boards.templates.blank')}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('boards.templates.blankDescription')}</p>
                  </button>
                  
                  {/* Built-in and user templates */}
                  {boardTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-left group ${
                        template.isBuiltIn 
                          ? 'border-slate-200 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20' 
                          : 'border-slate-200 dark:border-slate-600 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                        template.isBuiltIn 
                          ? 'bg-blue-50 dark:bg-blue-900/30 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50' 
                          : 'bg-purple-50 dark:bg-purple-900/30 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50'
                      }`}>
                        {template.isBuiltIn ? (
                          <svg className="w-5 h-5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-semibold transition-colors ${
                          template.isBuiltIn 
                            ? 'text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400' 
                            : 'text-slate-700 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400'
                        }`}>{template.name}</p>
                        {template.isBuiltIn && (
                          <span className="text-[10px] font-medium text-blue-500 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded">{t('boards.templates.builtIn')}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2">{template.description}</p>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {template.columns.slice(0, 3).map((col, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">{col.name}</span>
                        ))}
                        {template.columns.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 rounded">+{template.columns.length - 3}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : isCreating ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 border-2 border-emerald-400 dark:border-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-900/30">
              {selectedTemplate && getTemplateInfo(selectedTemplate) && (
                <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-xl border border-purple-100 dark:border-purple-800">
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    <span className="font-medium text-purple-700 dark:text-purple-300">Using: {getTemplateInfo(selectedTemplate)?.name}</span>
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {getTemplateInfo(selectedTemplate)?.columns.map((col, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 bg-purple-100 dark:bg-purple-800/50 text-purple-600 dark:text-purple-300 rounded">{col.name}</span>
                    ))}
                  </div>
                </div>
              )}
              <input
                type="text"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder={t('boards.boardName')}
                className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-4 text-gray-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreatingBoard) handleCreateBoard();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewBoardName('');
                    setSelectedTemplate(null);
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateBoard}
                  disabled={!newBoardName.trim() || isCreatingBoard}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  {isCreatingBoard ? t('boards.creating') : t('boards.createBoard')}
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewBoardName('');
                    setSelectedTemplate(null);
                  }}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowTemplatePicker(true)}
              data-onboarding="create-board"
              className="group relative bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-2xl shadow-sm hover:shadow-lg p-6 border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)] transition-all duration-300 flex flex-col items-center justify-center min-h-[160px]"
            >
              {/* Glow effect on hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--primary)]/5 to-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              <div className="relative w-14 h-14 rounded-2xl bg-[var(--primary-light)] group-hover:bg-[var(--primary-muted)] flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110">
                <svg
                  className="w-7 h-7 text-[var(--primary)] transition-transform duration-300 group-hover:rotate-90"
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
              <span className="relative text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] font-medium transition-colors">
                {t('boards.createNew')}
              </span>
            </button>
          )}

          {/* Existing boards - Premium cards */}
          {boards.map((board, index) => {
            const isSharedWithMe = board.ownerId !== user?.uid;
            
            return (
              <Link
                key={board.id}
                href={`/boards/${board.id}`}
                className="group relative rounded-2xl p-6 text-left transition-all duration-300 hover:-translate-y-1 min-h-[160px] overflow-hidden shadow-lg hover:shadow-xl"
                style={{ 
                  animationDelay: `${index * 50}ms`,
                  background: 'linear-gradient(135deg, var(--primary) 0%, #dc2626 100%)',
                }}
              >
                {/* Ambient glow */}
                <div className="absolute -inset-0.5 bg-gradient-to-br from-amber-400 to-rose-500 rounded-2xl opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-300"></div>
                
                {/* Glass overlay effect */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>
                
                {/* Shine effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                </div>
                
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl shadow-sm">
                      📋
                    </div>
                    <div className="flex items-center gap-2">
                      {isSharedWithMe && (
                        <span className="px-2.5 py-1 text-xs font-semibold bg-white/20 text-white rounded-full backdrop-blur-sm flex items-center gap-1.5 border border-white/10">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {t('boards.shared')}
                        </span>
                      )}
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                        <svg className="w-4 h-4 text-white/70 group-hover:text-white group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 tracking-tight">{board.name}</h3>
                  <p className="text-white/60 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {board.createdAt?.toDate().toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {boards.length === 0 && !isCreating && !showTemplatePicker && (
          <div className="mt-8">
            <EmptyState
              variant="boards"
              title={t('boards.noBoards')}
              description={t('boards.noBoardsDescription')}
              action={() => setShowTemplatePicker(true)}
              actionLabel={t('boards.createFirst')}
              size="lg"
            />
            <div className="flex items-center justify-center gap-4 mt-6">
              <ShortcutHint shortcut="?" label={t('header.keyboardShortcuts')} />
              <ReplayTourButton />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
