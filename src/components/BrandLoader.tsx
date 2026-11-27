import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

let globalOverlayCount = 0;
const overlayListeners = new Set<(count: number) => void>();

function updateGlobalOverlay(delta: number) {
  globalOverlayCount = Math.max(0, globalOverlayCount + delta);
  overlayListeners.forEach((listener) => listener(globalOverlayCount));
}

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

export function BrandLoader({ size = 46, style }: BrandLoaderProps) {
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
              width: haloSize,
              height: haloSize,
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
        <Animated.View
          style={[
            styles.layer,
            {
              width: size,
              height: size,
              transform: [{ rotate }],
            },
          ]}
        >
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
    </View>
  );
}

/**
 * Mounts into the root-level BrandLoadingHost so every screen shows the spinner
 * at the exact same dead-center (50%, 50%) viewport coordinate.
 */
export function BrandLoadingOverlay({ visible }: BrandLoadingOverlayProps) {
  useEffect(() => {
    if (!visible) return;
    updateGlobalOverlay(1);
    return () => updateGlobalOverlay(-1);
  }, [visible]);

  return null;
}

/** Drop-in page-level loader that always renders dead-center of the device screen. */
export function CenteredPageLoader() {
  return <BrandLoadingOverlay visible />;
}

/** Single root host rendered in src/app/_layout.tsx to guarantee pixel-identical centering. */
export function BrandLoadingHost() {
  const [count, setCount] = useState(globalOverlayCount);

  useEffect(() => {
    setCount(globalOverlayCount);
    overlayListeners.add(setCount);
    return () => {
      overlayListeners.delete(setCount);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <BrandLoader size={52} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
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
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
});
