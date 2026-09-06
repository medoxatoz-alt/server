'use client';

import { usePathname } from 'next/navigation';
import Footer from '@/components/Footer';

// Footer is shown ONLY on the home page
const FOOTER_ROUTES = ['/'];

export default function ConditionalFooter() {
  const pathname = usePathname();
  const show = FOOTER_ROUTES.includes(pathname);
  if (!show) return null;
  return <Footer />;
}
