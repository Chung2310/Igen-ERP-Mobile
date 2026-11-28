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

/**
 * Minh họa SVG mờ lấy cảm hứng từ mascot robot iGen đội mũ cử nhân bên quyển sách mở
 * dành riêng cho trạng thái trống / không tìm thấy dữ liệu ở phân hệ Học viên & Đào tạo.
 */
export function IgenStudentEmptyIllustration({
  width = 140,
  height = 104,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 144 106" fill="none">
      {/* Ground shadow & soft pastel cloud backdrop */}
      <Ellipse cx="72" cy="91" rx="46" ry="6" fill="#E3F2FD" fillOpacity={0.78} />
      <Path
        d="M30 80C21.5 80 15 73.8 15 65.8C15 58.6 20.2 52.8 27 51.7C29 40.5 38.6 32 50.2 32C56.2 32 61.8 34.2 66 37.9C70 34.7 75 32.8 80.5 32.8C92.2 32.8 101.8 41.8 102.8 53.2C110.2 54.4 115.8 60.5 115.8 68C115.8 75.5 109.6 80 102 80H30Z"
        fill="#E5F4FD"
        fillOpacity={0.78}
      />

      {/* Subtle floating sparkles & dots */}
      <Path
        d="M24 27L25.3 30.4L28.7 31.7L25.3 33L24 36.4L22.7 33L19.3 31.7L22.7 30.4L24 27Z"
        fill="#9FD8FA"
        fillOpacity={0.78}
      />
      <Circle cx="116" cy="28" r="2.8" fill="#A9DDFB" fillOpacity={0.7} />
      <Circle cx="122" cy="37" r="1.7" fill="#BCE6FC" fillOpacity={0.72} />
      <Circle cx="33" cy="44" r="1.5" fill="#BCE6FC" fillOpacity={0.72} />

      {/* Open study book / notebook on the right */}
      {/* Book back cover */}
      <Path
        d="M66 56C66 53.8 67.8 52 70 52H112C114.2 52 116 53.8 116 56V78C116 80.2 114.2 82 112 82H70C67.8 82 66 80.2 66 78V56Z"
        fill="#D3ECFC"
        fillOpacity={0.85}
      />
      {/* Left open page */}
      <Path
        d="M69 51.5C75.5 51.5 85 52.8 91 56V78.5C85 75.5 75.5 74.5 69 74.5V51.5Z"
        fill="#FFFFFF"
        fillOpacity={0.96}
        stroke="#B5DDF7"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Right open page */}
      <Path
        d="M113 51.5C106.5 51.5 97 52.8 91 56V78.5C97 75.5 106.5 74.5 113 74.5V51.5Z"
        fill="#F5FBFF"
        fillOpacity={0.96}
        stroke="#B5DDF7"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Soft text lines on pages */}
      <Path d="M74 58.5H85.5M74 63.5H83.5M74 68.5H81" stroke="#9FD6F9" strokeWidth="1.6" strokeLinecap="round" strokeOpacity={0.8} />
      <Path d="M96.5 58.5H107.5M96.5 63.5H105.5M96.5 68.5H103" stroke="#9FD6F9" strokeWidth="1.6" strokeLinecap="round" strokeOpacity={0.72} />
      {/* Bookmark ribbon */}
      <Path d="M103 52.5V62L105.8 59.8L108.6 62V52.5Z" fill="#7AC8F8" fillOpacity={0.85} />

      {/* iGen robot mascot wearing a graduation cap on the left */}
      {/* Ear-cups */}
      <Rect x="28.5" y="47.5" width="6" height="14" rx="3" fill="#9FD6F9" fillOpacity={0.84} />
      <Rect x="69.5" y="47.5" width="6" height="14" rx="3" fill="#9FD6F9" fillOpacity={0.84} />

      {/* Rounded robot head */}
      <Rect
        x="32.5"
        y="38.5"
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
        x="37.8"
        y="44.5"
        width="28.4"
        height="18.6"
        rx="9"
        fill="#CBE8FB"
        fillOpacity={0.82}
      />

      {/* Calm friendly eyes & gentle smile */}
      <Circle cx="47.2" cy="53.1" r="2.1" fill="#5CB6EE" fillOpacity={0.88} />
      <Circle cx="58.8" cy="53.1" r="2.1" fill="#5CB6EE" fillOpacity={0.88} />
      <Path
        d="M50 57.8C51.7 59.1 54.3 59.1 56 57.8"
        stroke="#5CB6EE"
        strokeOpacity={0.84}
        strokeWidth="1.9"
        strokeLinecap="round"
        fill="none"
      />

      {/* Graduation cap (mortarboard) tilted gently on robot's head */}
      <Path
        d="M52 24.5L32.5 32.2L52 39.8L71.5 32.2L52 24.5Z"
        fill="#7AC8F8"
        fillOpacity={0.92}
        stroke="#5CB6EE"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <Path
        d="M41.5 35.8V40.6C41.5 42.4 46.2 44 52 44C57.8 44 62.5 42.4 62.5 40.6V35.8L52 39.8L41.5 35.8Z"
        fill="#9FD6F9"
        fillOpacity={0.92}
      />
      {/* Cap button & hanging tassel */}
      <Circle cx="52" cy="31.8" r="1.7" fill="#FFFFFF" fillOpacity={0.92} />
      <Path
        d="M68.2 33.6V43.2"
        stroke="#5CB6EE"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <Circle cx="68.2" cy="44.6" r="2.1" fill="#7AC8F8" />

      {/* Little floating robot hands */}
      <Ellipse cx="38" cy="73.5" rx="5.2" ry="3" fill="#B9E1FA" fillOpacity={0.82} />
      <Ellipse cx="67.5" cy="71.2" rx="5.2" ry="3" fill="#9FD6F9" fillOpacity={0.88} />
    </Svg>
  );
}

export function IgenStudentEmptyState({
  message = 'Chưa có dữ liệu',
  compact = false,
}: IgenEmptyStateProps) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <IgenStudentEmptyIllustration
        width={compact ? 116 : 140}
        height={compact ? 86 : 104}
      />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

/**
 * Minh họa SVG phong cách pastel xanh trời (bảng chấm công, mũ bảo hộ, cặp hồ sơ dự án & kính lúp)
 * dành riêng cho trạng thái trống / không tìm thấy dữ liệu ở phân hệ Lao động.
 */
export function IgenWorkerEmptyIllustration({
  width = 140,
  height = 104,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 144 106" fill="none">
      {/* Ground shadow & soft pastel cloud backdrop */}
      <Ellipse cx="72" cy="91" rx="46" ry="6" fill="#E3F2FD" fillOpacity={0.78} />
      <Path
        d="M30 80C21.5 80 15 73.8 15 65.8C15 58.6 20.2 52.8 27 51.7C29 40.5 38.6 32 50.2 32C56.2 32 61.8 34.2 66 37.9C70 34.7 75 32.8 80.5 32.8C92.2 32.8 101.8 41.8 102.8 53.2C110.2 54.4 115.8 60.5 115.8 68C115.8 75.5 109.6 80 102 80H30Z"
        fill="#E5F4FD"
        fillOpacity={0.78}
      />

      {/* Subtle floating sparkles & accent dots */}
      <Path
        d="M24 26L25.3 29.4L28.7 30.7L25.3 32L24 35.4L22.7 32L19.3 30.7L22.7 29.4L24 26Z"
        fill="#9FD8FA"
        fillOpacity={0.82}
      />
      <Circle cx="116" cy="27" r="2.8" fill="#A9DDFB" fillOpacity={0.72} />
      <Circle cx="122" cy="36" r="1.7" fill="#BCE6FC" fillOpacity={0.75} />
      <Circle cx="29" cy="45" r="1.6" fill="#BCE6FC" fillOpacity={0.75} />

      {/* Back labor roster / attendance clipboard on the left */}
      <Rect
        x="38"
        y="29"
        width="44"
        height="50"
        rx="7.5"
        fill="#FFFFFF"
        fillOpacity={0.96}
        stroke="#B5DDF7"
        strokeWidth="1.5"
      />
      {/* Clipboard pastel header & top clip */}
      <Path
        d="M38.8 36.2C38.8 32.6 41.7 29.8 45.3 29.8H74.7C78.3 29.8 81.2 32.6 81.2 36.2V38.5H38.8V36.2Z"
        fill="#EAF6FE"
        fillOpacity={0.9}
      />
      <Rect x="52" y="25.5" width="16" height="6.5" rx="3.2" fill="#8ACFF9" fillOpacity={0.94} />
      <Rect x="56.2" y="27.5" width="7.6" height="2.4" rx="1.2" fill="#FFFFFF" fillOpacity={0.95} />

      {/* Checklist rows inside clipboard */}
      <Rect x="44.5" y="42.5" width="5.2" height="5.2" rx="1.6" fill="#CBE8FB" />
      <Path d="M53.5 45.1H73" stroke="#9FD6F9" strokeWidth="1.9" strokeLinecap="round" />
      <Rect x="44.5" y="51.2" width="5.2" height="5.2" rx="1.6" fill="#CBE8FB" />
      <Path d="M53.5 53.8H68.5" stroke="#B5DDF7" strokeWidth="1.8" strokeLinecap="round" />
      <Rect x="44.5" y="59.9" width="5.2" height="5.2" rx="1.6" fill="#D3ECFC" />
      <Path d="M53.5 62.5H64" stroke="#CBE8FB" strokeWidth="1.8" strokeLinecap="round" />

      {/* Project & contract briefcase on the right */}
      {/* Briefcase handle */}
      <Path
        d="M80.5 46V42.5C80.5 40.6 82 39 84 39H92C94 39 95.5 40.6 95.5 42.5V46"
        stroke="#95CBEF"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Briefcase body */}
      <Rect
        x="64"
        y="46"
        width="48"
        height="34"
        rx="7.5"
        fill="#FFFFFF"
        fillOpacity={0.98}
        stroke="#B5DDF7"
        strokeWidth="1.6"
      />
      {/* Soft top flap */}
      <Path
        d="M64.8 53.5C64.8 49.8 67.8 46.8 71.5 46.8H104.5C108.2 46.8 111.2 49.8 111.2 53.5V59.5C111.2 60.6 110.3 61.5 109.2 61.5H66.8C65.7 61.5 64.8 60.6 64.8 59.5V53.5Z"
        fill="#EAF6FE"
        fillOpacity={0.9}
      />
      {/* Flap divider line & center clasp */}
      <Path d="M65 61.5H111" stroke="#B5DDF7" strokeWidth="1.4" />
      <Rect x="83.5" y="58" width="9" height="7" rx="2.5" fill="#7AC8F8" fillOpacity={0.92} />
      <Circle cx="88" cy="61.5" r="1.3" fill="#FFFFFF" />
      {/* Subtle document lines inside bottom half */}
      <Path
        d="M72 69.5H87M72 73.8H82.5"
        stroke="#9FD6F9"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeOpacity={0.78}
      />

      {/* Safety hard hat (mũ bảo hộ) resting in front-left */}
      <Path
        d="M31 75.5V72.5C31 63.4 38.2 56.5 47 56.5C55.8 56.5 63 63.4 63 72.5V75.5H31Z"
        fill="#8ACFF9"
        fillOpacity={0.95}
        stroke="#5CB6EE"
        strokeWidth="1.3"
      />
      {/* Soft curved dome highlight */}
      <Path
        d="M36 70.5C36.6 65.5 39.8 61.8 44 60.5"
        stroke="#EAF6FE"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeOpacity={0.8}
      />
      {/* Center protective ridge on hard hat */}
      <Rect x="44.5" y="54.5" width="5" height="14" rx="2.5" fill="#5CB6EE" fillOpacity={0.88} />
      <Rect x="46" y="56.5" width="1.4" height="6.5" rx="0.7" fill="#FFFFFF" fillOpacity={0.7} />
      {/* Hard hat brim */}
      <Rect
        x="27.5"
        y="74"
        width="39"
        height="4.6"
        rx="2.3"
        fill="#7AC8F8"
        stroke="#5CB6EE"
        strokeWidth="1"
      />

      {/* Floating magnifying glass overlapping bottom-right of briefcase */}
      <Circle
        cx="109"
        cy="72"
        r="8.8"
        fill="#FFFFFF"
        fillOpacity={0.98}
        stroke="#66BCEF"
        strokeWidth="2"
      />
      <Circle cx="109" cy="72" r="5.3" fill="#E5F4FD" fillOpacity={0.88} />
      <Path
        d="M106.4 69.4C107.2 68.5 108.4 68.1 109.6 68.2"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <Path
        d="M115.5 78.5L121.5 84.5"
        stroke="#5CB6EE"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IgenWorkerEmptyState({
  message = 'Chưa có dữ liệu',
  detail,
  compact = false,
}: IgenEmptyStateProps & { detail?: string }) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <IgenWorkerEmptyIllustration
        width={compact ? 116 : 140}
        height={compact ? 86 : 104}
      />
      <Text style={styles.message}>{message}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

/**
 * Minh họa SVG phong cách pastel xanh trời (hồ sơ nhân sự, thẻ nhân viên & kính lúp)
 * dành riêng cho trạng thái trống / không tìm thấy dữ liệu ở phân hệ Nhân sự.
 */
export function IgenHrEmptyIllustration({
  width = 140,
  height = 104,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 144 106" fill="none">
      {/* Ground shadow & soft pastel cloud backdrop */}
      <Ellipse cx="72" cy="91" rx="46" ry="6" fill="#E3F2FD" fillOpacity={0.78} />
      <Path
        d="M30 80C21.5 80 15 73.8 15 65.8C15 58.6 20.2 52.8 27 51.7C29 40.5 38.6 32 50.2 32C56.2 32 61.8 34.2 66 37.9C70 34.7 75 32.8 80.5 32.8C92.2 32.8 101.8 41.8 102.8 53.2C110.2 54.4 115.8 60.5 115.8 68C115.8 75.5 109.6 80 102 80H30Z"
        fill="#E5F4FD"
        fillOpacity={0.78}
      />

      {/* Subtle floating sparkles & accent dots */}
      <Path
        d="M25 26L26.3 29.4L29.7 30.7L26.3 32L25 35.4L23.7 32L20.3 30.7L23.7 29.4L25 26Z"
        fill="#9FD8FA"
        fillOpacity={0.82}
      />
      <Circle cx="117" cy="27" r="2.8" fill="#A9DDFB" fillOpacity={0.72} />
      <Circle cx="123" cy="36" r="1.7" fill="#BCE6FC" fillOpacity={0.75} />
      <Circle cx="31" cy="44" r="1.6" fill="#BCE6FC" fillOpacity={0.75} />

      {/* Back HR dossier folder (left-tilted subtle layer) */}
      <Path
        d="M34 39C34 36.2 36.2 34 39 34H51.5C53.2 34 54.7 34.9 55.6 36.3L57.2 39H76C78.8 39 81 41.2 81 44V74C81 76.8 78.8 79 76 79H39C36.2 79 34 76.8 34 74V39Z"
        fill="#D3ECFC"
        fillOpacity={0.82}
        stroke="#B5DDF7"
        strokeWidth="1.4"
      />
      {/* Mini org-chart nodes inside left dossier peek */}
      <Circle cx="45.5" cy="50" r="3" fill="#9FD6F9" fillOpacity={0.9} />
      <Path
        d="M45.5 53V58.5M40.5 58.5H50.5M40.5 58.5V62M50.5 58.5V62"
        stroke="#8ACFF9"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <Circle cx="40.5" cy="64" r="2.2" fill="#B5DDF7" />
      <Circle cx="50.5" cy="64" r="2.2" fill="#B5DDF7" />

      {/* Front HR Employee ID Card / Personnel Profile Card */}
      {/* Lanyard clip slot at top center of card */}
      <Rect x="74" y="25.5" width="16" height="6.5" rx="3.2" fill="#8ACFF9" fillOpacity={0.92} />
      <Rect x="78.2" y="27.5" width="7.6" height="2.4" rx="1.2" fill="#FFFFFF" fillOpacity={0.94} />

      {/* Card body */}
      <Rect
        x="53"
        y="30.5"
        width="58"
        height="50"
        rx="9"
        fill="#FFFFFF"
        fillOpacity={0.98}
        stroke="#B5DDF7"
        strokeWidth="1.6"
      />
      {/* Soft pastel top header strip */}
      <Path
        d="M53.8 39.2C53.8 34.8 57.4 31.3 61.8 31.3H102.2C106.6 31.3 110.2 34.8 110.2 39.2V42H53.8V39.2Z"
        fill="#EAF6FE"
        fillOpacity={0.92}
      />
      {/* Tiny decorative dots on header strip */}
      <Circle cx="62" cy="36.8" r="1.5" fill="#9FD6F9" />
      <Circle cx="67" cy="36.8" r="1.5" fill="#B5DDF7" />

      {/* Employee avatar silhouette inside card */}
      <Circle cx="70.5" cy="56.5" r="9" fill="#D3ECFC" fillOpacity={0.9} />
      <Circle cx="70.5" cy="53.8" r="3.1" fill="#7AC8F8" fillOpacity={0.92} />
      <Path
        d="M64.5 62.5C65.6 59.4 67.9 58.2 70.5 58.2C73.1 58.2 75.4 59.4 76.5 62.5"
        stroke="#7AC8F8"
        strokeWidth="1.9"
        strokeLinecap="round"
        fill="none"
      />

      {/* Profile info lines beside avatar */}
      <Path d="M84.5 51.5H102" stroke="#7AC8F8" strokeWidth="2.3" strokeLinecap="round" />
      <Path d="M84.5 57.2H98.5" stroke="#B5DDF7" strokeWidth="2" strokeLinecap="round" />
      <Path d="M84.5 62.8H94.5" stroke="#CBE8FB" strokeWidth="2" strokeLinecap="round" />

      {/* Bottom dashed footer strip */}
      <Path
        d="M62 72.2H95"
        stroke="#D3ECFC"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="3.2 3.2"
      />

      {/* Floating magnifying glass overlapping bottom-right of card */}
      <Circle
        cx="107.5"
        cy="71.5"
        r="9.2"
        fill="#FFFFFF"
        fillOpacity={0.98}
        stroke="#66BCEF"
        strokeWidth="2"
      />
      <Circle cx="107.5" cy="71.5" r="5.6" fill="#E5F4FD" fillOpacity={0.88} />
      <Path
        d="M104.8 68.8C105.6 67.9 106.8 67.5 108 67.6"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <Path
        d="M114.3 78.3L120.5 84.5"
        stroke="#5CB6EE"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IgenHrEmptyState({
  message = 'Chưa có dữ liệu',
  compact = false,
}: IgenEmptyStateProps) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <IgenHrEmptyIllustration
        width={compact ? 116 : 140}
        height={compact ? 86 : 104}
      />
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
  detail: {
    color: '#9BA6B6',
    fontSize: 11.5,
    fontWeight: '300',
    textAlign: 'center',
    lineHeight: 16.5,
    maxWidth: 260,
  },
});
