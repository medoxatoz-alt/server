import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Return & Refund Policy | MedoxAtoZ',
  description: 'Learn about our return and refund policies for medical supplies.',
};

export default function RefundPolicyPage() {
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
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-3">Return & Refund Policy</h1>
          <p className="text-gray-500">Effective Date: June 2026</p>
        </div>

        <div className="prose prose-gray max-w-none text-gray-600">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">1. Returns Eligibility</h2>
            <p className="leading-relaxed mb-4">
              Due to the sensitive nature of medical and diagnostic supplies, returns are only accepted if:
            </p>
            <ul className="list-disc pl-5 space-y-2 mb-4">
              <li>The product received is defective or damaged during transit.</li>
              <li>The wrong product was delivered.</li>
              <li>The product is near expiration (if specifically guaranteed otherwise at the time of purchase).</li>
            </ul>
            <p className="leading-relaxed mb-4">
              Return requests must be initiated within 48 hours of delivery. Products must be unused, in their original packaging, and with all seals intact.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">2. Non-Returnable Items</h2>
            <p className="leading-relaxed mb-4">
              The following items cannot be returned under any circumstances:
            </p>
            <ul className="list-disc pl-5 space-y-2 mb-4">
              <li>Opened or used consumables (e.g., reagents, test kits, syringes).</li>
              <li>Cold-chain products (items requiring refrigeration).</li>
              <li>Custom orders or specialized equipment specifically procured for you.</li>
            </ul>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">3. Refund Process</h2>
            <p className="leading-relaxed mb-4">
              Once a return is approved and the item is received back at our warehouse, it will be inspected. If the condition meets our return criteria, a refund will be initiated to your original method of payment.
            </p>
            <p className="leading-relaxed mb-4">
              Refunds typically take 5-7 business days to reflect in your account, depending on your bank or payment provider.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">4. Cancellations</h2>
            <p className="leading-relaxed mb-4">
              Orders can be canceled for a full refund before they are dispatched. Once an order has been shipped, it cannot be canceled, and our standard Return Policy applies.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">5. Initiating a Return</h2>
            <p className="leading-relaxed mb-4">
              To initiate a return or report an issue with your order, please contact our support team immediately at <a href="mailto:medoxatoz@gmail.com" className="text-blue-600 hover:underline">medoxatoz@gmail.com</a> with your order number and photographic evidence of the issue.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-16 pt-8 flex gap-6 text-sm font-medium">
          <Link href="/privacy-policy" className="text-gray-500 hover:text-gray-900 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="text-gray-500 hover:text-gray-900 transition-colors">Terms & Conditions</Link>
          <Link href="/shipping-policy" className="text-gray-500 hover:text-gray-900 transition-colors">Shipping Policy</Link>
        </div>
      </div>
    </main>
  );
}
