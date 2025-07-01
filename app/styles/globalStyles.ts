
import { StyleSheet } from 'react-native';

export const globalStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Card styles matching web app
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardDark: {
    backgroundColor: '#1f2937',
    shadowColor: '#000',
    shadowOpacity: 0.3,
  },
  
  // Glass effect styles
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(10px)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  glassCardDark: {
    backgroundColor: 'rgba(31, 41, 55, 0.8)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  
  // Text styles
  heading1: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
  },
  heading2: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
  },
  heading3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  heading4: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
  },
  bodyTextSmall: {
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
  },
  
  // Color styles
  textPrimary: {
    color: '#111827',
  },
  textPrimaryDark: {
    color: '#f9fafb',
  },
  textSecondary: {
    color: '#6b7280',
  },
  textSecondaryDark: {
    color: '#9ca3af',
  },
  textSuccess: {
    color: '#10b981',
  },
  textError: {
    color: '#ef4444',
  },
  textWarning: {
    color: '#f59e0b',
  },
  
  // Button styles matching web app
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonPrimary: {
    backgroundColor: '#10b981',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  buttonSecondaryDark: {
    borderColor: '#4b5563',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextPrimary: {
    color: '#ffffff',
  },
  buttonTextSecondary: {
    color: '#374151',
  },
  buttonTextSecondaryDark: {
    color: '#f9fafb',
  },
  
  // Input styles
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  inputDark: {
    borderColor: '#4b5563',
    backgroundColor: '#374151',
    color: '#f9fafb',
  },
  inputFocused: {
    borderColor: '#10b981',
    borderWidth: 2,
  },
  
  // Background gradients (approximated with colors)
  backgroundGradient: {
    backgroundColor: '#f9fafb',
  },
  backgroundGradientDark: {
    backgroundColor: '#0a0a0a',
  },
  
  // Spacing utilities
  marginBottom8: {
    marginBottom: 8,
  },
  marginBottom16: {
    marginBottom: 16,
  },
  marginBottom24: {
    marginBottom: 24,
  },
  marginTop8: {
    marginTop: 8,
  },
  marginTop16: {
    marginTop: 16,
  },
  marginTop24: {
    marginTop: 24,
  },
  paddingHorizontal16: {
    paddingHorizontal: 16,
  },
  paddingVertical8: {
    paddingVertical: 8,
  },
  paddingVertical16: {
    paddingVertical: 16,
  },
  
  // RTL support
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  ltrText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  
  // Animation styles (for consistent transitions)
  fadeIn: {
    opacity: 1,
  },
  fadeOut: {
    opacity: 0,
  },
  
  // Border styles
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  borderBottomDark: {
    borderBottomColor: '#374151',
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  borderTopDark: {
    borderTopColor: '#374151',
  },
});

// Color constants matching web app
export const colors = {
  primary: '#10b981',
  primaryLight: '#d1fae5',
  secondary: '#6b7280',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  white: '#ffffff',
  black: '#000000',
  
  // Gray scale
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  
  // Dark mode colors
  dark: {
    background: '#0a0a0a',
    card: '#1f2937',
    border: '#374151',
    text: '#f9fafb',
    textSecondary: '#9ca3af',
  },
};

// Consistent spacing
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
};

// Typography scale
export const typography = {
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};
export default globalStyles;
// This file provides global styles for the application, including container styles, text styles, button styles