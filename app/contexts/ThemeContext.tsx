import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import e from 'express';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isTransitioning: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemTheme = useColorScheme() || 'light';
  const [theme, setTheme] = useState<Theme>(systemTheme);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem('shariaa_theme') as Theme;
      if (savedTheme) {
        setTheme(savedTheme);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    setIsTransitioning(true);
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    await AsyncStorage.setItem('shariaa_theme', newTheme);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isTransitioning }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
export default ThemeProvider;
export { ThemeContext };
// This context provides a way to manage the application's theme, allowing for toggling between light and