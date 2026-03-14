/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#7A9E7E'; // Sage Green
const tintColorDark = '#7A9E7E';

export const AppColors = {
  primary: '#7A9E7E',    // Sage Green
  background: '#F4F1EA', // Warm Cream
  text: '#2E2E2E',       // Charcoal
  accent: '#C2A85C',     // Muted Gold
  surface: '#FFFFFF',    // Surface white
  border: '#E8E3D8',     // Light cream border
  subtleText: '#6B7280', // Gray text
};

export const Colors = {
  light: {
    text: AppColors.text,
    background: AppColors.background,
    tint: tintColorLight,
    icon: AppColors.subtleText,
    tabIconDefault: AppColors.subtleText,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: AppColors.text,
    background: AppColors.background,
    tint: tintColorDark,
    icon: AppColors.subtleText,
    tabIconDefault: AppColors.subtleText,
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
