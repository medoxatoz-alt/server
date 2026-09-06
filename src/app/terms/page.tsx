import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms & Conditions | MedoxAtoZ',
  description: 'Read the terms and conditions governing your use of MedoxAtoZ.',
};

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-3">Terms & Conditions</h1>
          <p className="text-gray-500">Effective Date: June 2026</p>
        </div>

        <div className="prose prose-gray max-w-none text-gray-600">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">1. Acceptance of Terms</h2>
            <p className="leading-relaxed mb-4">
              By accessing or using MedoxAtoZ (operated by SREE SAI LAKSHMI GANAPATHI TRADERS), you agree to be bound by these Terms & Conditions. If you do not agree, please discontinue use of the platform immediately.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">2. Use of Platform</h2>
            <p className="leading-relaxed mb-4">
              MedoxAtoZ is a B2B marketplace for medical supplies intended for clinics, hospitals, and licensed medical professionals in India. By using this platform, you confirm that you are a legitimate medical professional or business entity.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">3. Account Responsibility</h2>
            <p className="leading-relaxed mb-4">
              You are responsible for maintaining the confidentiality of your login credentials. Any activity carried out under your account is your responsibility. Report unauthorized access immediately to <a href="mailto:medoxatoz@gmail.com" className="text-blue-600 hover:underline">medoxatoz@gmail.com</a>.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">4. Product Listings</h2>
            <p className="leading-relaxed mb-4">
              Vendors are responsible for the accuracy of their product descriptions, pricing, and availability. MedoxAtoZ reserves the right to remove any listing that violates platform policies or applicable law.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">5. Order & Payment</h2>
            <p className="leading-relaxed mb-4">
              All prices are listed in Indian Rupees (₹). Orders are subject to acceptance and availability. MedoxAtoZ reserves the right to cancel any order at its discretion.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">6. Intellectual Property</h2>
            <p className="leading-relaxed mb-4">
              All content on this platform — including logos, design, and product images — is the property of MedoxAtoZ or its respective vendors. Unauthorized use is strictly prohibited.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">7. Limitation of Liability</h2>
            <p className="leading-relaxed mb-4">
              MedoxAtoZ is not liable for any indirect, incidental, or consequential damages arising from the use of this platform or products purchased through it.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">8. Changes to Terms</h2>
            <p className="leading-relaxed mb-4">
              We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-16 pt-8 flex gap-6 text-sm font-medium">
          <Link href="/privacy-policy" className="text-gray-500 hover:text-gray-900 transition-colors">Privacy Policy</Link>
          <Link href="/refund-policy" className="text-gray-500 hover:text-gray-900 transition-colors">Refund Policy</Link>
          <Link href="/shipping-policy" className="text-gray-500 hover:text-gray-900 transition-colors">Shipping Policy</Link>
        </div>
      </div>
    </main>
  );
}
