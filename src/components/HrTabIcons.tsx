import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { HrTabId } from '@/features/hr/types';

type HrTabIconProps = {
  id: HrTabId;
  size?: number;
};

type IconPalette = {
  from: string;
  to: string;
  accent: string;
};

const HR_TAB_PALETTES: Record<HrTabId, IconPalette> = {
  employees: { from: '#28C4FF', to: '#0B8CE8', accent: '#1299EE' },
  departments: { from: '#8E63FA', to: '#5E38E8', accent: '#6C42EE' },
  branches: { from: '#38B6FF', to: '#0E7AE6', accent: '#1E92F0' },
  training: { from: '#1EC5B5', to: '#0A968D', accent: '#11A79B' },
  workflows: { from: '#5B6CFF', to: '#3844E6', accent: '#4854F0' },
  tasks: { from: '#FF8452', to: '#F25430', accent: '#F5603A' },
  attendance: { from: '#22C7E5', to: '#0284C7', accent: '#0891B2' },
  leaves: { from: '#FFD22A', to: '#F49A07', accent: '#F5A50C' },
  contracts: { from: '#F45CA8', to: '#D12677', accent: '#E0398B' },
  payroll: { from: '#22CA7E', to: '#0DA361', accent: '#14B06B' },
  recruitment: { from: '#FB7185', to: '#E11D48', accent: '#F43F5E' },
};

function renderGlyph(id: HrTabId, accent: string) {
  switch (id) {
    case 'employees':
      return (
        <>
          <Circle cx="36.2" cy="22.8" r="4.1" fill="#FFFFFF" fillOpacity={0.74} />
          <Path
            d="M32.4 37.8C32.7 33.2 35.5 30.2 39.2 30.2C42.1 30.2 44.3 32.1 45 35.2C45.3 36.6 44.3 37.8 42.9 37.8H32.4Z"
            fill="#FFFFFF"
            fillOpacity={0.74}
          />
          <Circle cx="23.5" cy="21.2" r="5.5" fill="#FFFFFF" />
          <Path
            d="M12.5 38.5C12.5 32.6 17.2 28.8 23.5 28.8C29.8 28.8 34.5 32.6 34.5 38.5C34.5 39.7 33.5 40.7 32.3 40.7H14.7C13.5 40.7 12.5 39.7 12.5 38.5Z"
            fill="#FFFFFF"
          />
        </>
      );

    case 'departments':
      return (
        <>
          <Path
            d="M32.8 24H39.8C41.5 24 42.8 25.3 42.8 27V41.5H32.8V24Z"
            fill="#FFFFFF"
            fillOpacity={0.78}
          />
          <Path
            d="M14 16.5C14 14.5 15.6 13 17.6 13H30.6C32.6 13 34.2 14.5 34.2 16.5V41.5H14V16.5Z"
            fill="#FFFFFF"
          />
          <Rect x="18.5" y="18.6" width="3.8" height="3.8" rx="1.1" fill={accent} />
          <Rect x="25.9" y="18.6" width="3.8" height="3.8" rx="1.1" fill={accent} />
          <Rect x="18.5" y="25.4" width="3.8" height="3.8" rx="1.1" fill={accent} fillOpacity={0.78} />
          <Rect x="25.9" y="25.4" width="3.8" height="3.8" rx="1.1" fill={accent} fillOpacity={0.78} />
          <Rect x="21.5" y="33.2" width="5.2" height="8.3" rx="1.6" fill={accent} />
        </>
      );

    case 'branches':
      return (
        <>
          <Path
            d="M28 12.5C20.5 12.5 14.8 18.2 14.8 25.4C14.8 33.5 24.4 41.3 27 43.2C27.6 43.6 28.4 43.6 29 43.2C31.6 41.3 41.2 33.5 41.2 25.4C41.2 18.2 35.5 12.5 28 12.5Z"
            fill="#FFFFFF"
          />
          <Circle cx="28" cy="25.2" r="5.2" fill={accent} />
        </>
      );

    case 'training':
      return (
        <>
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

    case 'workflows':
      return (
        <>
          <Path
            d="M23 19.5H31C33.2 19.5 35 21.3 35 23.5V28"
            stroke="#FFFFFF"
            strokeOpacity={0.78}
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M21 25V33C21 35.2 22.8 37 25 37H30"
            stroke="#FFFFFF"
            strokeOpacity={0.78}
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
          />
          <Rect x="14" y="14" width="11.5" height="11.5" rx="3.4" fill="#FFFFFF" />
          <Rect x="30.5" y="30.5" width="11.5" height="11.5" rx="3.4" fill="#FFFFFF" />
          <Circle cx="35" cy="21" r="3.6" fill="#FFFFFF" fillOpacity={0.85} />
        </>
      );

    case 'tasks':
      return (
        <>
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

    case 'attendance':
      return (
        <>
          <Rect x="18.5" y="12" width="3.4" height="6.5" rx="1.7" fill="#FFFFFF" fillOpacity={0.82} />
          <Rect x="34.1" y="12" width="3.4" height="6.5" rx="1.7" fill="#FFFFFF" fillOpacity={0.82} />
          <Rect x="13.5" y="16" width="29" height="26.5" rx="6" fill="#FFFFFF" />
          <Path d="M13.5 23.5H42.5" stroke={accent} strokeOpacity={0.28} strokeWidth="2.2" />
          <Path
            d="M22.5 32.6L26.2 36.2L34 28.4"
            stroke={accent}
            strokeWidth="3.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );

    case 'leaves':
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

    case 'contracts':
      return (
        <>
          <Rect x="14.5" y="13" width="27" height="30" rx="5.5" fill="#FFFFFF" />
          <Rect x="19.5" y="19" width="17" height="2.6" rx="1.3" fill={accent} />
          <Rect x="19.5" y="24.4" width="13" height="2.6" rx="1.3" fill={accent} fillOpacity={0.68} />
          <Circle cx="33.5" cy="34.2" r="4.6" fill={accent} />
          <Path
            d="M31.6 34.2L33 35.6L35.6 32.8"
            stroke="#FFFFFF"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );

    case 'payroll':
      return (
        <>
          <Path
            d="M15 21.5C15 18.2 17.7 15.5 21 15.5H37.5C39.2 15.5 40.5 16.8 40.5 18.5V21.5H15Z"
            fill="#FFFFFF"
            fillOpacity={0.74}
          />
          <Rect x="13.5" y="19.5" width="29" height="21.5" rx="5.5" fill="#FFFFFF" />
          <Rect x="30.5" y="26.5" width="12" height="7.5" rx="3.75" fill={accent} fillOpacity={0.22} />
          <Circle cx="34.8" cy="30.25" r="2.3" fill={accent} />
        </>
      );

    case 'recruitment':
      return (
        <>
          <Circle cx="28" cy="28" r="14.5" fill="#FFFFFF" />
          <Circle cx="28" cy="28" r="9.4" fill={accent} fillOpacity={0.25} />
          <Circle cx="28" cy="28" r="4.8" fill={accent} />
        </>
      );
  }
}

export function HrTabIcon({ id, size = 24 }: HrTabIconProps) {
  const palette = HR_TAB_PALETTES[id] ?? HR_TAB_PALETTES.employees;
  const bgGradientId = `hr_tab_${id}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <Defs>
        <LinearGradient id={bgGradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={palette.from} />
          <Stop offset="100%" stopColor={palette.to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="56" height="56" rx="15.5" fill={`url(#${bgGradientId})`} />
      {renderGlyph(id, palette.accent)}
    </Svg>
  );
}
