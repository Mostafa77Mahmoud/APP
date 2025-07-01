// app/contexts/LanguageContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, I18nManager } from 'react-native';
import * as Updates from 'expo-updates';

// Import translations from locale files
import en from '../locales/en.json';
import ar from '../locales/ar.json';
import { de } from 'zod/v4/locales';

const translations = { en, ar };

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dir: 'ltr' | 'rtl';
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Helper function to get nested keys
const getNestedTranslation = (obj: any, key: string): string | undefined => {
  return key.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
};


export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem('shariaa_language') as Language;
        if (savedLanguage && ['en', 'ar'].includes(savedLanguage)) {
          setLanguageState(savedLanguage);
          const isRTL = savedLanguage === 'ar';
          I18nManager.forceRTL(isRTL);
          I18nManager.allowRTL(isRTL);
        }
      } catch (e) {
        console.error("Failed to load language from storage", e);
      }
    };
    loadLanguage();
  }, []);

  const setLanguage = async (lang: Language) => {
    try {
      setLanguageState(lang);
      await AsyncStorage.setItem('shariaa_language', lang);
      const isRTL = lang === 'ar';
      
      // This is crucial for RTL changes to apply correctly in React Native
      I18nManager.forceRTL(isRTL);
      I18nManager.allowRTL(isRTL);
      
      // Reload the app to apply RTL layout changes.
      // This provides a more consistent experience than trying to dynamically update the layout.
      await Updates.reloadAsync();

    } catch (e) {
      console.error("Failed to set language and reload", e)
      Alert.alert("Error", "Could not switch language. Please restart the app.");
    }
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const langTranslations = translations[language];
    const fallbackTranslations = translations.en;

    let translation = getNestedTranslation(langTranslations, key) || getNestedTranslation(fallbackTranslations, key) || key;

    if (params) {
      Object.keys(params).forEach(paramKey => {
        translation = translation.replace(`{{${paramKey}}}`, String(params[paramKey]));
      });
    }
    return translation;
  };

  const isRTL = language === 'ar';
  const dir = isRTL ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
export default LanguageProvider;

export { LanguageContext, translations, Language };