import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy - Tomobodo",
  description: "Privacy Policy for Tomobodo - Bilingual Kanban board",
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors mb-6"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Tomobodo
          </Link>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Privacy Policy</h1>
          <p className="text-[var(--text-secondary)]">Last updated: January 30, 2026</p>
        </div>

        {/* Content */}
        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">1. Introduction</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              Welcome to Tomobodo (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy 
              and ensuring the security of your personal information. This Privacy Policy explains how we collect, 
              use, disclose, and safeguard your information when you use our bilingual Kanban board application.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">2. Information We Collect</h2>
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">Account Information</h3>
            <p className="text-[var(--text-secondary)] mb-4">
              When you create an account, we collect your email address and display name through our 
              authentication provider (Google Firebase Authentication).
            </p>
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">User Content</h3>
            <p className="text-[var(--text-secondary)] mb-4">
              We store the content you create within Tomobodo, including boards, columns, cards, comments, 
              and any attachments you upload.
            </p>
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">Usage Data</h3>
            <p className="text-[var(--text-secondary)] mb-4">
              We may collect information about how you interact with our application, including access times, 
              pages viewed, and the features you use.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2">
              <li>To provide, maintain, and improve our services</li>
              <li>To authenticate your identity and manage your account</li>
              <li>To sync your data across devices</li>
              <li>To provide translation features for bilingual support</li>
              <li>To respond to your comments, questions, and requests</li>
              <li>To send you technical notices and support messages</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">4. Data Storage and Security</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              Your data is stored securely using Google Firebase services, including Firestore for database 
              storage and Firebase Storage for file attachments. We implement appropriate technical and 
              organizational security measures to protect your personal information.
            </p>
            <p className="text-[var(--text-secondary)] mb-4">
              Tomobodo also supports offline functionality, which means some data may be cached locally on 
              your device for offline access.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">5. Data Sharing</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              We do not sell, trade, or rent your personal information to third parties. We may share your 
              information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2">
              <li>With your consent or at your direction</li>
              <li>With other users when you share a board with them</li>
              <li>With service providers who assist in operating our application (e.g., Google Firebase)</li>
              <li>To comply with legal obligations or protect our rights</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">6. Your Rights</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2">
              <li>Access and receive a copy of your personal data</li>
              <li>Correct inaccurate personal data</li>
              <li>Request deletion of your personal data</li>
              <li>Export your data using our export feature</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">7. Cookies and Local Storage</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              We use local storage to save your preferences (such as theme settings and language preferences) 
              and to enable offline functionality. This data remains on your device and is not transmitted to 
              our servers unless necessary for syncing.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">8. Children&apos;s Privacy</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              Tomobodo is not intended for children under 13 years of age. We do not knowingly collect 
              personal information from children under 13.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">9. Changes to This Policy</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              We may update this Privacy Policy from time to time. We will notify you of any changes by 
              posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">10. Contact Us</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              If you have any questions about this Privacy Policy, please contact us through the application.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-[var(--border)]">
          <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
            <Link href="/" className="hover:text-[var(--primary)] transition-colors">Home</Link>
            <Link href="/terms" className="hover:text-[var(--primary)] transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
