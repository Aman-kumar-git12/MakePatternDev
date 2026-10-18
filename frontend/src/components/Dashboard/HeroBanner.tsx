import React from 'react';
import { TrendingUp, Trophy } from 'lucide-react';

interface HeroBannerProps {
  userName?: string;
  onPracticeClick: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  userName = 'Aman',
  onPracticeClick,
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-900/30 bg-gradient-to-r from-[#0B152B] via-[#0D1E3D] to-[#0A162E] p-6 sm:p-7 shadow-2xl h-full flex flex-col justify-between">
      {/* Mountain & Summit Flag Vector Background matching screenshot */}
      <div className="absolute right-0 bottom-0 top-0 w-3/5 pointer-events-none opacity-85 hidden sm:block">
        <svg
          viewBox="0 0 500 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full object-cover object-right-bottom"
        >
          <defs>
            <linearGradient id="mountGrad1" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0F172A" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="mountGrad2" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#0B1120" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="mountGrad3" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#020617" stopOpacity="1" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Stars */}
          <circle cx="100" cy="35" r="1.5" fill="#93C5FD" opacity="0.85" />
          <circle cx="190" cy="22" r="1.2" fill="#E0E7FF" opacity="0.9" />
          <circle cx="310" cy="55" r="1.8" fill="#FFFFFF" opacity="0.95" />
          <circle cx="410" cy="30" r="1.5" fill="#60A5FA" opacity="0.8" />
          <circle cx="460" cy="70" r="1.2" fill="#E0E7FF" opacity="0.85" />
          <circle cx="260" cy="75" r="1.2" fill="#FFFFFF" opacity="0.75" />

          {/* Clouds */}
          <ellipse cx="230" cy="65" rx="35" ry="12" fill="#1E3A8A" opacity="0.25" />
          <ellipse cx="370" cy="85" rx="40" ry="14" fill="#1E3A8A" opacity="0.2" />

          {/* Distant Mountain Range */}
          <path d="M40 240 L150 125 L260 240 Z" fill="url(#mountGrad1)" />
          <path d="M160 240 L290 95 L420 240 Z" fill="url(#mountGrad2)" />

          {/* Summit Mountain Peak with Flag */}
          <path d="M250 240 L370 42 L490 240 Z" fill="url(#mountGrad3)" />

          {/* Summit Glow Aura */}
          <circle cx="370" cy="40" r="20" fill="#818CF8" opacity="0.35" filter="url(#glow)" />

          {/* Flag on Peak */}
          <line x1="370" y1="44" x2="370" y2="18" stroke="#E2E8F0" strokeWidth="2.5" />
          <path d="M370 18 L395 25 L370 32 Z" fill="#A855F7" filter="url(#glow)" />
          <path d="M370 18 L395 25 L370 32 Z" fill="#C084FC" />
        </svg>
      </div>

      <div className="relative z-10 max-w-md">
        <span className="text-xs font-medium text-slate-300 mb-1.5 block">
          Welcome back, {userName}!
        </span>

        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2 leading-tight">
          Better Practice. <br />
          <span className="bg-gradient-to-r from-[#38bdf8] via-[#60a5fa] to-[#c084fc] bg-clip-text text-transparent font-black drop-shadow-[0_0_20px_rgba(56,189,248,0.4)]">
            Stronger You.
          </span>
        </h2>

        <p className="text-xs text-slate-300 mb-5 font-normal leading-relaxed">
          Track your DSA journey, solve problems, build your skills, and get closer to your goals.
        </p>
      </div>

      {/* Action pills matching screenshot */}
      <div className="relative z-10 flex flex-wrap items-center gap-2 pt-2">
        <button
          onClick={onPracticeClick}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#0E2045]/80 hover:bg-[#152e63] border border-blue-500/40 text-blue-200 hover:text-white text-xs font-medium backdrop-blur transition"
        >
          <span className="font-mono font-bold text-blue-400 text-xs">&lt;/&gt;</span>
          <span>Practice</span>
        </button>

        <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#1E1B4B]/80 border border-indigo-500/40 text-indigo-200 text-xs font-medium backdrop-blur">
          <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
          <span>Improve</span>
        </div>

        <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#2D2109]/80 border border-amber-500/40 text-amber-200 text-xs font-medium backdrop-blur">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>Achieve</span>
        </div>
      </div>
    </div>
  );
};
