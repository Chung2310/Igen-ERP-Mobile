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
