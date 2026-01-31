import Link from 'next/link';

export default function TermsOfService() {
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
        
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-8">Terms of Service</h1>
        
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <p className="text-slate-600 dark:text-slate-300">
            Last updated: January 30, 2026
          </p>
          
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">1. Acceptance of Terms</h2>
            <p className="text-slate-600 dark:text-slate-300">
              By accessing and using Tomobodo, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
            </p>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">2. Description of Service</h2>
            <p className="text-slate-600 dark:text-slate-300">
              Tomobodo is a task management and kanban board application that allows users to organize tasks, create boards, and collaborate with others.
            </p>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">3. User Accounts</h2>
            <p className="text-slate-600 dark:text-slate-300">
              You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account. You must use a valid Google account to sign in.
            </p>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">4. User Content</h2>
            <p className="text-slate-600 dark:text-slate-300">
              You retain ownership of any content you create using Tomobodo. By using our service, you grant us a license to store and display your content as necessary to provide the service.
            </p>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">5. Acceptable Use</h2>
            <p className="text-slate-600 dark:text-slate-300">
              You agree not to use Tomobodo for any unlawful purpose or in any way that could damage, disable, or impair the service. You agree not to attempt to gain unauthorized access to any part of the service.
            </p>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">6. Limitation of Liability</h2>
            <p className="text-slate-600 dark:text-slate-300">
              Tomobodo is provided &quot;as is&quot; without warranties of any kind. We shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service.
            </p>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">7. Changes to Terms</h2>
            <p className="text-slate-600 dark:text-slate-300">
              We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.
            </p>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">8. Contact</h2>
            <p className="text-slate-600 dark:text-slate-300">
              If you have any questions about these Terms of Service, please contact us at support@tomobodo.com.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
