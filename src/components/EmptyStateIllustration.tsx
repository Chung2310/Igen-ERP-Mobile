import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

type IgenEmptyStateProps = {
  message?: string;
  compact?: boolean;
};

/**
 * Minh họa SVG mờ lấy cảm hứng từ robot iGen cho trạng thái chưa có dữ liệu.
 * Hiển thị text tiếng Việt nét mỏng, không hiện mã HTTP kỹ thuật.
 */
export function IgenEmptyState({
  message = 'Chưa có dữ liệu',
  compact = false,
}: IgenEmptyStateProps) {
  const width = compact ? 92 : 112;
  const height = compact ? 68 : 82;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Svg width={width} height={height} viewBox="0 0 120 88" fill="none">
        {/* Soft pastel cloud aura behind robot */}
        <Ellipse cx="60" cy="74" rx="34" ry="5.5" fill="#E3F2FD" fillOpacity={0.75} />
        <Path
          d="M27 64C19.5 64 14 58.6 14 51.6C14 45.4 18.6 40.3 24.6 39.4C26.4 29.8 34.8 22.5 45 22.5C50.2 22.5 55 24.4 58.7 27.6C62.1 24.8 66.4 23.2 71.1 23.2C81.3 23.2 89.7 31 90.6 41C97.1 42 102 47.4 102 54C102 60.6 96.6 64 90 64H27Z"
          fill="#E5F4FD"
          fillOpacity={0.78}
        />

        {/* Subtle floating sparkles */}
        <Path
          d="M24 22L25.2 25.2L28.4 26.4L25.2 27.6L24 30.8L22.8 27.6L19.6 26.4L22.8 25.2L24 22Z"
          fill="#9FD8FA"
          fillOpacity={0.7}
        />
        <Circle cx="96" cy="26" r="2.6" fill="#A9DDFB" fillOpacity={0.65} />
        <Circle cx="101" cy="34" r="1.6" fill="#BCE6FC" fillOpacity={0.65} />

        {/* Minimalist muted iGen robot silhouette */}
        {/* Tilted antenna */}
        <Path
          d="M58.8 26.5L55.6 16.8"
          stroke="#95CBEF"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <Circle cx="54.8" cy="14.2" r="4.2" fill="#7AC8F8" fillOpacity={0.85} />
        <Circle cx="53.6" cy="13" r="1.3" fill="#FFFFFF" fillOpacity={0.85} />
        <Path
          d="M53.5 27.5C54.9 24.5 64.1 24.5 65.5 27.5Z"
          fill="#8ACFF9"
          fillOpacity={0.85}
        />

        {/* Ear-cups */}
        <Rect x="34.5" y="36.5" width="6.5" height="15" rx="3.25" fill="#9FD6F9" fillOpacity={0.8} />
        <Rect x="79" y="36.5" width="6.5" height="15" rx="3.25" fill="#9FD6F9" fillOpacity={0.8} />

        {/* Rounded robot head */}
        <Rect
          x="39"
          y="26.5"
          width="42"
          height="33"
          rx="16"
          fill="#FFFFFF"
          fillOpacity={0.92}
          stroke="#B5DDF7"
          strokeWidth="1.6"
        />

        {/* Soft muted visor */}
        <Rect
          x="44.5"
          y="33"
          width="31"
          height="20"
          rx="9.5"
          fill="#CBE8FB"
          fillOpacity={0.78}
        />

        {/* Gentle calm eyes & soft neutral smile (empty state expression) */}
        <Circle cx="53.8" cy="42.5" r="2.2" fill="#5CB6EE" fillOpacity={0.82} />
        <Circle cx="66.2" cy="42.5" r="2.2" fill="#5CB6EE" fillOpacity={0.82} />
        <Path
          d="M56.8 47.4C58.6 48.8 61.4 48.8 63.2 47.4"
          stroke="#5CB6EE"
          strokeOpacity={0.78}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Little floating robot hands */}
        <Ellipse cx="44" cy="63.5" rx="5.5" ry="3.2" fill="#B9E1FA" fillOpacity={0.78} />
        <Ellipse cx="76" cy="63.5" rx="5.5" ry="3.2" fill="#B9E1FA" fillOpacity={0.78} />
      </Svg>

      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

/**
 * Minh họa SVG mờ lấy cảm hứng từ mascot robot iGen kết hợp hộp thư trống
 * cho màn hình Thông báo / Hộp thư.
 */
export function IgenInboxEmptyIllustration({
  width = 136,
  height = 100,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 144 106" fill="none">
      {/* Ground shadow & soft pastel cloud backdrop */}
      <Ellipse cx="72" cy="91" rx="44" ry="6" fill="#E3F2FD" fillOpacity={0.78} />
      <Path
        d="M30 80C21.5 80 15 73.8 15 65.8C15 58.6 20.2 52.8 27 51.7C29 40.5 38.6 32 50.2 32C56.2 32 61.8 34.2 66 37.9C70 34.7 75 32.8 80.5 32.8C92.2 32.8 101.8 41.8 102.8 53.2C110.2 54.4 115.8 60.5 115.8 68C115.8 75.5 109.6 80 102 80H30Z"
        fill="#E5F4FD"
        fillOpacity={0.78}
      />

      {/* Subtle floating sparkles & dots */}
      <Path
        d="M25 28L26.3 31.4L29.7 32.7L26.3 34L25 37.4L23.7 34L20.3 32.7L23.7 31.4L25 28Z"
        fill="#9FD8FA"
        fillOpacity={0.75}
      />
      <Circle cx="115" cy="27" r="2.8" fill="#A9DDFB" fillOpacity={0.68} />
      <Circle cx="121" cy="36" r="1.7" fill="#BCE6FC" fillOpacity={0.7} />
      <Circle cx="34" cy="43" r="1.6" fill="#BCE6FC" fillOpacity={0.72} />

      {/* Tiny dotted breeze trail & mini floating paper plane from open inbox */}
      <Path
        d="M84 34C88 26 95 22 102 21"
        stroke="#A4D8F8"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="2.5 3.5"
      />
      <Path
        d="M103 18.5L112.5 16L107.2 24.2L105.6 21.1L103 18.5Z"
        fill="#B6E1FA"
        fillOpacity={0.9}
      />
      <Path
        d="M105.6 21.1L112.5 16"
        stroke="#7AC8F8"
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* Open mailbox / inbox on the right */}
      {/* Mailbox post */}
      <Rect x="84.5" y="72" width="7" height="17" rx="3" fill="#B9E1FA" fillOpacity={0.82} />

      {/* Mailbox back body */}
      <Path
        d="M64 51C64 43.3 70.3 37 78 37H97C104.7 37 111 43.3 111 51V72C111 74.2 109.2 76 107 76H68C65.8 76 64 74.2 64 72V51Z"
        fill="#FFFFFF"
        fillOpacity={0.95}
        stroke="#B5DDF7"
        strokeWidth="1.6"
      />

      {/* Soft shading on right side of mailbox */}
      <Path
        d="M89 37.8H97C104.2 37.8 110.2 43.7 110.2 51V72C110.2 73.8 108.8 75.2 107 75.2H89V37.8Z"
        fill="#EAF6FE"
        fillOpacity={0.72}
      />

      {/* Open front arch cavity */}
      <Path
        d="M68 53C68 46.9 72.9 42 79 42C85.1 42 90 46.9 90 53V72H68V53Z"
        fill="#D3ECFC"
        fillOpacity={0.85}
      />

      {/* Open front lid resting forward */}
      <Path
        d="M66.5 72H90.5L85.5 80.5C84.8 81.6 83.6 82.3 82.3 82.3H63.8C62.2 82.3 61.3 80.5 62.2 79.1L66.5 72Z"
        fill="#FFFFFF"
        fillOpacity={0.95}
        stroke="#B5DDF7"
        strokeWidth="1.5"
      />

      {/* Small mail slot line / envelope detail inside */}
      <Path
        d="M73 59.5H85M75 64H83"
        stroke="#8ACFF9"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeOpacity={0.75}
      />

      {/* Mailbox side flag (resting calmly) */}
      <Path
        d="M103 55V45.5H111.5V50.2H105.6"
        fill="#8ACFF9"
        fillOpacity={0.88}
      />
      <Circle cx="104.3" cy="56" r="2.2" fill="#7AC8F8" />

      {/* iGen robot mascot peeking beside the mailbox on the left */}
      {/* Tilted antenna */}
      <Path
        d="M52 38L49 28.8"
        stroke="#95CBEF"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <Circle cx="48.2" cy="26.2" r="4" fill="#7AC8F8" fillOpacity={0.88} />
      <Circle cx="47.1" cy="25.1" r="1.2" fill="#FFFFFF" fillOpacity={0.85} />
      <Path
        d="M46.8 39C48.1 36.2 56.9 36.2 58.2 39Z"
        fill="#8ACFF9"
        fillOpacity={0.88}
      />

      {/* Ear-cups */}
      <Rect x="29.5" y="47.2" width="6" height="14" rx="3" fill="#9FD6F9" fillOpacity={0.82} />
      <Rect x="70.5" y="47.2" width="6" height="14" rx="3" fill="#9FD6F9" fillOpacity={0.82} />

      {/* Rounded robot head */}
      <Rect
        x="33.5"
        y="38"
        width="39"
        height="31"
        rx="15"
        fill="#FFFFFF"
        fillOpacity={0.96}
        stroke="#B5DDF7"
        strokeWidth="1.6"
      />

      {/* Soft pastel visor */}
      <Rect
        x="38.8"
        y="44"
        width="28.4"
        height="18.6"
        rx="9"
        fill="#CBE8FB"
        fillOpacity={0.82}
      />

      {/* Calm friendly eyes & gentle smile looking slightly toward mailbox */}
      <Circle cx="48.2" cy="52.6" r="2.1" fill="#5CB6EE" fillOpacity={0.86} />
      <Circle cx="59.8" cy="52.6" r="2.1" fill="#5CB6EE" fillOpacity={0.86} />
      <Path
        d="M51 57.3C52.7 58.6 55.3 58.6 57 57.3"
        stroke="#5CB6EE"
        strokeOpacity={0.82}
        strokeWidth="1.9"
        strokeLinecap="round"
        fill="none"
      />

      {/* Little floating robot hands (right hand gently resting near mailbox) */}
      <Ellipse cx="38.5" cy="73" rx="5.2" ry="3" fill="#B9E1FA" fillOpacity={0.82} />
      <Ellipse cx="68.5" cy="70.5" rx="5.2" ry="3" fill="#9FD6F9" fillOpacity={0.88} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 8,
  },
  wrapCompact: {
    paddingVertical: 12,
    gap: 6,
  },
  message: {
    color: '#8A96A8',
    fontSize: 12.5,
    fontWeight: '300',
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 0.15,
  },
});
