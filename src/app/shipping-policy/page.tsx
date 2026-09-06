import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shipping Policy | MedoxAtoZ',
  description: 'Information regarding shipping rates, delivery times, and methods.',
};

export default function ShippingPolicyPage() {
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
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-3">Shipping Policy</h1>
          <p className="text-gray-500">Effective Date: June 2026</p>
        </div>

        <div className="prose prose-gray max-w-none text-gray-600">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">1. Dispatch Time</h2>
            <p className="leading-relaxed mb-4">
              All orders are processed and dispatched within 1 to 2 business days (excluding weekends and public holidays) after receiving your order confirmation email. You will receive another notification when your order has shipped.
            </p>
            <p className="leading-relaxed mb-4">
              In cases of high order volume or supply chain issues, shipments may be slightly delayed. If there will be a significant delay in the shipment of your order, we will contact you via email or telephone.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">2. Shipping Rates & Delivery Estimates</h2>
            <p className="leading-relaxed mb-4">
              Shipping charges for your order will be calculated and displayed at checkout. We partner with reliable courier services to ensure safe and timely delivery of medical supplies.
            </p>
            <ul className="list-disc pl-5 space-y-2 mb-4">
              <li><strong>Standard Delivery:</strong> 3-5 business days.</li>
              <li><strong>Express Delivery:</strong> 1-2 business days (available for select pin codes).</li>
              <li><strong>Cold Chain Delivery:</strong> Specialized expedited shipping for temperature-sensitive items.</li>
            </ul>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">3. Shipment Confirmation & Order Tracking</h2>
            <p className="leading-relaxed mb-4">
              You will receive a Shipment Confirmation email once your order has shipped, containing your tracking number(s). The tracking number will be active within 24 hours.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">4. Damages During Transit</h2>
            <p className="leading-relaxed mb-4">
              MedoxAtoZ ensures proper packaging for all medical supplies. However, if you receive a damaged order, please contact us immediately upon delivery. Save all packaging materials and damaged goods as photographic evidence is required to file a claim.
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">5. Delivery Restrictions</h2>
            <p className="leading-relaxed mb-4">
              We currently ship within India only. Some remote pin codes may experience longer delivery times or may not be serviceable by our logistics partners. If your address is unserviceable, our team will contact you to arrange an alternative or issue a refund.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-16 pt-8 flex gap-6 text-sm font-medium">
          <Link href="/privacy-policy" className="text-gray-500 hover:text-gray-900 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="text-gray-500 hover:text-gray-900 transition-colors">Terms & Conditions</Link>
          <Link href="/refund-policy" className="text-gray-500 hover:text-gray-900 transition-colors">Refund Policy</Link>
        </div>
      </div>
    </main>
  );
}
