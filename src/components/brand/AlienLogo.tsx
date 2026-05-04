import { cn } from '@/lib/utils';

interface AlienLogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

export function AlienLogo({ size = 48, className, glow = false }: AlienLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(glow && 'drop-shadow-[0_0_24px_rgba(20,184,166,0.35)]', className)}
      aria-hidden
    >
      <defs>
        <radialGradient id="alien-head" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="65%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#0f766e" />
        </radialGradient>
        <linearGradient id="alien-eye" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0a0a0a" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </linearGradient>
      </defs>
      <path
        d="M32 6c-11 0-19 8-19 20 0 7 2.5 12.5 6 17.5 2.8 4 4 7 4 10 0 2.8 1.7 4.5 4 4.5h10c2.3 0 4-1.7 4-4.5 0-3 1.2-6 4-10 3.5-5 6-10.5 6-17.5 0-12-8-20-19-20Z"
        fill="url(#alien-head)"
      />
      <path
        d="M20 30c0-4 3-7 6.5-7 2.5 0 4.5 1.5 4.5 4 0 5-3 9-7 9-2.5 0-4-2-4-6Z"
        fill="url(#alien-eye)"
      />
      <path
        d="M44 30c0-4-3-7-6.5-7-2.5 0-4.5 1.5-4.5 4 0 5 3 9 7 9 2.5 0 4-2 4-6Z"
        fill="url(#alien-eye)"
      />
      <ellipse cx="24" cy="26" rx="1.2" ry="2" fill="#ffffff" opacity="0.85" />
      <ellipse cx="40" cy="26" rx="1.2" ry="2" fill="#ffffff" opacity="0.85" />
    </svg>
  );
}
