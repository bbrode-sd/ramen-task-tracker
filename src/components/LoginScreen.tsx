'use client';

import { useAuth } from '@/contexts/AuthContext';

export function LoginScreen() {
  const { signInWithGoogle, loading } = useAuth();

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative bg-white rounded-3xl shadow-2xl p-8 sm:p-10 max-w-md w-full mx-4 border border-white/20">
        {/* Decorative top accent */}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-20 h-1 bg-gradient-to-r from-orange-400 to-red-500 rounded-full"></div>
        
        <div className="text-center mb-8">
          <div className="inline-block animate-float">
            <span className="text-7xl block mb-4 drop-shadow-lg">🍜</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
            Ramen Task Tracker
          </h1>
          <p className="text-gray-500 text-base leading-relaxed">
            Bilingual Kanban board with<br className="sm:hidden" /> English/Japanese support
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-white border-2 border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-gray-300 hover:shadow-lg active:scale-[0.98] transition-all duration-200 group"
          >
            <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-gray-700 font-semibold">Sign in with Google</span>
          </button>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-100">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Features</h3>
          <ul className="space-y-3">
            {[
              { icon: '🎯', text: 'Drag & drop cards between columns' },
              { icon: '🌏', text: 'Bilingual cards (English ↔ Japanese)' },
              { icon: '💬', text: 'Comments, images & attachments' },
              { icon: '📦', text: 'Archive cards and columns' },
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-gray-600">
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-orange-50 rounded-lg text-sm">
                  {feature.icon}
                </span>
                <span className="text-sm">{feature.text}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            Secure authentication powered by Firebase
          </p>
        </div>
      </div>
    </div>
  );
}
