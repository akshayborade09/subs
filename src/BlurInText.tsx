import { useEffect } from 'react';
import { StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

type By = 'word' | 'character' | 'line';

type BlurInTextProps = {
  children: string;
  by?: By;
  duration?: number;
  delayStep?: number;
  startDelay?: number;
  style?: TextStyle;
  containerStyle?: ViewStyle;
  animateKey?: string | number;
};

function splitText(text: string, by: By): string[] {
  if (by === 'line') return text.split('\n');
  if (by === 'character') return text.split('');
  return text.split(/\s+/).filter(Boolean);
}

function AnimatedItem({
  item,
  index,
  by,
  duration,
  delayStep,
  startDelay,
  style,
  animateKey,
  trailingSpace = false,
}: {
  item: string;
  index: number;
  by: By;
  duration: number;
  delayStep: number;
  startDelay: number;
  style?: TextStyle;
  animateKey?: string | number;
  trailingSpace?: boolean;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);
  const scale = useSharedValue(0.94);

  useEffect(() => {
    cancelAnimation(opacity);
    cancelAnimation(translateY);
    cancelAnimation(scale);
    opacity.value = 0;
    translateY.value = 12;
    scale.value = 0.94;
    const delay = startDelay + index * delayStep;
    const easing = Easing.out(Easing.cubic);
    opacity.value = withDelay(delay, withTiming(1, { duration, easing }));
    translateY.value = withDelay(delay, withTiming(0, { duration, easing }));
    scale.value = withDelay(delay, withTiming(1, { duration, easing }));
  }, [animateKey, delayStep, duration, index, opacity, scale, startDelay, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.Text style={[style, animatedStyle]}>
      {item}
      {trailingSpace ? ' ' : ''}
    </Animated.Text>
  );
}

export function BlurInText({
  children,
  by = 'word',
  duration = 500,
  delayStep = 60,
  startDelay = 0,
  style,
  containerStyle,
  animateKey = 0,
}: BlurInTextProps) {
  const items = splitText(children, by);

  if (by === 'line') {
    return (
      <View style={containerStyle}>
        {items.map((line, index) => (
          <AnimatedItem
            key={`${animateKey}-${line}-${index}`}
            item={line}
            index={index}
            by={by}
            duration={duration}
            delayStep={delayStep}
            startDelay={startDelay}
            style={{ ...styles.block, ...style }}
            animateKey={animateKey}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.row, containerStyle]}>
      {items.map((item, index) => (
        <AnimatedItem
          key={`${animateKey}-${item}-${index}`}
          item={item}
          index={index}
          by={by}
          duration={duration}
          delayStep={delayStep}
          startDelay={startDelay}
          style={style}
          animateKey={animateKey}
          trailingSpace={by === 'word' && index < items.length - 1}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  block: {
    width: '100%',
  },
});

export default BlurInText;
