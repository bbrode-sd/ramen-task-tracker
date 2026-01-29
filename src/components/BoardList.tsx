'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useLocale } from '@/contexts/LocaleContext';
import { Board, BoardTemplate } from '@/types';
import { subscribeToBoards, createBoard, getBoardTemplates, createBoardFromTemplate, BUILT_IN_BOARD_TEMPLATES } from '@/lib/firestore';
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

    const unsubscribe = subscribeToBoards(
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

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-64px)] p-4">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">{t('boards.errorLoading')}</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-sm"
            >
              {t('common.tryAgain')}
            </button>
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
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 tracking-tight">{t('boards.title')}</h2>
          <p className="text-gray-500">{t('boards.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Create new board card */}
          {showTemplatePicker ? (
            <div className="bg-white rounded-2xl shadow-lg p-5 border-2 border-purple-400 ring-4 ring-purple-100 col-span-1 sm:col-span-2 md:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{t('boards.templates.title')}</h3>
                    <p className="text-xs text-slate-400">{t('boards.templates.subtitle')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTemplatePicker(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="p-4 rounded-xl border-2 border-slate-200 hover:border-orange-400 hover:bg-orange-50 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-orange-100 flex items-center justify-center mb-3 transition-colors">
                      <svg className="w-5 h-5 text-slate-400 group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 group-hover:text-orange-600 transition-colors">{t('boards.templates.blank')}</p>
                    <p className="text-xs text-slate-400 mt-1">{t('boards.templates.blankDescription')}</p>
                  </button>
                  
                  {/* Built-in and user templates */}
                  {boardTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-left group ${
                        template.isBuiltIn 
                          ? 'border-slate-200 hover:border-blue-400 hover:bg-blue-50' 
                          : 'border-slate-200 hover:border-purple-400 hover:bg-purple-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                        template.isBuiltIn 
                          ? 'bg-blue-50 group-hover:bg-blue-100' 
                          : 'bg-purple-50 group-hover:bg-purple-100'
                      }`}>
                        {template.isBuiltIn ? (
                          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-semibold transition-colors ${
                          template.isBuiltIn 
                            ? 'text-slate-700 group-hover:text-blue-600' 
                            : 'text-slate-700 group-hover:text-purple-600'
                        }`}>{template.name}</p>
                        {template.isBuiltIn && (
                          <span className="text-[10px] font-medium text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded">{t('boards.templates.builtIn')}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">{template.description}</p>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {template.columns.slice(0, 3).map((col, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{col.name}</span>
                        ))}
                        {template.columns.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded">+{template.columns.length - 3}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : isCreating ? (
            <div className="bg-white rounded-2xl shadow-lg p-5 border-2 border-orange-400 ring-4 ring-orange-100">
              {selectedTemplate && getTemplateInfo(selectedTemplate) && (
                <div className="mb-4 p-3 bg-purple-50 rounded-xl border border-purple-100">
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    <span className="font-medium text-purple-700">Using: {getTemplateInfo(selectedTemplate)?.name}</span>
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {getTemplateInfo(selectedTemplate)?.columns.map((col, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">{col.name}</span>
                    ))}
                  </div>
                </div>
              )}
              <input
                type="text"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder={t('boards.boardName')}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-4 text-gray-900 placeholder:text-slate-500"
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
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-xl hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  {isCreatingBoard ? t('boards.creating') : t('boards.createBoard')}
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewBoardName('');
                    setSelectedTemplate(null);
                  }}
                  className="px-4 py-2.5 bg-gray-100 text-gray-600 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowTemplatePicker(true)}
              data-onboarding="create-board"
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
                {t('boards.createNew')}
              </span>
            </button>
          )}

          {/* Existing boards */}
          {boards.map((board, index) => {
            const isSharedWithMe = board.ownerId !== user?.uid;
            
            return (
              <Link
                key={board.id}
                href={`/boards/${board.id}`}
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
                    <div className="flex items-center gap-2">
                      {isSharedWithMe && (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-white/20 text-white rounded-full backdrop-blur-sm flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {t('boards.shared')}
                        </span>
                      )}
                      <svg className="w-5 h-5 text-white/50 group-hover:text-white/80 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">{board.name}</h3>
                  <p className="text-white/70 text-sm flex items-center gap-1.5">
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
              <ShortcutHint shortcut="?" label="Keyboard shortcuts" />
              <ReplayTourButton />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
