import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Home, Camera, History, User } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ScreenType } from '../MobileApp';

interface MobileNavigationProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ currentScreen, onNavigate }) => {
  const { theme } = useTheme();
  const { t, isRTL } = useLanguage();
  const isDark = theme === 'dark';
  const styles = getStyles(isDark, isRTL);

  const navItems = [
    { id: 'home', label: t('navigation.home'), icon: Home },
    { id: 'history', label: t('navigation.history'), icon: History },
    { id: 'camera', label: t('navigation.camera'), icon: Camera, isCenter: true },
    { id: 'profile', label: t('navigation.profile'), icon: User },
  ];

  return (
    <View style={styles.container}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentScreen === item.id;
        const color = isActive && !item.isCenter ? '#10b981' : (item.isCenter ? '#fff' : (isDark ? '#9ca3af' : '#6b7280'));

        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.tab, item.isCenter && styles.centerTab]}
            onPress={() => onNavigate(item.id as ScreenType)}
          >
            <Icon size={item.isCenter ? 30 : 24} color={color} strokeWidth={isActive ? 2.5 : 2} />
            <Text style={[styles.tabLabel, { color }]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: isDark ? '#18181b' : '#ffffff',
    borderTopWidth: 1,
    borderTopColor: isDark ? '#27272a' : '#e4e4e7',
    paddingBottom: 20, // Safe area padding
    paddingTop: 8,
    paddingHorizontal: 8,
    height: 80,
    alignItems: 'flex-start',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  centerTab: {
    marginTop: -25,
    backgroundColor: '#10b981',
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default MobileNavigation;