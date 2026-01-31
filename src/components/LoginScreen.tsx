'use client';

import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';

export function LoginScreen() {
  const { signInWithGoogle, loading } = useAuth();
  const { t } = useLocale();

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

  const features = [
    { icon: '🎯', textKey: 'login.features.dragDrop', gradient: 'from-emerald-500 to-teal-600' },
    { icon: '🌏', textKey: 'login.features.bilingual', gradient: 'from-sky-500 to-blue-600' },
    { icon: '💬', textKey: 'login.features.comments', gradient: 'from-violet-500 to-purple-600' },
    { icon: '📦', textKey: 'login.features.archive', gradient: 'from-emerald-500 to-green-600' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative bg-[var(--background)]">
      {/* Premium gradient background */}
      <div className="fixed inset-0 overflow-hidden">
        {/* Base gradient - warm, sophisticated */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-teal-50 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"></div>
        
        {/* Animated gradient orbs */}
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-gradient-to-br from-emerald-200/40 to-teal-300/30 dark:from-emerald-900/20 dark:to-teal-800/15 rounded-full blur-3xl animate-float-slow"></div>
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-gradient-to-br from-blue-200/40 to-indigo-300/30 dark:from-blue-900/20 dark:to-indigo-800/15 rounded-full blur-3xl animate-float-delayed"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-teal-100/20 via-transparent to-transparent dark:from-teal-900/10 rounded-full"></div>
        
        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")'}}></div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]" style={{backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)', backgroundSize: '64px 64px'}}></div>
      </div>
      
      {/* Main card - glass morphism */}
      <div className="relative w-full max-w-lg mx-4 animate-fade-in">
        {/* Card glow effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-blue-500 rounded-[28px] opacity-20 blur-xl dark:opacity-30"></div>
        
        {/* Card container */}
        <div className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[24px] shadow-2xl border border-white/60 dark:border-slate-700/50 overflow-hidden">
          {/* Top accent gradient */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-blue-500"></div>
          
          {/* Content */}
          <div className="p-8 sm:p-10 lg:p-12">
            {/* Hero section */}
            <div className="text-center mb-10">
              {/* Tomobodo bowl illustration */}
              <div className="relative inline-block mb-8">
                {/* Animated glow behind emoji */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full blur-2xl opacity-30 dark:opacity-40 scale-150 animate-pulse-soft"></div>
                
                {/* Steam wisps */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
                  <div className="w-1.5 h-10 bg-gradient-to-t from-slate-400/50 via-slate-300/30 to-transparent dark:from-slate-500/40 dark:via-slate-400/20 rounded-full animate-steam-1"></div>
                  <div className="w-1 h-14 bg-gradient-to-t from-slate-400/40 via-slate-300/20 to-transparent dark:from-slate-500/30 dark:via-slate-400/15 rounded-full animate-steam-2"></div>
                  <div className="w-1.5 h-8 bg-gradient-to-t from-slate-400/50 via-slate-300/30 to-transparent dark:from-slate-500/40 dark:via-slate-400/20 rounded-full animate-steam-3"></div>
                </div>
                
                {/* Tomobodo icon */}
                <div className="relative block select-none animate-tomobodo-wobble hover:animate-tomobodo-spin cursor-default">
                  <Image 
                    src="/logo-white.png" 
                    alt="Tomobodo" 
                    width={120} 
                    height={120} 
                    className="drop-shadow-2xl"
                  />
                </div>
                
                {/* Reflection */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-20 h-4 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent rounded-full blur-sm"></div>
              </div>
              
              {/* Title */}
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-3 tracking-tight">
                {t('app.title')}
              </h1>
              
              {/* Tagline */}
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-blue-500 dark:from-emerald-400 dark:via-teal-400 dark:to-blue-400 mb-4">
                Organize • Track • Accomplish
              </p>
              
              {/* Description */}
              <p className="text-slate-500 dark:text-slate-400 text-base max-w-sm mx-auto leading-relaxed">
                {t('app.description')}
              </p>
            </div>

            {/* Sign in button */}
            <button
              onClick={signInWithGoogle}
              className="group w-full relative flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-semibold text-base overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
            >
              {/* Button shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 dark:via-black/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
              
              <svg className="w-5 h-5 relative transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="relative">{t('auth.signInWithGoogle')}</span>
              <svg className="w-4 h-4 relative transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            
            {/* Divider */}
            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
              <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">Features</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
            </div>

            {/* Features grid */}
            <div className="grid grid-cols-2 gap-3">
              {features.map((feature, i) => (
                <div 
                  key={i} 
                  className="group flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600 transition-all duration-200 hover:shadow-md cursor-default"
                  style={{animationDelay: `${i * 50}ms`}}
                >
                  <span className={`flex-shrink-0 w-11 h-11 flex items-center justify-center bg-gradient-to-br ${feature.gradient} rounded-xl text-lg shadow-md group-hover:scale-110 group-hover:shadow-lg transition-all duration-200`}>
                    {feature.icon}
                  </span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-snug">{t(feature.textKey)}</span>
                </div>
              ))}
            </div>
            
            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <span>{t('auth.secureAuth')}</span>
              </div>
              <div className="flex items-center justify-center gap-4 text-xs text-slate-400 dark:text-slate-500">
                <a href="/privacy" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  Privacy Policy
                </a>
                <span>•</span>
                <a href="/terms" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  Terms of Service
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Custom animations */}
      <style jsx>{`
        @keyframes steam-1 {
          0%, 100% { opacity: 0; transform: translateY(0) scaleX(1); }
          50% { opacity: 1; transform: translateY(-16px) scaleX(1.3); }
        }
        @keyframes steam-2 {
          0%, 100% { opacity: 0; transform: translateY(0) scaleX(1); }
          50% { opacity: 1; transform: translateY(-20px) scaleX(0.7); }
        }
        @keyframes steam-3 {
          0%, 100% { opacity: 0; transform: translateY(0) scaleX(1); }
          50% { opacity: 1; transform: translateY(-12px) scaleX(1.2); }
        }
        @keyframes tomobodo-wobble {
          0%, 100% { transform: rotate(-2deg) scale(1); }
          50% { transform: rotate(2deg) scale(1.02); }
        }
        @keyframes tomobodo-spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.1); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -30px) scale(1.05); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 30px) scale(1.05); }
        }
        .animate-steam-1 { animation: steam-1 3s ease-in-out infinite; }
        .animate-steam-2 { animation: steam-2 3.5s ease-in-out infinite 0.4s; }
        .animate-steam-3 { animation: steam-3 2.8s ease-in-out infinite 0.8s; }
        .animate-tomobodo-wobble { animation: tomobodo-wobble 4s ease-in-out infinite; }
        .animate-tomobodo-spin { animation: tomobodo-spin 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .animate-float-slow { animation: float-slow 12s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 15s ease-in-out infinite 3s; }
      `}</style>
    </div>
  );
}
