import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export const DEFAULT_LOAD_MORE_LIMIT = 50;

/**
 * Returns true when a ScrollView is scrolled within `threshold` px of the bottom.
 */
export function isCloseToBottom(
  event: NativeSyntheticEvent<NativeScrollEvent>,
  threshold = 240,
): boolean {
  const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
  if (!contentSize.height || !layoutMeasurement.height) return false;
  return layoutMeasurement.height + contentOffset.y >= contentSize.height - threshold;
}
