import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | MedoxAtoZ',
  description: 'Learn how MedoxAtoZ collects, uses, and protects your personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white pb-24">
      <div className="max-w-3xl mx-auto px-6 pt-16 sm:pt-24">
        
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors mb-8">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to MedoxAtoZ
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-3">Privacy Policy</h1>
          <p className="text-gray-500">Effective Date: June 2026</p>
        </div>

        <div className="prose prose-gray max-w-none text-gray-600">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">1. Information We Collect</h2>
            <p className="leading-relaxed mb-4">
              MedoxAtoZ (operated by SREE SAI LAKSHMI GANAPATHI TRADERS) collects personal information you provide when you register, place an order, or contact us. This includes your name, email address, phone number, and delivery address. We also collect usage data such as pages visited and actions taken within the platform.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2 mb-4">
              <li>To process and fulfill your orders</li>
              <li>To send order confirmations and shipping updates</li>
              <li>To improve our platform and personalize your experience</li>
              <li>To comply with legal obligations</li>
            </ul>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">3. Data Sharing</h2>
            <p className="leading-relaxed mb-4">
              We do not sell your personal data to third parties. We may share data with trusted service providers (payment gateways, shipping partners) strictly for order fulfillment. All third parties are contractually bound to protect your data.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">4. Cookies</h2>
            <p className="leading-relaxed mb-4">
              We use session cookies to maintain your login state and preferences. These cookies are essential for the platform to function. We do not use tracking or advertising cookies.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">5. Data Security</h2>
            <p className="leading-relaxed mb-4">
              We implement industry-standard security measures including HTTPS encryption, secure Firebase Authentication, and JWT-based session management to protect your personal data.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">6. Your Rights</h2>
            <p className="leading-relaxed mb-4">
              You may request access to, correction of, or deletion of your personal data at any time by contacting us at <a href="mailto:medoxatoz@gmail.com" className="text-blue-600 hover:underline">medoxatoz@gmail.com</a>.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">7. Contact</h2>
            <p className="leading-relaxed mb-4">
              For privacy-related queries, reach out to us at <a href="mailto:medoxatoz@gmail.com" className="text-blue-600 hover:underline">medoxatoz@gmail.com</a>.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-16 pt-8 flex gap-6 text-sm font-medium">
          <Link href="/terms" className="text-gray-500 hover:text-gray-900 transition-colors">Terms & Conditions</Link>
          <Link href="/refund-policy" className="text-gray-500 hover:text-gray-900 transition-colors">Refund Policy</Link>
          <Link href="/shipping-policy" className="text-gray-500 hover:text-gray-900 transition-colors">Shipping Policy</Link>
        </div>
      </div>
    </main>
  );
}
