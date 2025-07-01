import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import { SessionProvider } from './contexts/SessionContext';
import { ContractProvider } from './contexts/ContractContext';
import MobileApp from './MobileApp';

// This component is the root of your application.
// All other components will be rendered as children of this layout.
export default function RootLayout() {
  return (
    // The order of providers is important.
    // Theme and Language should be high up.
    // AuthProvider provides user state.
    // SessionProvider depends on AuthProvider to know if the user is a guest or logged in.
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <SessionProvider>
            <ContractProvider>
              <View style={styles.container}>
                <MobileApp />
              </View>
            </ContractProvider>
          </SessionProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});