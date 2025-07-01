import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  disabled?: boolean;
  isLoading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  variant = 'default',
  disabled = false,
  isLoading = false,
  style,
  textStyle,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(isDark);

  const isDisabled = disabled || isLoading;

  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'default' || variant === 'destructive' ? '#fff' : (isDark ? '#fff' : '#000')} />
      ) : (
        <>{children}</>
      )}
    </TouchableOpacity>
  );
};

const getStyles = (isDark: boolean) => StyleSheet.create({
  base: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  default: { backgroundColor: '#10b981' },
  destructive: { backgroundColor: '#ef4444' },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: isDark ? '#4b5563' : '#d1d5db' },
  secondary: { backgroundColor: isDark ? '#374151' : '#f3f4f6' },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.6 },
});
export default Button;
// This component provides a customizable button with different styles and loading states.