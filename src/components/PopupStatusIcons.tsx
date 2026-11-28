import Svg, { Circle, Path } from 'react-native-svg';

export type PopupIconVariant = 'success' | 'error' | 'delete' | 'save' | 'info';

type PopupStatusIconProps = {
  variant: PopupIconVariant;
  size?: number;
};

/**
 * Bộ icon SVG tự vẽ (nền trong suốt, không bọc vòng/khung màu)
 * dùng thống nhất cho các popup thông báo & xác nhận.
 */
export function PopupStatusIcon({ variant, size = 46 }: PopupStatusIconProps) {
  switch (variant) {
    case 'success':
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path
            d="M39.5 19.5A16 16 0 1 1 32.8 10.6"
            stroke="#16A34A"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <Path
            d="M17.5 24.5L22.2 29.2L33.5 16.8"
            stroke="#16A34A"
            strokeWidth={2.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="39.5" cy="11.5" r="2" fill="#22C55E" />
          <Circle cx="9.5" cy="13.5" r="1.4" fill="#86EFAC" />
        </Svg>
      );

    case 'error':
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path
            d="M39.5 19.5A16 16 0 1 1 32.8 10.6"
            stroke="#DC2626"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <Path
            d="M18.5 18.5L29.5 29.5"
            stroke="#DC2626"
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          <Path
            d="M29.5 18.5L18.5 29.5"
            stroke="#DC2626"
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          <Circle cx="39.5" cy="11.5" r="1.8" fill="#F87171" />
          <Circle cx="9.5" cy="13.5" r="1.4" fill="#FCA5A5" />
        </Svg>
      );

    case 'delete':
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path
            d="M11 16.5L36.5 12.2"
            stroke="#DC2626"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <Path
            d="M19.5 15.1L19 12.1C18.8 11 19.5 10 20.6 9.8L25.4 9C26.5 8.8 27.5 9.5 27.7 10.6L28.2 13.6"
            stroke="#DC2626"
            strokeWidth={2.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M14.5 20L16.2 37.2C16.4 39 17.9 40.3 19.7 40.3H28.3C30.1 40.3 31.6 39 31.8 37.2L33.5 20"
            stroke="#DC2626"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M21.2 24.5V34.5"
            stroke="#EF4444"
            strokeWidth={2.3}
            strokeLinecap="round"
          />
          <Path
            d="M26.8 24.5V34.5"
            stroke="#EF4444"
            strokeWidth={2.3}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'save':
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path
            d="M13.5 10H30.2L37.5 17.3V34.5C37.5 36.7 35.7 38.5 33.5 38.5H13.5C11.3 38.5 9.5 36.7 9.5 34.5V14C9.5 11.8 11.3 10 13.5 10Z"
            stroke="#2563EB"
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <Path
            d="M16.5 10V16.2C16.5 17 17.2 17.7 18 17.7H27.5C28.3 17.7 29 17 29 16.2V10"
            stroke="#93C5FD"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M17.8 27.5L21.8 31.5L30.2 23.2"
            stroke="#2563EB"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'info':
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path
            d="M39.5 19.5A16 16 0 1 1 32.8 10.6"
            stroke="#2563EB"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <Circle cx="24" cy="17.5" r="1.6" fill="#2563EB" />
          <Path
            d="M24 22.8V31.5"
            stroke="#2563EB"
            strokeWidth={2.7}
            strokeLinecap="round"
          />
          <Circle cx="39.5" cy="11.5" r="1.8" fill="#93C5FD" />
        </Svg>
      );
  }
}
