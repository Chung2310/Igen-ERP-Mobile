import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

type ModuleAppIconProps = {
  slug: string;
  size?: number;
};

type IconPalette = {
  from: string;
  to: string;
  accent: string;
};

const MODULE_PALETTES: Record<string, IconPalette> = {
  'ai-plans': { from: '#8E63FA', to: '#5E38E8', accent: '#6C42EE' },
  users: { from: '#28C4FF', to: '#0B8CE8', accent: '#1299EE' },
  hr: { from: '#FF8452', to: '#F25430', accent: '#F5603A' },
  'worker-management': { from: '#86DA1C', to: '#4BB60B', accent: '#5DC210' },
  'student-management': { from: '#1EC5B5', to: '#0A968D', accent: '#11A79B' },
  resources: { from: '#FFD22A', to: '#F4A307', accent: '#F7B010' },
  quotes: { from: '#22CA7E', to: '#0DA361', accent: '#14B06B' },
  inventory: { from: '#3E7EFF', to: '#1E54E8', accent: '#2860EE' },
};

const DEFAULT_PALETTE: IconPalette = {
  from: '#4B83FF',
  to: '#2458E8',
  accent: '#2D62EE',
};

function renderGlyph(slug: string, accent: string) {
  switch (slug) {
    case 'ai-plans':
      return (
        <>
          <Path
            d="M25.5 14C26.75 21.1 30.9 25.25 38 26.5C30.9 27.75 26.75 31.9 25.5 39C24.25 31.9 20.1 27.75 13 26.5C20.1 25.25 24.25 21.1 25.5 14Z"
            fill="#FFFFFF"
          />
          <Path
            d="M38.5 13.5C39.05 16.55 40.85 18.35 43.9 18.9C40.85 19.45 39.05 21.25 38.5 24.3C37.95 21.25 36.15 19.45 33.1 18.9C36.15 18.35 37.95 16.55 38.5 13.5Z"
            fill="#FFFFFF"
            fillOpacity={0.82}
          />
          <Circle cx="38.5" cy="36.5" r="2.3" fill="#FFFFFF" fillOpacity={0.68} />
        </>
      );

    case 'users':
      return (
        <>
          <Circle cx="36.2" cy="22.8" r="4.1" fill="#FFFFFF" fillOpacity={0.72} />
          <Path
            d="M32.4 37.8C32.7 33.2 35.5 30.2 39.2 30.2C42.1 30.2 44.3 32.1 45 35.2C45.3 36.6 44.3 37.8 42.9 37.8H32.4Z"
            fill="#FFFFFF"
            fillOpacity={0.72}
          />
          <Circle cx="23.5" cy="21.2" r="5.5" fill="#FFFFFF" />
          <Path
            d="M12.5 38.5C12.5 32.6 17.2 28.8 23.5 28.8C29.8 28.8 34.5 32.6 34.5 38.5C34.5 39.7 33.5 40.7 32.3 40.7H14.7C13.5 40.7 12.5 39.7 12.5 38.5Z"
            fill="#FFFFFF"
          />
        </>
      );

    case 'hr':
      return (
        <>
          <Rect x="23" y="12.5" width="10" height="5" rx="2.5" fill="#FFFFFF" fillOpacity={0.72} />
          <Rect x="13" y="16.5" width="30" height="26" rx="6" fill="#FFFFFF" />
          <Circle cx="22.5" cy="26.2" r="3.4" fill={accent} />
          <Path
            d="M17.2 36.2C17.4 33 19.6 31.1 22.5 31.1C25.4 31.1 27.6 33 27.8 36.2C27.9 36.9 27.3 37.5 26.6 37.5H18.4C17.7 37.5 17.1 36.9 17.2 36.2Z"
            fill={accent}
          />
          <Rect x="30.5" y="24.2" width="8.5" height="2.7" rx="1.35" fill={accent} />
          <Rect x="30.5" y="29.5" width="6.5" height="2.7" rx="1.35" fill={accent} fillOpacity={0.65} />
        </>
      );

    case 'worker-management':
      return (
        <>
          <Path
            d="M16.5 28.5V26.2C16.5 20.1 21.4 15.2 27.5 15.2H28.5C34.6 15.2 39.5 20.1 39.5 26.2V28.5H16.5Z"
            fill="#FFFFFF"
          />
          <Rect x="26.1" y="13.5" width="3.8" height="10.5" rx="1.9" fill="#FFFFFF" />
          <Rect x="13.2" y="27.2" width="29.6" height="4.1" rx="2.05" fill="#FFFFFF" />
          <Path
            d="M18.2 34.8C20.5 38.4 24 40.3 28 40.3C32 40.3 35.5 38.4 37.8 34.8"
            stroke="#FFFFFF"
            strokeOpacity={0.88}
            strokeWidth="3.6"
            strokeLinecap="round"
            fill="none"
          />
        </>
      );

    case 'student-management':
      return (
        <>
          <Path
            d="M28 15.5L11.5 23.2L28 30.9L44.5 23.2L28 15.5Z"
            fill="#FFFFFF"
          />
          <Path
            d="M18.5 28.3V34.6C18.5 37.4 22.8 39.8 28 39.8C33.2 39.8 37.5 37.4 37.5 34.6V28.3L28 32.8L18.5 28.3Z"
            fill="#FFFFFF"
            fillOpacity={0.84}
          />
          <Path
            d="M41.5 24.8V34.2"
            stroke="#FFFFFF"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <Circle cx="41.5" cy="35.6" r="2.2" fill="#FFFFFF" />
        </>
      );

    case 'resources':
      return (
        <>
          <Path
            d="M14 19.2C14 16.9 15.9 15 18.2 15H24.6C25.9 15 27.1 15.6 27.9 16.6L29.6 18.8H37.8C40.1 18.8 42 20.7 42 23V25.5H14V19.2Z"
            fill="#FFFFFF"
            fillOpacity={0.72}
          />
          <Rect x="13.5" y="21.2" width="29" height="19.8" rx="5.2" fill="#FFFFFF" />
          <Rect x="22" y="29.4" width="12" height="3" rx="1.5" fill={accent} fillOpacity={0.78} />
        </>
      );

    case 'quotes':
      return (
        <>
          <Path
            d="M16 17.2C16 14.6 18.1 12.5 20.7 12.5H31.2L39.5 20.8V38.8C39.5 41.4 37.4 43.5 34.8 43.5H20.7C18.1 43.5 16 41.4 16 38.8V17.2Z"
            fill="#FFFFFF"
          />
          <Path
            d="M31.2 12.5V18.3C31.2 19.7 32.3 20.8 33.7 20.8H39.5L31.2 12.5Z"
            fill={accent}
            fillOpacity={0.35}
          />
          <Rect x="20.8" y="24" width="13.4" height="2.7" rx="1.35" fill={accent} />
          <Rect x="20.8" y="29.5" width="9.5" height="2.7" rx="1.35" fill={accent} fillOpacity={0.72} />
          <Rect x="20.8" y="35" width="6.5" height="2.7" rx="1.35" fill={accent} fillOpacity={0.5} />
        </>
      );

    case 'inventory':
      return (
        <>
          <Path
            d="M25.8 14.8C27.1 13.7 28.9 13.7 30.2 14.8L41.8 24.4C42.6 25.1 43 26 43 27V37.6C43 39.5 41.5 41 39.6 41H35.2V31.4C35.2 29.8 33.9 28.5 32.3 28.5H23.7C22.1 28.5 20.8 29.8 20.8 31.4V41H16.4C14.5 41 13 39.5 13 37.6V27C13 26 13.4 25.1 14.2 24.4L25.8 14.8Z"
            fill="#FFFFFF"
          />
          <Rect x="23.6" y="31.4" width="8.8" height="9.6" rx="2.2" fill="#FFFFFF" fillOpacity={0.62} />
        </>
      );

    default:
      return (
        <>
          <Rect x="15.5" y="15.5" width="10.5" height="10.5" rx="3.2" fill="#FFFFFF" />
          <Rect x="30" y="15.5" width="10.5" height="10.5" rx="3.2" fill="#FFFFFF" fillOpacity={0.78} />
          <Rect x="15.5" y="30" width="10.5" height="10.5" rx="3.2" fill="#FFFFFF" fillOpacity={0.78} />
          <Rect x="30" y="30" width="10.5" height="10.5" rx="3.2" fill="#FFFFFF" />
        </>
      );
  }
}

export function ModuleAppIcon({ slug, size = 46 }: ModuleAppIconProps) {
  const palette = MODULE_PALETTES[slug] ?? DEFAULT_PALETTE;
  const safeId = slug.replace(/[^a-zA-Z0-9_-]/g, '_');
  const bgGradientId = `mod_bg_${safeId}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <Defs>
        <LinearGradient id={bgGradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={palette.from} />
          <Stop offset="100%" stopColor={palette.to} />
        </LinearGradient>
      </Defs>

      <Rect x="0" y="0" width="56" height="56" rx="15.5" fill={`url(#${bgGradientId})`} />

      {renderGlyph(slug, palette.accent)}
    </Svg>
  );
}
