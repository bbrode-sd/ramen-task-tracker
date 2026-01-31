import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[var(--background)] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-8 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Tomobodo
        </Link>
        
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-8">Privacy Policy</h1>
        
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <p className="text-slate-600 dark:text-slate-300">
            Last updated: January 30, 2026
          </p>
          
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">1. Information We Collect</h2>
            <p className="text-slate-600 dark:text-slate-300">
              When you sign in with Google, we collect your email address, display name, and profile picture to personalize your experience. We also store the boards, columns, and cards you create within the app.
            </p>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">2. How We Use Your Information</h2>
            <p className="text-slate-600 dark:text-slate-300">
              We use your information to:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
              <li>Provide and maintain the Tomobodo service</li>
              <li>Allow you to create and manage your boards</li>
              <li>Enable sharing and collaboration features</li>
              <li>Improve and personalize your experience</li>
            </ul>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">3. Data Storage</h2>
            <p className="text-slate-600 dark:text-slate-300">
              Your data is stored securely using Firebase services provided by Google. We implement appropriate security measures to protect your personal information.
            </p>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">4. Data Sharing</h2>
            <p className="text-slate-600 dark:text-slate-300">
              We do not sell, trade, or otherwise transfer your personal information to third parties. Your board data is only shared with users you explicitly invite to collaborate.
            </p>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">5. Your Rights</h2>
            <p className="text-slate-600 dark:text-slate-300">
              You can delete your account and associated data at any time. If you have questions about your data, please contact us.
            </p>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">6. Contact</h2>
            <p className="text-slate-600 dark:text-slate-300">
              If you have any questions about this Privacy Policy, please contact us at privacy@tomobodo.com.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
