import { Platform } from 'react-native';
import { Extrapolation, interpolate, interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

type HeroScrollSheetMotionConfig = {
  scrollY: SharedValue<number>;
  collapseRange: number;
  initialSheetTop: number;
  dockedSheetTop: number;
  heroHeight: number;
  surfaceColor: string;
  canvasColor: string;
};

export function useHeroScrollSheetMotion({
  scrollY,
  collapseRange,
  initialSheetTop,
  dockedSheetTop,
  heroHeight,
  surfaceColor,
  canvasColor,
}: HeroScrollSheetMotionConfig) {
  const android = Platform.OS === 'android';
  const sheetRestOffset = initialSheetTop - dockedSheetTop;

  const rootBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(scrollY.value, [0, collapseRange], [surfaceColor, canvasColor]),
  }));

  const heroAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.min(scrollY.value, collapseRange);
    if (android) {
      return {
        opacity: interpolate(progress, [0, collapseRange * 0.9], [1, 0], Extrapolation.CLAMP),
      };
    }
    return {
      opacity: interpolate(progress, [0, collapseRange * 0.85], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(progress, [0, collapseRange], [0, -heroHeight * 0.75], Extrapolation.CLAMP) },
        { scale: interpolate(progress, [0, collapseRange], [1, 0.5], Extrapolation.CLAMP) },
      ],
    };
  });

  const sheetPositionStyle = useAnimatedStyle(() => {
    const progress = Math.min(scrollY.value, collapseRange);
    if (android) {
      return {
        top: dockedSheetTop,
        transform: [{ translateY: sheetRestOffset - progress }],
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      };
    }
    return {
      top: initialSheetTop - progress,
      borderTopLeftRadius: interpolate(progress, [0, collapseRange], [20, 0], Extrapolation.CLAMP),
      borderTopRightRadius: interpolate(progress, [0, collapseRange], [20, 0], Extrapolation.CLAMP),
    };
  });

  const contentLiftStyle = useAnimatedStyle(() => {
    const progress = Math.min(scrollY.value, collapseRange);
    if (android) {
      return {
        transform: [{ translateY: progress - collapseRange }],
      };
    }
    return {
      marginTop: -collapseRange + progress,
    };
  });

  return {
    rootOverflow: android ? 'hidden' as const : 'visible' as const,
    heroOverflow: android ? 'hidden' as const : 'visible' as const,
    rootBgStyle,
    heroAnimatedStyle,
    sheetPositionStyle,
    contentLiftStyle,
  };
}
