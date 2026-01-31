import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service - Tomobodo",
  description: "Terms of Service for Tomobodo - Bilingual Kanban board",
};

export default function TermsOfService() {
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
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Terms of Service</h1>
          <p className="text-[var(--text-secondary)]">Last updated: January 30, 2026</p>
        </div>

        {/* Content */}
        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">1. Acceptance of Terms</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              By accessing or using Tomobodo (&quot;the Service&quot;), you agree to be bound by these Terms of Service 
              (&quot;Terms&quot;). If you do not agree to these Terms, please do not use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">2. Description of Service</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              Tomobodo is a bilingual Kanban board application that allows users to create and manage boards, 
              columns, and cards with support for English and Japanese. The Service includes features such as:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2">
              <li>Creating and managing Kanban boards</li>
              <li>Organizing tasks with columns and cards</li>
              <li>Bilingual translation support</li>
              <li>Board sharing and collaboration</li>
              <li>Offline functionality</li>
              <li>File attachments and comments</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">3. User Accounts</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              To use certain features of the Service, you must create an account. You are responsible for:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use of your account</li>
            </ul>
            <p className="text-[var(--text-secondary)] mt-4">
              You must provide accurate and complete information when creating your account and keep this 
              information up to date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">4. User Content</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              You retain ownership of any content you create, upload, or share through the Service 
              (&quot;User Content&quot;). By using the Service, you grant us a limited license to store, display, 
              and process your User Content solely to provide the Service to you.
            </p>
            <p className="text-[var(--text-secondary)] mb-4">
              You are solely responsible for your User Content and agree not to upload content that:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2">
              <li>Violates any laws or regulations</li>
              <li>Infringes on intellectual property rights of others</li>
              <li>Contains malware, viruses, or harmful code</li>
              <li>Is defamatory, obscene, or otherwise objectionable</li>
              <li>Violates the privacy or rights of others</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">5. Acceptable Use</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              You agree to use the Service only for lawful purposes and in accordance with these Terms. 
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2">
              <li>Use the Service in any way that could damage, disable, or impair the Service</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Use automated systems to access the Service without permission</li>
              <li>Interfere with other users&apos; use of the Service</li>
              <li>Circumvent any security measures of the Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">6. Intellectual Property</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              The Service, including its design, features, and content (excluding User Content), is owned 
              by Tomobodo and is protected by copyright, trademark, and other intellectual property laws. 
              You may not copy, modify, distribute, or create derivative works based on the Service without 
              our express written permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">7. Shared Boards</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              When you share a board with other users, you grant them access to view and potentially modify 
              the content on that board, depending on the permissions you set. You are responsible for 
              managing access to your shared boards.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">8. Service Availability</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              We strive to provide reliable access to the Service, but we do not guarantee uninterrupted 
              or error-free operation. The Service may be temporarily unavailable for maintenance, updates, 
              or other reasons. We are not liable for any loss or damage resulting from service interruptions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">9. Disclaimer of Warranties</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER 
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, 
              FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">10. Limitation of Liability</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, TOMOBODO SHALL NOT BE LIABLE FOR ANY INDIRECT, 
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO 
              LOSS OF DATA, PROFITS, OR GOODWILL, ARISING OUT OF OR RELATING TO YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">11. Termination</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              We reserve the right to suspend or terminate your access to the Service at any time, 
              with or without cause and with or without notice. You may also terminate your account 
              at any time. Upon termination, your right to use the Service will immediately cease.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">12. Changes to Terms</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              We may modify these Terms at any time. We will notify you of any material changes by 
              posting the updated Terms on this page and updating the &quot;Last updated&quot; date. Your continued 
              use of the Service after such changes constitutes your acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">13. Governing Law</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              These Terms shall be governed by and construed in accordance with applicable laws, 
              without regard to conflict of law principles.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">14. Contact Us</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              If you have any questions about these Terms of Service, please contact us through the application.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-[var(--border)]">
          <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
            <Link href="/" className="hover:text-[var(--primary)] transition-colors">Home</Link>
            <Link href="/privacy" className="hover:text-[var(--primary)] transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
