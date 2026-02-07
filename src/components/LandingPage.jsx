// src/components/LandingPage.jsx
import React from 'react';
import { Calendar, Users, Clock, ArrowRight } from 'lucide-react';

export default function LandingPage({ onEnter }) {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col">
      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        {/* Icon */}
        <div className="mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/25">
            <Calendar className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-5xl md:text-6xl font-semibold text-center tracking-tight mb-4">
            Fellow<span className="text-red-400 italic">Shift</span>
        </h1>

        {/* Tagline */}
        <p className="text-lg md:text-xl text-gray-400 text-center max-w-md mb-4">
          Schedule optimization made simple.
        </p>

        {/* CTA Button */}
        <button
          onClick={onEnter}
          className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-red-500 to-rose-600 text-white font-medium rounded-lg hover:from-red-600 hover:to-rose-700 transition-all duration-200"
        >
          Enter Scheduler
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-16 text-sm text-gray-400">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <span>⚡</span>
                Auto-Balanced
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <span>✅</span>
                ACGME Compliant
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <span>🧠</span>
                Zero Headaches
            </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div>
            © 2026 IMTechEd
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">By Austin Straley, DO</span>
          </div>
        </div>
      </footer>
    </div>
  );
}