import React, { useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function ShopCardSkeleton() {
  return (
    <React.Fragment>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={{
            flexDirection: 'row',
            padding: 12,
            marginTop: 9,
            gap: 10,
            alignItems: 'center',
            borderRadius: 4,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            backgroundColor: '#ffffff',
          }}
        >
          <Skeleton width={42} height={42} borderRadius={6} />
          <Animated.View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="80%" height={10} />
            <Skeleton width="40%" height={10} />
          </Animated.View>
        </Animated.View>
      ))}
    </React.Fragment>
  );
}
