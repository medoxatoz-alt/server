'use client';

import React from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, Zap, Wifi, MonitorSmartphone, ShieldCheck, Star, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

const features = [
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Lightning Fast',
    desc: 'Instant load times even on slow mobile networks.',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
  },
  {
    icon: <Wifi className="w-5 h-5" />,
    title: 'Works Offline',
    desc: 'Browse your saved products without internet.',
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
  },
  {
    icon: <MonitorSmartphone className="w-5 h-5" />,
    title: 'Any Device',
    desc: 'Seamless on Mobile, Tablet & Desktop.',
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
  },
  {
    icon: <ShieldCheck className="w-5 h-5" />,
    title: 'Always Secure',
    desc: 'Auto-updates with the latest security patches.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
  },
  {
    icon: <Star className="w-5 h-5" />,
    title: 'Native Feel',
    desc: 'Full-screen experience — no browser chrome.',
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
  },
];

export default function DownloadAppPage() {
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[var(--bg-page)] pb-24">

        {/* ─── Hero Banner ─── */}
        <div className="bg-[var(--nav-bg)] border-b-2 border-[var(--gold-primary)]">
          <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center gap-10">

            {/* Left: Text */}
            <div className="flex-1 text-center md:text-left">
              <span className="inline-block bg-[var(--gold-primary)]/15 text-[var(--gold-primary)] text-xs font-bold px-4 py-1.5 rounded-full tracking-widest uppercase mb-5">
                Progressive Web App
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-4">
                MedoxAtoZ,<br />
                <span className="text-[var(--gold-primary)]">on your homescreen.</span>
              </h1>
              <p className="text-[#a0aab5] text-base leading-relaxed max-w-md mb-8">
                Install our app directly from your browser — no App Store, no downloads, no hassle.
                Get a full native experience on any device.
              </p>

              {isInstalled ? (
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-5 py-3 rounded-full font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5" /> App is installed on this device
                </div>
              ) : isInstallable ? (
                <button
                  onClick={promptInstall}
                  className="inline-flex items-center gap-2 bg-[var(--gold-primary)] hover:bg-[var(--gold-hover)] text-[#111] font-extrabold px-8 py-4 rounded-full text-base shadow-lg shadow-[var(--gold-primary)]/20 hover:shadow-[var(--gold-primary)]/40 transition-all duration-300 active:scale-95"
                >
                  <Download className="w-5 h-5" />
                  Install App — It's Free
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-[#a0aab5] px-5 py-3 rounded-full text-sm">
                  <Download className="w-4 h-4" />
                  Open in Chrome or Safari to install
                </div>
              )}
            </div>

            {/* Right: App Icon */}
            <div className="flex-shrink-0 flex flex-col items-center gap-3">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-[28px] bg-[var(--gold-primary)]/10 border-2 border-[var(--gold-primary)]/30 flex items-center justify-center shadow-2xl shadow-[var(--gold-primary)]/10">
                <img src="/logo.webp" alt="MedoxAtoZ App" className="w-24 h-24 md:w-32 md:h-32 object-contain rounded-2xl" />
              </div>
              <p className="text-[#a0aab5] text-xs font-medium tracking-wide">MedoxAtoZ v1.0</p>
            </div>
          </div>
        </div>

        {/* ─── Features Grid ─── */}
        <div className="max-w-6xl mx-auto px-6 py-14">
          <h2 className="text-2xl font-extrabold text-[var(--text-main)] mb-2 text-center">Why install the app?</h2>
          <p className="text-[var(--text-muted)] text-sm text-center mb-10">Everything you love about MedoxAtoZ, now faster and always at your fingertips.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon, title, desc, color, bg }) => (
              <div
                key={title}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-start gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className={`${bg} ${color} p-3 rounded-xl flex-shrink-0`}>{icon}</div>
                <div>
                  <p className="font-bold text-gray-800 mb-1">{title}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Manual Install Instructions (for Safari/non-Chrome) ─── */}
        {!isInstallable && !isInstalled && (
          <div className="max-w-2xl mx-auto px-6 pb-10">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-gray-800 mb-4 text-base">How to install manually:</h3>
              <div className="space-y-3">
                {[
                  { step: '1', os: 'Android / Chrome', instruction: 'Tap the ⋮ menu → "Add to Home Screen" or "Install App"' },
                  { step: '2', os: 'iPhone / Safari', instruction: 'Tap the ⎙ Share button → "Add to Home Screen"' },
                  { step: '3', os: 'Desktop Chrome', instruction: 'Click the ⬇ icon in the address bar → "Install"' },
                ].map(({ step, os, instruction }) => (
                  <div key={step} className="flex items-start gap-4">
                    <span className="w-7 h-7 rounded-full bg-[var(--gold-primary)]/15 text-[var(--gold-primary)] font-extrabold text-sm flex items-center justify-center flex-shrink-0">{step}</span>
                    <div>
                      <p className="font-semibold text-sm text-gray-700">{os}</p>
                      <p className="text-xs text-gray-500">{instruction}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Back to Home ─── */}
        <div className="text-center pb-4">
          <Link href="/" className="text-sm text-[var(--gold-primary)] hover:underline font-semibold">
            ← Back to Home
          </Link>
        </div>

      </main>
    </>
  );
}
