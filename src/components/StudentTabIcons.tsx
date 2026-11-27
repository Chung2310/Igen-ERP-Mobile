import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export type StudentTabId =
  | 'students'
  | 'courses'
  | 'batches'
  | 'quality'
  | 'exams'
  | 'fees'
  | 'retention'
  | 'roadmap'
  | 'notifications'
  | 'classrooms'
  | 'resources';

type StudentTabIconProps = {
  id: StudentTabId;
  size?: number;
};

type IconPalette = {
  from: string;
  to: string;
  accent: string;
};

const STUDENT_TAB_PALETTES: Record<StudentTabId, IconPalette> = {
  students: { from: '#28C4FF', to: '#0B8CE8', accent: '#1299EE' },
  courses: { from: '#3E7EFF', to: '#1E54E8', accent: '#2860EE' },
  batches: { from: '#1EC5B5', to: '#0A968D', accent: '#11A79B' },
  quality: { from: '#22CA7E', to: '#0DA361', accent: '#14B06B' },
  exams: { from: '#8E63FA', to: '#5E38E8', accent: '#6C42EE' },
  fees: { from: '#FFB72B', to: '#EA7C08', accent: '#F08C10' },
  retention: { from: '#FB7185', to: '#E11D48', accent: '#F43F5E' },
  roadmap: { from: '#5B6CFF', to: '#3844E6', accent: '#4854F0' },
  notifications: { from: '#FF8452', to: '#F25430', accent: '#F5603A' },
  classrooms: { from: '#38B6FF', to: '#0E7AE6', accent: '#1E92F0' },
  resources: { from: '#22C7E5', to: '#0284C7', accent: '#0891B2' },
};

function renderGlyph(id: StudentTabId, accent: string) {
  switch (id) {
    case 'students':
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

    case 'courses':
      return (
        <>
          <Path
            d="M14 17.5C14 15.6 15.6 14 17.5 14H26.5V41H17.5C15.6 41 14 39.4 14 37.5V17.5Z"
            fill="#FFFFFF"
          />
          <Path
            d="M29.5 14H38.5C40.4 14 42 15.6 42 17.5V37.5C42 39.4 40.4 41 38.5 41H29.5V14Z"
            fill="#FFFFFF"
            fillOpacity={0.86}
          />
          <Rect x="17.8" y="20" width="5.5" height="2.4" rx="1.2" fill={accent} />
          <Rect x="17.8" y="25.5" width="5.5" height="2.4" rx="1.2" fill={accent} fillOpacity={0.65} />
          <Rect x="32.7" y="20" width="5.5" height="2.4" rx="1.2" fill={accent} />
          <Rect x="32.7" y="25.5" width="5.5" height="2.4" rx="1.2" fill={accent} fillOpacity={0.65} />
        </>
      );

    case 'batches':
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

    case 'quality':
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

    case 'exams':
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

    case 'fees':
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

    case 'retention':
      return (
        <>
          <Circle cx="28" cy="28" r="14.5" fill="#FFFFFF" />
          <Rect x="22.3" y="21.2" width="4.2" height="13.6" rx="2.1" fill={accent} />
          <Rect x="29.5" y="21.2" width="4.2" height="13.6" rx="2.1" fill={accent} />
        </>
      );

    case 'roadmap':
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

    case 'notifications':
      return (
        <>
          <Path
            d="M28 13.5C22.8 13.5 19 17.4 19 22.5V28.4L16.3 32.4C15.7 33.3 16.3 34.5 17.4 34.5H38.6C39.7 34.5 40.3 33.3 39.7 32.4L37 28.4V22.5C37 17.4 33.2 13.5 28 13.5Z"
            fill="#FFFFFF"
          />
          <Path
            d="M24.2 37.5C24.8 39.6 26.3 41 28 41C29.7 41 31.2 39.6 31.8 37.5H24.2Z"
            fill="#FFFFFF"
            fillOpacity={0.86}
          />
          <Circle cx="35.8" cy="18.2" r="3.4" fill={accent} />
          <Circle cx="35.8" cy="18.2" r="2.2" fill="#FFFFFF" />
        </>
      );

    case 'classrooms':
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

    case 'resources':
      return (
        <>
          <Rect x="14" y="16" width="28" height="19.5" rx="4.5" fill="#FFFFFF" />
          <Rect x="18" y="20" width="20" height="11.5" rx="2" fill={accent} fillOpacity={0.22} />
          <Rect x="23" y="37.8" width="10" height="3.2" rx="1.6" fill="#FFFFFF" fillOpacity={0.86} />
          <Rect x="26.2" y="34.5" width="3.6" height="4.2" fill="#FFFFFF" fillOpacity={0.86} />
        </>
      );
  }
}

export function StudentTabIcon({ id, size = 24 }: StudentTabIconProps) {
  const palette = STUDENT_TAB_PALETTES[id] ?? STUDENT_TAB_PALETTES.students;
  const bgGradientId = `student_tab_${id}`;

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
