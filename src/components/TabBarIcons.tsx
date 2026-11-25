import React from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type TabIconProps = {
  color: ColorValue;
  focused?: boolean;
  size?: number;
};

/**
 * Tổng quan — Rounded geometric home icon.
 * Inactive: crisp slate outline. Active: solid blue fill with white inner cutout.
 */
export function OverviewTabIcon({ color, focused = false, size = 24 }: TabIconProps) {
  if (focused) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M10.7 3.55C11.46 2.93 12.54 2.93 13.3 3.55L20.05 9.05C20.65 9.54 21 10.27 21 11.05V18.25C21 19.77 19.77 21 18.25 21H5.75C4.23 21 3 19.77 3 18.25V11.05C3 10.27 3.35 9.54 3.95 9.05L10.7 3.55Z"
          fill={color}
        />
        <Rect x="9.25" y="13.5" width="5.5" height="4.5" rx="2.25" fill="#FFFFFF" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.85 3.95C11.52 3.4 12.48 3.4 13.15 3.95L19.45 9.1C19.96 9.52 20.25 10.14 20.25 10.8V18C20.25 19.24 19.24 20.25 18 20.25H6C4.76 20.25 3.75 19.24 3.75 18V10.8C3.75 10.14 4.04 9.52 4.55 9.1L10.85 3.95Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.75 16H14.25"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Danh mục — 2x2 rounded squares grid (matching the "Thêm" icon style).
 */
export function ModulesTabIcon({ color, focused = false, size = 24 }: TabIconProps) {
  if (focused) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="3.25" y="3.25" width="7.5" height="7.5" rx="2.4" fill={color} />
        <Rect x="13.25" y="3.25" width="7.5" height="7.5" rx="2.4" fill={color} />
        <Rect x="3.25" y="13.25" width="7.5" height="7.5" rx="2.4" fill={color} />
        <Rect x="13.25" y="13.25" width="7.5" height="7.5" rx="2.4" fill={color} />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3.75"
        y="3.75"
        width="6.75"
        height="6.75"
        rx="2.1"
        stroke={color}
        strokeWidth={2}
      />
      <Rect
        x="13.5"
        y="3.75"
        width="6.75"
        height="6.75"
        rx="2.1"
        stroke={color}
        strokeWidth={2}
      />
      <Rect
        x="3.75"
        y="13.5"
        width="6.75"
        height="6.75"
        rx="2.1"
        stroke={color}
        strokeWidth={2}
      />
      <Rect
        x="13.5"
        y="13.5"
        width="6.75"
        height="6.75"
        rx="2.1"
        stroke={color}
        strokeWidth={2}
      />
    </Svg>
  );
}

/**
 * Trò chuyện — Rounded speech bubble with 3 dots (matching the "Chat" icon style).
 */
export function InboxTabIcon({ color, focused = false, size = 24 }: TabIconProps) {
  if (focused) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3C6.89 3 2.75 6.82 2.75 11.55C2.75 13.45 3.43 15.2 4.58 16.62L3.54 19.86C3.37 20.38 3.86 20.86 4.38 20.68L7.93 19.45C9.17 19.87 10.55 20.1 12 20.1C17.11 20.1 21.25 16.28 21.25 11.55C21.25 6.82 17.11 3 12 3Z"
          fill={color}
        />
        <Circle cx="8.5" cy="11.6" r="1.2" fill="#FFFFFF" />
        <Circle cx="12" cy="11.6" r="1.2" fill="#FFFFFF" />
        <Circle cx="15.5" cy="11.6" r="1.2" fill="#FFFFFF" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.75C7.3 3.75 3.5 7.25 3.5 11.55C3.5 13.3 4.13 14.91 5.19 16.2L4.26 19.12C4.12 19.55 4.53 19.95 4.96 19.8L8.15 18.69C9.32 19.12 10.63 19.35 12 19.35C16.7 19.35 20.5 15.85 20.5 11.55C20.5 7.25 16.7 3.75 12 3.75Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="8.6" cy="11.55" r="1.15" fill={color} />
      <Circle cx="12" cy="11.55" r="1.15" fill={color} />
      <Circle cx="15.4" cy="11.55" r="1.15" fill={color} />
    </Svg>
  );
}

/**
 * Trò chuyện AI — Circle with 4-point sparkle star (matching the "OneAI" icon style).
 */
export function AiChatTabIcon({ color, focused = false, size = 24 }: TabIconProps) {
  if (focused) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="9.5" fill={color} />
        <Path
          d="M12 6.5C12.38 9.48 14.52 11.62 17.5 12C14.52 12.38 12.38 14.52 12 17.5C11.62 14.52 9.48 12.38 6.5 12C9.48 11.62 11.62 9.48 12 6.5Z"
          fill="#FFFFFF"
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8.75" stroke={color} strokeWidth={2} />
      <Path
        d="M12 7C12.35 9.7 14.3 11.65 17 12C14.3 12.35 12.35 14.3 12 17C11.65 14.3 9.7 12.35 7 12C9.7 11.65 11.65 9.7 12 7Z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * Cài đặt cá nhân — Rounded geometric gear icon.
 * Inactive: crisp slate outline. Active: solid blue fill with white center cutout.
 */
export function ProfileTabIcon({ color, focused = false, size = 24 }: TabIconProps) {
  const gearPath =
    'M10.32 3.65C10.55 2.97 11.19 2.5 11.91 2.5H12.09C12.81 2.5 13.45 2.97 13.68 3.65L13.99 4.57C14.48 4.71 14.95 4.91 15.39 5.16L16.26 4.74C16.91 4.43 17.69 4.56 18.2 5.07L18.93 5.8C19.44 6.31 19.57 7.09 19.26 7.74L18.84 8.61C19.09 9.05 19.29 9.52 19.43 10.01L20.35 10.32C21.03 10.55 21.5 11.19 21.5 11.91V12.09C21.5 12.81 21.03 13.45 20.35 13.68L19.43 13.99C19.29 14.48 19.09 14.95 18.84 15.39L19.26 16.26C19.57 16.91 19.44 17.69 18.93 18.2L18.2 18.93C17.69 19.44 16.91 19.57 16.26 19.26L15.39 18.84C14.95 19.09 14.48 19.29 13.99 19.43L13.68 20.35C13.45 21.03 12.81 21.5 12.09 21.5H11.91C11.19 21.5 10.55 21.03 10.32 20.35L10.01 19.43C9.52 19.29 9.05 19.09 8.61 18.84L7.74 19.26C7.09 19.57 6.31 19.44 5.8 18.93L5.07 18.2C4.56 17.69 4.43 16.91 4.74 16.26L5.16 15.39C4.91 14.95 4.71 14.48 4.57 13.99L3.65 13.68C2.97 13.45 2.5 12.81 2.5 12.09V11.91C2.5 11.19 2.97 10.55 3.65 10.32L4.57 10.01C4.71 9.52 4.91 9.05 5.16 8.61L4.74 7.74C4.43 7.09 4.56 6.31 5.07 5.8L5.8 5.07C6.31 4.56 7.09 4.43 7.74 4.74L8.61 5.16C9.05 4.91 9.52 4.71 10.01 4.57L10.32 3.65Z';

  if (focused) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d={gearPath} fill={color} />
        <Circle cx="12" cy="12" r="3.35" fill="#FFFFFF" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={gearPath}
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.9} />
    </Svg>
  );
}
