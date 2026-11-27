import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { OverviewPageId } from '@/features/overview/types';

type OverviewTabIconProps = {
  id: OverviewPageId;
  size?: number;
};

type IconPalette = {
  from: string;
  to: string;
  accent: string;
};

const OVERVIEW_PALETTES: Record<OverviewPageId, IconPalette> = {
  finance: { from: '#22CA7E', to: '#0DA361', accent: '#14B06B' },
  hr: { from: '#FF8452', to: '#F25430', accent: '#F5603A' },
  quotation: { from: '#8E63FA', to: '#5E38E8', accent: '#6C42EE' },
  retail: { from: '#FFB72B', to: '#EB7E08', accent: '#F08E0E' },
  marketing: { from: '#28C4FF', to: '#0B8CE8', accent: '#1299EE' },
  student: { from: '#1EC5B5', to: '#0A968D', accent: '#11A79B' },
  worker: { from: '#86DA1C', to: '#4BB60B', accent: '#5DC210' },
  healthcare: { from: '#FF5E8A', to: '#DC1F56', accent: '#E52D63' },
};

function renderOverviewGlyph(id: OverviewPageId, accent: string) {
  switch (id) {
    case 'finance':
      return (
        <>
          <Circle cx="28" cy="28" r="15" fill="#FFFFFF" />
          <Path
            d="M28 19.2V36.8"
            stroke={accent}
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <Path
            d="M32.4 23.2C32.4 21.3 30.5 20 28 20C25.5 20 23.6 21.2 23.6 23.1C23.6 25 25.3 25.9 28 26.5C30.8 27.1 32.7 28 32.7 30.2C32.7 32.3 30.7 33.7 28 33.7C25.2 33.7 23.4 32.4 23.2 30.5"
            stroke={accent}
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
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

    case 'quotation':
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

    case 'retail':
      return (
        <>
          <Path
            d="M21 21.5V19C21 15.1 24.1 12 28 12C31.9 12 35 15.1 35 19V21.5"
            stroke="#FFFFFF"
            strokeOpacity={0.82}
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M14.5 21.5C14.5 20.1 15.6 19 17 19H39C40.4 19 41.5 20.1 41.5 21.5L40.1 38.2C39.9 40.9 37.6 43 34.9 43H21.1C18.4 43 16.1 40.9 15.9 38.2L14.5 21.5Z"
            fill="#FFFFFF"
          />
          <Circle cx="22.8" cy="25.8" r="2.2" fill={accent} />
          <Circle cx="33.2" cy="25.8" r="2.2" fill={accent} />
          <Path
            d="M23 32.5C24.3 34.8 26 35.8 28 35.8C30 35.8 31.7 34.8 33 32.5"
            stroke={accent}
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
          />
        </>
      );

    case 'marketing':
      return (
        <>
          <Path
            d="M39.5 19.5C41.8 20.8 43.5 23.2 43.5 26C43.5 28.4 42.3 30.5 40.5 31.8L41.5 36.2L37.1 34.5C35.8 34.9 34.4 35.1 33 35.1"
            fill="#FFFFFF"
            fillOpacity={0.62}
          />
          <Path
            d="M26.5 14.5C18.2 14.5 12 19.8 12 26.5C12 29.6 13.4 32.4 15.7 34.6L14.1 40.6C13.9 41.3 14.6 41.9 15.3 41.6L21.5 39.2C23.1 39.6 24.8 39.8 26.5 39.8C34.8 39.8 41 34.2 41 27.1C41 20.1 34.8 14.5 26.5 14.5Z"
            fill="#FFFFFF"
          />
          <Circle cx="21" cy="27.2" r="2.2" fill={accent} />
          <Circle cx="26.5" cy="27.2" r="2.2" fill={accent} />
          <Circle cx="32" cy="27.2" r="2.2" fill={accent} />
        </>
      );

    case 'student':
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

    case 'worker':
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

    case 'healthcare':
      return (
        <>
          <Path
            d="M28 42.2C27.4 42.2 26.8 42 26.3 41.6C17.6 34.9 13 30.1 13 23.6C13 18.4 17 14.5 21.9 14.5C24.7 14.5 26.8 15.8 28 17.6C29.2 15.8 31.3 14.5 34.1 14.5C39 14.5 43 18.4 43 23.6C43 30.1 38.4 34.9 29.7 41.6C29.2 42 28.6 42.2 28 42.2Z"
            fill="#FFFFFF"
          />
          <Rect x="26.1" y="21.5" width="3.8" height="11.5" rx="1.6" fill={accent} />
          <Rect x="22.25" y="25.35" width="11.5" height="3.8" rx="1.6" fill={accent} />
        </>
      );
  }
}

export function OverviewTabIcon({ id, size = 34 }: OverviewTabIconProps) {
  const palette = OVERVIEW_PALETTES[id];
  const bgGradientId = `ov_bg_${id}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <Defs>
        <LinearGradient id={bgGradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={palette.from} />
          <Stop offset="100%" stopColor={palette.to} />
        </LinearGradient>
      </Defs>

      <Rect x="0" y="0" width="56" height="56" rx="15.5" fill={`url(#${bgGradientId})`} />

      {renderOverviewGlyph(id, palette.accent)}
    </Svg>
  );
}

/**
 * Chi nhánh — Gradient squircle office building icon matching ModuleAppIcons / OverviewTabIcons.
 */
export function BranchAppIcon({ size = 34 }: { size?: number }) {
  const accent = '#2860EE';

  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <Defs>
        <LinearGradient id="ov_bg_branch" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#3E7EFF" />
          <Stop offset="100%" stopColor="#1E54E8" />
        </LinearGradient>
      </Defs>

      <Rect x="0" y="0" width="56" height="56" rx="15.5" fill="url(#ov_bg_branch)" />

      {/* Secondary wing */}
      <Path
        d="M32 23.5H39.8C41.5 23.5 42.8 24.8 42.8 26.5V41.5H32V23.5Z"
        fill="#FFFFFF"
        fillOpacity={0.74}
      />
      {/* Main building tower */}
      <Path
        d="M14.2 17.2C14.2 15.2 15.8 13.6 17.8 13.6H30.4C32.4 13.6 34 15.2 34 17.2V41.5H14.2V17.2Z"
        fill="#FFFFFF"
      />
      {/* Windows */}
      <Rect x="18.5" y="18.6" width="3.8" height="3.8" rx="1.1" fill={accent} />
      <Rect x="25.9" y="18.6" width="3.8" height="3.8" rx="1.1" fill={accent} />
      <Rect x="18.5" y="25.4" width="3.8" height="3.8" rx="1.1" fill={accent} fillOpacity={0.78} />
      <Rect x="25.9" y="25.4" width="3.8" height="3.8" rx="1.1" fill={accent} fillOpacity={0.78} />
      {/* Entrance door */}
      <Rect x="21.5" y="33.2" width="5.2" height="8.3" rx="1.6" fill={accent} />
      {/* Side wing windows */}
      <Rect x="36.2" y="28.2" width="3.2" height="3.2" rx="1" fill={accent} fillOpacity={0.75} />
      <Rect x="36.2" y="34.2" width="3.2" height="3.2" rx="1" fill={accent} fillOpacity={0.75} />
    </Svg>
  );
}

/**
 * Đầu trợ lý iGen AI — Circular glowing badge with the iGen login robot head.
 */
export function IgenAssistantAvatarIcon({ size = 38 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <Defs>
        <LinearGradient id="igen_ai_ring" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#32D2FF" />
          <Stop offset="55%" stopColor="#1B75F8" />
          <Stop offset="100%" stopColor="#1E4CE6" />
        </LinearGradient>
        <LinearGradient id="igen_ai_head" x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="75%" stopColor="#F2F8FF" />
          <Stop offset="100%" stopColor="#D6EAFF" />
        </LinearGradient>
        <LinearGradient id="igen_ai_visor" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0%" stopColor="#1C3159" />
          <Stop offset="100%" stopColor="#071226" />
        </LinearGradient>
        <LinearGradient id="igen_ai_ant" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#72F5FF" />
          <Stop offset="100%" stopColor="#0891F2" />
        </LinearGradient>
      </Defs>

      {/* Soft outer halo */}
      <Circle cx="28" cy="28" r="27.5" fill="#BFE7FF" fillOpacity={0.5} />
      {/* Main vibrant circular badge */}
      <Circle cx="28" cy="28" r="24.5" fill="url(#igen_ai_ring)" />

      {/* Tilted antenna stem & glowing ball */}
      <Path
        d="M27.2 19.6L25.1 13.5"
        stroke="#273B63"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <Circle cx="24.6" cy="11.6" r="3.4" fill="url(#igen_ai_ant)" />
      <Circle cx="23.6" cy="10.6" r="1.1" fill="#FFFFFF" fillOpacity={0.85} />
      {/* Antenna base cap */}
      <Path
        d="M23.5 19.8C24.4 17.9 29.8 17.9 31.2 19.8Z"
        fill="#13B5FF"
      />

      {/* Left & right glowing cyan ear-cups */}
      <Rect x="9.6" y="25.2" width="5.2" height="11.6" rx="2.6" fill="#0B7CF2" />
      <Rect x="10.4" y="27.1" width="2.6" height="7.8" rx="1.3" fill="#7BF6FF" />
      <Rect x="41.2" y="25.2" width="5.2" height="11.6" rx="2.6" fill="#0B7CF2" />
      <Rect x="43" y="27.1" width="2.6" height="7.8" rx="1.3" fill="#7BF6FF" />

      {/* Glossy white rounded robot head */}
      <Rect x="12.5" y="19" width="31" height="24.5" rx="12.2" fill="url(#igen_ai_head)" />

      {/* Dark glossy visor screen */}
      <Rect x="16" y="23.8" width="24" height="15.8" rx="7.6" fill="url(#igen_ai_visor)" />
      {/* Subtle visor top sheen */}
      <Path
        d="M20.5 25.4H35.5C34.2 27 31.4 27.6 28 27.6C24.6 27.6 21.8 27 20.5 25.4Z"
        fill="#FFFFFF"
        fillOpacity={0.14}
      />

      {/* Happy glowing cyan arched smiling eyes (^ ^) */}
      <Path
        d="M20.4 31.5C21.1 29.4 23.9 29.4 24.6 31.5"
        stroke="#6FF7FF"
        strokeWidth="2.3"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M31.4 31.5C32.1 29.4 34.9 29.4 35.6 31.5"
        stroke="#6FF7FF"
        strokeWidth="2.3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Cheerful glowing cyan smile */}
      <Path
        d="M24.6 33.8H31.4C31 36.4 29.6 37.5 28 37.5C26.4 37.5 25 36.4 24.6 33.8Z"
        fill="#6FF7FF"
      />
    </Svg>
  );
}

/**
 * Icon Thông báo đồng bộ phong cách glassmorphic tròn cạnh IgenAssistantAvatarIcon.
 * Nền vòng tròn trắng mờ có hào quang nhẹ, bên trong là chuông xanh hai lớp 3D.
 */
export function OverviewNotificationAvatarIcon({ size = 38 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <Defs>
        <LinearGradient id="ov_notif_surface" x1="0.15" y1="0" x2="0.85" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="65%" stopColor="#F4F9FF" />
          <Stop offset="100%" stopColor="#E4F0FF" />
        </LinearGradient>
        <LinearGradient id="ov_notif_bell_back" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#93C5FD" />
          <Stop offset="100%" stopColor="#60A5FA" />
        </LinearGradient>
        <LinearGradient id="ov_notif_bell_front" x1="0.2" y1="0" x2="0.85" y2="1">
          <Stop offset="0%" stopColor="#3B82F6" />
          <Stop offset="60%" stopColor="#2563EB" />
          <Stop offset="100%" stopColor="#1D4ED8" />
        </LinearGradient>
      </Defs>

      {/* Soft white-icy outer halo matching IgenAssistantAvatarIcon */}
      <Circle cx="28" cy="28" r="27.5" fill="#FFFFFF" fillOpacity={0.55} />
      {/* Main frosted white circular badge */}
      <Circle cx="28" cy="28" r="24.5" fill="url(#ov_notif_surface)" />

      {/* Back soft translucent blue glow accent (layered dual-tone depth) */}
      <Circle cx="32.5" cy="24.5" r="8.2" fill="url(#ov_notif_bell_back)" fillOpacity={0.48} />

      {/* Main glossy royal-blue notification bell */}
      <Circle cx="27.2" cy="15.8" r="2.2" fill="#3B82F6" />
      <Path
        d="M17.8 27.6C17.8 22.1 21.8 17.8 27.2 17.8C32.6 17.8 36.6 22.1 36.6 27.6V31C36.6 32.5 37.3 33.7 38.4 34.4C39 34.8 39.2 35.5 39 36.1C38.8 36.7 38.2 37.1 37.5 37.1H16.9C16.2 37.1 15.6 36.7 15.4 36.1C15.2 35.5 15.4 34.8 16 34.4C17.1 33.7 17.8 32.5 17.8 31V27.6Z"
        fill="url(#ov_notif_bell_front)"
      />
      {/* Subtle glossy highlight on bell crown */}
      <Path
        d="M21.8 23.2C22.8 21.1 24.7 19.9 27 19.8"
        stroke="#FFFFFF"
        strokeOpacity={0.45}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Clapper */}
      <Path
        d="M23.8 38.6C24.3 40.3 25.6 41.4 27.2 41.4C28.8 41.4 30.1 40.3 30.6 38.6H23.8Z"
        fill="#1E40AF"
      />
    </Svg>
  );
}
