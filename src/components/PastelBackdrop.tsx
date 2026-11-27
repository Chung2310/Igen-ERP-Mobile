import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

export const PASTEL_BACKDROP_TOP_COLOR = '#D8EFFC';

export function PastelBackdrop({ idPrefix = 'pastel' }: { idPrefix?: string }) {
  const bgId = `${idPrefix}Bg`;
  const topRightId = `${idPrefix}GlowTopRight`;
  const midLeftId = `${idPrefix}GlowMidLeft`;

  return (
    <Svg
      pointerEvents="none"
      width="100%"
      height="100%"
      viewBox="0 0 360 760"
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <LinearGradient id={bgId} x1="0" y1="0" x2="0.15" y2="1">
          <Stop offset="0" stopColor="#D8EFFC" stopOpacity="1" />
          <Stop offset="0.32" stopColor="#EAF2FB" stopOpacity="1" />
          <Stop offset="0.7" stopColor="#F1F5FB" stopOpacity="1" />
          <Stop offset="1" stopColor="#F5F7FC" stopOpacity="1" />
        </LinearGradient>
        <RadialGradient id={topRightId} cx="86%" cy="7%" rx="52%" ry="24%">
          <Stop offset="0" stopColor="#8FD3FA" stopOpacity="0.48" />
          <Stop offset="1" stopColor="#8FD3FA" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={midLeftId} cx="10%" cy="42%" rx="48%" ry="26%">
          <Stop offset="0" stopColor="#E4DCFF" stopOpacity="0.32" />
          <Stop offset="1" stopColor="#E4DCFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="360" height="760" fill={`url(#${bgId})`} />
      <Rect x="0" y="0" width="360" height="760" fill={`url(#${topRightId})`} />
      <Rect x="0" y="0" width="360" height="760" fill={`url(#${midLeftId})`} />
      <Path
        d="M 180 155 C 235 112, 294 102, 360 74 L 360 155 Z"
        fill="#2463EB"
        fillOpacity={0.04}
      />
      <Circle
        cx="328"
        cy="22"
        r="62"
        fill="none"
        stroke="#2463EB"
        strokeOpacity={0.075}
        strokeWidth={1.2}
      />
      <Circle
        cx="328"
        cy="22"
        r="38"
        fill="none"
        stroke="#2463EB"
        strokeOpacity={0.065}
        strokeWidth={1}
      />
      <Circle cx="242" cy="26" r="2.2" fill="#2463EB" fillOpacity={0.11} />
      <Circle cx="256" cy="18" r="1.8" fill="#2463EB" fillOpacity={0.08} />
      <Circle cx="254" cy="34" r="1.6" fill="#2463EB" fillOpacity={0.09} />
      <Circle cx="268" cy="28" r="2" fill="#2463EB" fillOpacity={0.07} />
      <Circle
        cx="22"
        cy="318"
        r="52"
        fill="none"
        stroke="#7C3AED"
        strokeOpacity={0.045}
        strokeWidth={1.1}
      />
    </Svg>
  );
}
