import React, { useEffect, useId, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '@/theme/colors';

type BrandLoaderProps = {
  size?: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

type BrandLoadingOverlayProps = {
  visible: boolean;
  label?: string;
};

/**
 * Single curved vortex petal path in a 64x64 viewBox centered at (32, 32).
 * Rotating 4 copies by 0 / 90 / 180 / 270 deg forms a smooth interlocking iris swirl.
 */
const PETAL_PATH =
  'M 32 9.5 C 44.4 9.5 54.5 19.6 54.5 32 C 54.5 36.1 53.4 39.9 51.5 43.2 C 50.9 35.1 45.1 28.4 37.3 26.5 C 40.7 23.1 42.3 18.2 41.3 13.3 C 38.4 10.9 35.3 9.5 32 9.5 Z';

export function BrandLoader({ size = 46, label, style }: BrandLoaderProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');

  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinAnim = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1150,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 820,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 820,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    spinAnim.start();
    pulseAnim.start();

    return () => {
      spinAnim.stop();
      pulseAnim.stop();
    };
  }, [pulse, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const haloScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.06],
  });

  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.24, 0.56],
  });

  const haloSize = Math.round(size * 1.24);

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.stage, { width: haloSize, height: haloSize }]}>
        {/* Soft breathing brand halo ring */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.layer,
            {
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            },
          ]}
        >
          <Svg width={haloSize} height={haloSize} viewBox="0 0 64 64" fill="none">
            <Defs>
              <LinearGradient id={`halo_${uid}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#00D2FF" />
                <Stop offset="50%" stopColor="#2463EB" />
                <Stop offset="100%" stopColor="#7C4DFF" />
              </LinearGradient>
            </Defs>
            <Circle
              cx="32"
              cy="32"
              r="29"
              stroke={`url(#halo_${uid})`}
              strokeWidth="1.6"
            />
          </Svg>
        </Animated.View>

        {/* Spinning 4-petal brand gradient vortex */}
        <Animated.View style={[styles.layer, { transform: [{ rotate }] }]}>
          <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
            <Defs>
              <LinearGradient id={`p1_${uid}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#00DCFF" />
                <Stop offset="100%" stopColor="#00A6FF" />
              </LinearGradient>
              <LinearGradient id={`p2_${uid}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#1B8CFF" />
                <Stop offset="100%" stopColor="#2463EB" />
              </LinearGradient>
              <LinearGradient id={`p3_${uid}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#4668F7" />
                <Stop offset="100%" stopColor="#7C4DFF" />
              </LinearGradient>
              <LinearGradient id={`p4_${uid}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#00DFC4" />
                <Stop offset="100%" stopColor="#00BDF8" />
              </LinearGradient>
            </Defs>

            <Path d={PETAL_PATH} fill={`url(#p1_${uid})`} />
            <G rotation={90} origin="32, 32">
              <Path d={PETAL_PATH} fill={`url(#p2_${uid})`} />
            </G>
            <G rotation={180} origin="32, 32">
              <Path d={PETAL_PATH} fill={`url(#p3_${uid})`} />
            </G>
            <G rotation={270} origin="32, 32">
              <Path d={PETAL_PATH} fill={`url(#p4_${uid})`} />
            </G>
          </Svg>
        </Animated.View>
      </View>

      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

export function BrandLoadingOverlay({ visible, label }: BrandLoadingOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <BrandLoader size={54} label={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
});
