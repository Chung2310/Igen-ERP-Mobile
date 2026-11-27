import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { NotificationType } from '@/features/notifications/notificationsApi';

type NotificationTypeIconProps = {
  type: NotificationType;
  size?: number;
};

type IconPalette = {
  from: string;
  to: string;
  accent: string;
};

const NOTIFICATION_PALETTES: Record<NotificationType, IconPalette> = {
  kho: { from: '#FFB732', to: '#EA7A0C', accent: '#F08814' },
  task: { from: '#3E84FF', to: '#1E54E8', accent: '#2860EE' },
  training: { from: '#8E63FA', to: '#5E38E8', accent: '#6C42EE' },
  'he-thong': { from: '#24C983', to: '#0C9D61', accent: '#14AD6D' },
};

function renderGlyph(type: NotificationType, accent: string) {
  switch (type) {
    case 'kho':
      return (
        <>
          {/* Warehouse / parcel box matching ModuleAppIcons style */}
          <Path
            d="M25.8 14.8C27.1 13.7 28.9 13.7 30.2 14.8L41.8 24.4C42.6 25.1 43 26 43 27V37.6C43 39.5 41.5 41 39.6 41H35.2V31.4C35.2 29.8 33.9 28.5 32.3 28.5H23.7C22.1 28.5 20.8 29.8 20.8 31.4V41H16.4C14.5 41 13 39.5 13 37.6V27C13 26 13.4 25.1 14.2 24.4L25.8 14.8Z"
            fill="#FFFFFF"
          />
          <Rect x="23.6" y="31.4" width="8.8" height="9.6" rx="2.2" fill="#FFFFFF" fillOpacity={0.62} />
        </>
      );

    case 'task':
      return (
        <>
          {/* Clipboard with check & task lines */}
          <Rect x="22" y="11.5" width="12" height="5.5" rx="2.75" fill="#FFFFFF" fillOpacity={0.78} />
          <Rect x="14.5" y="15.5" width="27" height="28" rx="5.5" fill="#FFFFFF" />
          <Path
            d="M20 26.2L22.6 28.8L27.4 23.6"
            stroke={accent}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Rect x="30.2" y="25" width="7.2" height="2.6" rx="1.3" fill={accent} fillOpacity={0.75} />
          <Rect x="20" y="33.5" width="16.5" height="2.6" rx="1.3" fill={accent} fillOpacity={0.55} />
        </>
      );

    case 'training':
      return (
        <>
          {/* Graduation cap matching student-management in ModuleAppIcons */}
          <Path d="M28 15.5L11.5 23.2L28 30.9L44.5 23.2L28 15.5Z" fill="#FFFFFF" />
          <Path
            d="M18.5 28.3V34.6C18.5 37.4 22.8 39.8 28 39.8C33.2 39.8 37.5 37.4 37.5 34.6V28.3L28 32.8L18.5 28.3Z"
            fill="#FFFFFF"
            fillOpacity={0.84}
          />
          <Path d="M41.5 24.8V34.2" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
          <Circle cx="41.5" cy="35.6" r="2.2" fill="#FFFFFF" />
        </>
      );

    case 'he-thong':
    default:
      return (
        <>
          {/* Crisp notification bell with subtle clapper & ring accent */}
          <Circle cx="28" cy="14.2" r="2.4" fill="#FFFFFF" fillOpacity={0.82} />
          <Path
            d="M17.4 27.6C17.4 21.3 21.9 16.4 28 16.4C34.1 16.4 38.6 21.3 38.6 27.6V31.4C38.6 33 39.4 34.3 40.7 35C41.4 35.4 41.7 36.2 41.5 37C41.3 37.7 40.6 38.2 39.8 38.2H16.2C15.4 38.2 14.7 37.7 14.5 37C14.3 36.2 14.6 35.4 15.3 35C16.6 34.3 17.4 33 17.4 31.4V27.6Z"
            fill="#FFFFFF"
          />
          <Path
            d="M24.2 40.2C24.8 42.1 26.3 43.3 28 43.3C29.7 43.3 31.2 42.1 31.8 40.2H24.2Z"
            fill="#FFFFFF"
            fillOpacity={0.8}
          />
          <Circle cx="36.2" cy="18.2" r="3.4" fill="#FFFFFF" fillOpacity={0.32} />
        </>
      );
  }
}

export function NotificationTypeIcon({ type, size = 38 }: NotificationTypeIconProps) {
  const palette = NOTIFICATION_PALETTES[type] ?? NOTIFICATION_PALETTES['he-thong'];
  const safeId = type.replace(/[^a-zA-Z0-9_-]/g, '_');
  const bgGradientId = `notif_ic_${safeId}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <Defs>
        <LinearGradient id={bgGradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={palette.from} />
          <Stop offset="100%" stopColor={palette.to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="56" height="56" rx="15.5" fill={`url(#${bgGradientId})`} />
      {renderGlyph(type, palette.accent)}
    </Svg>
  );
}
