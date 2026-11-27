import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type SettingsIconKey =
  | 'notifications'
  | 'security'
  | 'permissions'
  | 'privacy'
  | 'support'
  | 'logout';

type SettingsDuotoneIconProps = {
  name: SettingsIconKey;
  size?: number;
};

const LIGHT = '#9AB8FB';
const DARK = '#2463EB';

export function SettingsDuotoneIcon({ name, size = 22 }: SettingsDuotoneIconProps) {
  switch (name) {
    case 'notifications':
      // Duotone bell: soft periwinkle bell body + royal blue clapper & dot
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3.2C8.65 3.2 6 5.85 6 9.2V13.4L4.55 15.6C4.12 16.25 4.58 17.1 5.36 17.1H18.64C19.42 17.1 19.88 16.25 19.45 15.6L18 13.4V9.2C18 5.85 15.35 3.2 12 3.2Z"
            fill={LIGHT}
          />
          <Path
            d="M9.6 18.4C10.05 19.8 10.95 20.6 12 20.6C13.05 20.6 13.95 19.8 14.4 18.4H9.6Z"
            fill={DARK}
          />
          <Circle cx="17.2" cy="6.2" r="2.6" fill={DARK} />
        </Svg>
      );

    case 'security':
      // Duotone shield with keyhole/lock (matching reference "Tài khoản & Bảo mật")
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2.6L4.6 5.4C4.24 5.54 4 5.88 4 6.26V11.6C4 16.55 7.42 20.48 11.72 21.55C11.9 21.6 12.1 21.6 12.28 21.55C16.58 20.48 20 16.55 20 11.6V6.26C20 5.88 19.76 5.54 19.4 5.4L12 2.6Z"
            fill={LIGHT}
          />
          <Rect x="8.8" y="10.8" width="6.4" height="5.2" rx="1.6" fill={DARK} />
          <Path
            d="M10.1 10.8V9.4C10.1 8.35 10.95 7.5 12 7.5C13.05 7.5 13.9 8.35 13.9 9.4V10.8"
            stroke={DARK}
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'permissions':
      // Duotone 2x2 grid with plus accent (matching reference "Tùy chỉnh menu")
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2.2" fill={DARK} />
          <Rect x="13" y="3.5" width="7.5" height="7.5" rx="2.2" fill={LIGHT} />
          <Rect x="3.5" y="13" width="7.5" height="7.5" rx="2.2" fill={LIGHT} />
          <Path
            d="M16.75 13.6V19.9M13.6 16.75H19.9"
            stroke={DARK}
            strokeWidth="2.1"
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'privacy':
      // Duotone eye: soft blue outer eye + royal blue pupil
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M2.6 12C4.3 8.15 7.85 5.8 12 5.8C16.15 5.8 19.7 8.15 21.4 12C19.7 15.85 16.15 18.2 12 18.2C7.85 18.2 4.3 15.85 2.6 12Z"
            fill={LIGHT}
          />
          <Circle cx="12" cy="12" r="3.4" fill={DARK} />
        </Svg>
      );

    case 'support':
      // Duotone info/help circle (matching reference "Thông tin ứng dụng")
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9.2" fill={LIGHT} />
          <Circle cx="12" cy="8.2" r="1.25" fill={DARK} />
          <Rect x="10.95" y="10.9" width="2.1" height="5.8" rx="1.05" fill={DARK} />
        </Svg>
      );

    case 'logout':
      // Duotone door + left arrow (matching reference "Đăng xuất")
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="9.5" y="3.5" width="10.5" height="17" rx="3.4" fill={LIGHT} />
          <Path
            d="M14.2 12H4.5M4.5 12L8.1 8.4M4.5 12L8.1 15.6"
            stroke={DARK}
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
  }
}
