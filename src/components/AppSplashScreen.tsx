import { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const IGEN_LOGO = require('../../assets/images/logo-igen.png');

type AppSplashScreenProps = {
  fadingOut: boolean;
  onFadeComplete: () => void;
};

export function AppSplashScreen({ fadingOut, onFadeComplete }: AppSplashScreenProps) {
  const insets = useSafeAreaInsets();

  const containerOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 360,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [logoOpacity, logoScale]);

  useEffect(() => {
    if (!fadingOut) return;
    Animated.timing(containerOpacity, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFadeComplete();
    });
  }, [containerOpacity, fadingOut, onFadeComplete]);

  return (
    <Animated.View
      pointerEvents={fadingOut ? 'none' : 'auto'}
      style={[styles.overlay, { opacity: containerOpacity }]}
    >
      <StatusBar style="dark" />

      <View style={styles.center}>
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          <Image
            source={IGEN_LOGO}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 20, 30) }]}>
        <Text style={styles.copyright}>Copyright © 2026 iGen Technology</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    zIndex: 999,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 170,
    height: 70,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  copyright: {
    fontSize: 11.5,
    fontWeight: '300',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
});
