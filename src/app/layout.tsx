import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';
import ConditionalFooter from '@/components/ConditionalFooter';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MedoxAtoZ | Premium Medical Supplies',
  description: 'Premium medical and diagnostic supplies for clinics in India.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AuthProvider>
          <Toaster position="top-center" />
          {children}
          <ConditionalFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
