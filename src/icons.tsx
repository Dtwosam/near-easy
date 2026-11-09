import { useId } from 'react';
import type { ReactNode } from 'react';

export type IconName =
  | 'home'
  | 'wallet'
  | 'clock'
  | 'compass'
  | 'grid'
  | 'spark'
  | 'arrows'
  | 'layers'
  | 'settings'
  | 'bell'
  | 'send'
  | 'download'
  | 'copy'
  | 'check'
  | 'close'
  | 'chevron'
  | 'search'
  | 'arrow'
  | 'shield'
  | 'zap'
  | 'infinity'
  | 'external'
  | 'alert'
  | 'info'
  | 'user';

const paths: Record<IconName, ReactNode> = {
  home: <path d="M4 11.2 12 4l8 7.2V20a1 1 0 0 1-1 1h-4.8v-5.2H9.8V21H5a1 1 0 0 1-1-1z" />,
  wallet: (
    <>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H19a1 1 0 0 1 1 1v2" />
      <path d="M4 8.5V18a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-3" />
      <path d="M4 8.5h14.5A1.5 1.5 0 0 1 20 10v2.2a1.5 1.5 0 0 1-1.5 1.5H16a1.6 1.6 0 0 1 0-3.2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 2" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m14.8 9.2-1.3 4.3-4.3 1.3 1.3-4.3z" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
    </>
  ),
  spark: <path d="M12 3.2 13.5 9 19.2 10.6 13.5 12.2 12 18 10.5 12.2 4.8 10.6 10.5 9z" />,
  arrows: (
    <>
      <path d="M4 8h12" />
      <path d="M13 5l3 3-3 3" />
      <path d="M20 16H8" />
      <path d="M11 13l-3 3 3 3" />
    </>
  ),
  layers: (
    <>
      <ellipse cx="12" cy="7" rx="7" ry="2.6" />
      <path d="M5 7v4.2c0 1.5 3.1 2.7 7 2.7s7-1.2 7-2.7V7" />
      <path d="M5 11.6V16c0 1.5 3.1 2.7 7 2.7s7-1.2 7-2.7v-4.4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.8 6.6l1.6 1.6M17.6 15.8l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.8 17.4l1.6-1.6M17.6 8.2l1.6-1.6" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.2 1.5H4.8z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </>
  ),
  send: (
    <>
      <path d="M12 19V6" />
      <path d="M7 10.5 12 5.5l5 5" />
    </>
  ),
  download: (
    <>
      <path d="M12 5v13" />
      <path d="M7 13.5 12 18.5l5-5" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M6 15H5.5A1.5 1.5 0 0 1 4 13.5v-8A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5V6" />
    </>
  ),
  check: <path d="M5 12.5 9.2 17 19 7" />,
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  chevron: <path d="M14.5 6.5 9 12l5.5 5.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 3.5 3.5" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6.5 18.5 12 13 17.5" />
    </>
  ),
  shield: <path d="M12 3.5 19 6.2v5.4c0 4.2-2.8 6.8-7 8.4-4.2-1.6-7-4.2-7-8.4V6.2z" />,
  zap: <path d="M13 3 6 13h6l-1 8 7-10h-6z" />,
  infinity: <path d="M8 15c-3 0-4.5-2.2-4.5-3.8S5 7.5 8 7.5c2.2 0 3.2 1.6 4 3.2.8-1.6 1.8-3.2 4-3.2 3 0 4.5 2.1 4.5 3.7S19 15 16 15c-2.2 0-3.2-1.6-4-3.2-.8 1.6-1.8 3.2-4 3.2z" />,
  external: (
    <>
      <path d="M10 6H6.5A1.5 1.5 0 0 0 5 7.5v10A1.5 1.5 0 0 0 6.5 19h10a1.5 1.5 0 0 0 1.5-1.5V14" />
      <path d="M13 5h6v6" />
      <path d="M19 5l-8 8" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.5 20 19H4z" />
      <path d="M12 10v4" />
      <path d="M12 16.5h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="9" r="3.2" />
      <path d="M5.5 19.2a6.5 6.5 0 0 1 13 0" />
    </>
  ),
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function LogoMark({ size = 36 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="8" y1="6" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e7fff3" />
          <stop offset="0.42" stopColor="#35F5A0" />
          <stop offset="1" stopColor="#0f8f58" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} d="M7 40V8h8.4L30.2 26.8V8H41v32h-8.4L17.8 21.2V40H7z" />
    </svg>
  );
}

export function HeroArt() {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="hero-art" viewBox="0 0 220 180" role="img" aria-label="NEAR Easy mark">
      <defs>
        <linearGradient id={id} x1="40" y1="20" x2="180" y2="160" gradientUnits="userSpaceOnUse">
          <stop stopColor="#effff6" />
          <stop offset="0.4" stopColor="#35F5A0" />
          <stop offset="1" stopColor="#0c7d4c" />
        </linearGradient>
      </defs>
      <path d="M8 108c28-24 48-24 70 0s48 24 76 0 40-28 58-18" fill="none" stroke="#35F5A0" strokeOpacity="0.28" strokeWidth="1.4" />
      <path d="M8 126c32-20 52-18 78 4s50 18 78-2 36-22 52-12" fill="none" stroke="#35F5A0" strokeOpacity="0.16" strokeWidth="1.2" />
      <path fill={`url(#${id})`} d="M58 150V34h22l40 58V34h24v116h-22l-40-58v58H58z" />
    </svg>
  );
}
