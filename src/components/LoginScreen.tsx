'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';

export function LoginScreen() {
  const { signInWithGoogle, loading } = useAuth();
  const { t } = useLocale();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 dark:from-amber-600 dark:via-orange-700 dark:to-red-800">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/30 border-t-white"></div>
          <span className="absolute inset-0 flex items-center justify-center text-3xl animate-bounce">🍜</span>
        </div>
      </div>
    );
  }

  const features = [
    { icon: '🎯', textKey: 'login.features.dragDrop', color: 'from-orange-500 to-amber-500' },
    { icon: '🌏', textKey: 'login.features.bilingual', color: 'from-blue-500 to-cyan-500' },
    { icon: '💬', textKey: 'login.features.comments', color: 'from-purple-500 to-pink-500' },
    { icon: '📦', textKey: 'login.features.archive', color: 'from-emerald-500 to-teal-500' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 dark:from-amber-600 dark:via-orange-700 dark:to-red-900">
        {/* Animated mesh gradient overlay */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,255,255,0.3),transparent)]"></div>
        </div>
        
        {/* Floating orbs */}
        <div className="absolute top-20 left-[10%] w-72 h-72 bg-yellow-300/20 rounded-full blur-3xl animate-float-slow"></div>
        <div className="absolute bottom-20 right-[10%] w-96 h-96 bg-red-400/20 rounded-full blur-3xl animate-float-delayed"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-300/10 rounded-full blur-3xl"></div>
        
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRWMjhIMjR2MmgxMnptLTE4LTJ2MkgxNnYtMmgyem0wLTR2Mkg2di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')]"></div>
      </div>
      
      {/* Main card */}
      <div className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 sm:p-12 max-w-md w-full mx-4 border border-white/40 dark:border-white/10">
        {/* Decorative top gradient bar */}
        <div className="absolute -top-px left-8 right-8 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 rounded-full"></div>
        
        {/* Glow effect behind card */}
        <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 rounded-3xl opacity-20 blur-xl -z-10"></div>
        
        {/* Header section */}
        <div className="text-center mb-10">
          {/* Ramen bowl with steam animation */}
          <div className="relative inline-block mb-6">
            {/* Steam wisps */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-1">
              <div className="w-1 h-8 bg-gradient-to-t from-gray-400/40 to-transparent rounded-full animate-steam-1 dark:from-gray-300/30"></div>
              <div className="w-1 h-10 bg-gradient-to-t from-gray-400/30 to-transparent rounded-full animate-steam-2 dark:from-gray-300/20"></div>
              <div className="w-1 h-6 bg-gradient-to-t from-gray-400/40 to-transparent rounded-full animate-steam-3 dark:from-gray-300/30"></div>
            </div>
            
            {/* Ramen emoji with wobble */}
            <span className="text-7xl sm:text-8xl block drop-shadow-2xl animate-ramen-wobble cursor-default select-none hover:animate-ramen-spin">
              🍜
            </span>
            
            {/* Subtle reflection */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-3 bg-gradient-to-r from-transparent via-orange-400/30 to-transparent rounded-full blur-sm"></div>
          </div>
          
          {/* App title */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-3 tracking-tight">
            {t('app.title')}
          </h1>
          
          {/* Tagline */}
          <p className="text-orange-600 dark:text-orange-400 font-semibold text-sm uppercase tracking-widest mb-3">
            Organize • Track • Accomplish
          </p>
          
          {/* Description */}
          <p className="text-gray-500 dark:text-gray-400 text-base leading-relaxed max-w-xs mx-auto">
            {t('app.description')}
          </p>
        </div>

        {/* Sign in button */}
        <div className="space-y-4">
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-gray-900 to-gray-800 dark:from-white dark:to-gray-100 text-white dark:text-gray-900 rounded-2xl hover:from-gray-800 hover:to-gray-700 dark:hover:from-gray-100 dark:hover:to-gray-200 active:scale-[0.98] transition-all duration-200 shadow-lg hover:shadow-xl group font-semibold text-base"
          >
            <svg className="w-5 h-5 transition-transform group-hover:scale-110 group-hover:rotate-3" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                className="dark:fill-gray-900"
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
            <span>{t('auth.signInWithGoogle')}</span>
            <svg className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          
          {/* Divider with text */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent"></div>
            <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">Features</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent"></div>
          </div>
        </div>

        {/* Features list */}
        <div className="grid grid-cols-2 gap-3">
          {features.map((feature, i) => (
            <div 
              key={i} 
              className="group flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 cursor-default"
            >
              <span className={`flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gradient-to-br ${feature.color} rounded-xl text-lg shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                {feature.icon}
              </span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-tight">{t(feature.textKey)}</span>
            </div>
          ))}
        </div>
        
        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <span>{t('auth.secureAuth')}</span>
          </div>
        </div>
      </div>
      
      {/* Custom animations */}
      <style jsx>{`
        @keyframes steam-1 {
          0%, 100% { opacity: 0; transform: translateY(0) scaleX(1); }
          50% { opacity: 1; transform: translateY(-12px) scaleX(1.2); }
        }
        @keyframes steam-2 {
          0%, 100% { opacity: 0; transform: translateY(0) scaleX(1); }
          50% { opacity: 1; transform: translateY(-16px) scaleX(0.8); }
        }
        @keyframes steam-3 {
          0%, 100% { opacity: 0; transform: translateY(0) scaleX(1); }
          50% { opacity: 1; transform: translateY(-10px) scaleX(1.1); }
        }
        @keyframes ramen-wobble {
          0%, 100% { transform: rotate(-3deg) scale(1); }
          50% { transform: rotate(3deg) scale(1.02); }
        }
        @keyframes ramen-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-20px) translateX(10px); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(20px) translateX(-10px); }
        }
        .animate-steam-1 { animation: steam-1 2s ease-in-out infinite; }
        .animate-steam-2 { animation: steam-2 2.5s ease-in-out infinite 0.3s; }
        .animate-steam-3 { animation: steam-3 2.2s ease-in-out infinite 0.6s; }
        .animate-ramen-wobble { animation: ramen-wobble 3s ease-in-out infinite; }
        .animate-ramen-spin { animation: ramen-spin 0.5s ease-in-out; }
        .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 10s ease-in-out infinite 2s; }
      `}</style>
    </div>
  );
}
