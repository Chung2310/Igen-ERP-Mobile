import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

const SPLASH_HERO = require('../../assets/images/splash-igen-hero.jpg');
const IGEN_FULL_LOGO = require('../../assets/images/logo-igenerp.png');

type AppSplashScreenProps = {
  fadingOut: boolean;
  onFadeComplete: () => void;
};

export function AppSplashScreen({ fadingOut, onFadeComplete }: AppSplashScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  const containerOpacity = useRef(new Animated.Value(1)).current;
  const heroScale = useRef(new Animated.Value(0.96)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandTranslateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.spring(heroScale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(160),
        Animated.parallel([
          Animated.timing(brandOpacity, {
            toValue: 1,
            duration: 420,
            useNativeDriver: true,
          }),
          Animated.timing(brandTranslateY, {
            toValue: 0,
            duration: 420,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [brandOpacity, brandTranslateY, heroOpacity, heroScale]);

  useEffect(() => {
    if (!fadingOut) return;
    Animated.timing(containerOpacity, {
      toValue: 0,
      duration: 320,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFadeComplete();
    });
  }, [containerOpacity, fadingOut, onFadeComplete]);

  // Keep hero ~56% of viewport height so the robot + sky match the reference ratio across phones.
  const heroHeight = Math.min(Math.round(screenHeight * 0.56), Math.round(screenWidth * 1.34));

  return (
    <Animated.View
      pointerEvents={fadingOut ? 'none' : 'auto'}
      style={[styles.overlay, { opacity: containerOpacity }]}
    >
      <StatusBar style="light" />

      {/* Top sky-blue hero with floating iGen robot */}
      <View style={[styles.heroContainer, { height: heroHeight }]}>
        <Animated.Image
          source={SPLASH_HERO}
          resizeMode="cover"
          style={[
            styles.heroImage,
            {
              opacity: heroOpacity,
              transform: [{ scale: heroScale }],
            },
          ]}
        />
        {/* Seamless bottom feather into pure white */}
        <Svg
          pointerEvents="none"
          width="100%"
          height={64}
          style={styles.bottomFeather}
        >
          <Defs>
            <LinearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="64" fill="url(#heroFade)" />
        </Svg>
      </View>

      {/* Center brand lockup: official iGen ERP logo + tagline */}
      <Animated.View
        style={[
          styles.brandBlock,
          {
            opacity: brandOpacity,
            transform: [{ translateY: brandTranslateY }],
          },
        ]}
      >
        <Image
          source={IGEN_FULL_LOGO}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.tagline}>
          Điều hành cả doanh nghiệp trên một hệ thống
        </Text>
      </Animated.View>

      {/* Footer copyright */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 18, 28) }]}>
        <Text style={styles.footerBrand}>
          <Text style={styles.footerBrandAccent}>iGen</Text> Technology
        </Text>
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
    justifyContent: 'space-between',
  },
  heroContainer: {
    width: '100%',
    backgroundColor: '#126DFB',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  bottomFeather: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  brandBlock: {
    alignItems: 'center',
    paddingHorizontal: 28,
    marginTop: -6,
  },
  logoImage: {
    width: 215,
    height: 66,
  },
  tagline: {
    marginTop: 8,
    color: '#4B5565',
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  footer: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 20,
  },
  footerBrand: {
    fontSize: 13,
    fontWeight: '800',
    color: '#17233B',
    letterSpacing: 0.3,
  },
  footerBrandAccent: {
    color: '#00AEF0',
  },
  copyright: {
    fontSize: 11,
    color: '#8A96A8',
    fontWeight: '500',
  },
});
