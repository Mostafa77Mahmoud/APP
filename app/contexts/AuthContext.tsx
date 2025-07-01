import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { authApi, LoginCredentials, SignupCredentials, User } from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isGuestMode: boolean;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        const token = await AsyncStorage.getItem('auth_token');
        
        if (storedUser && token) {
          setUser(JSON.parse(storedUser));
          setIsGuestMode(false);
        } else {
          // Default to guest mode if no session
          setIsGuestMode(true);
        }
      } catch (e) {
        console.error("Failed to load auth state", e);
        setIsGuestMode(true);
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(credentials);
      
      setUser(response.user);
      await AsyncStorage.setItem('user', JSON.stringify(response.user));
      await AsyncStorage.setItem('auth_token', response.token);
      
      setIsGuestMode(false);
      
      Alert.alert("Login Successful", "Welcome back to Shariaa Analyzer");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check your credentials";
      Alert.alert("Login Failed", message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (credentials: SignupCredentials) => {
    setIsLoading(true);
    try {
      const response = await authApi.signup(credentials);
      
      setUser(response.user);
      await AsyncStorage.setItem('user', JSON.stringify(response.user));
      await AsyncStorage.setItem('auth_token', response.token);
      
      setIsGuestMode(false);
      
      Alert.alert("Account Created", "Welcome to Shariaa Analyzer");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again";
      Alert.alert("Signup Failed", message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      setUser(null);
      setIsGuestMode(true); // Revert to guest mode after logout
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('auth_token');
      
      Alert.alert("Logged Out", "Come back soon!");
    }
  };

  const continueAsGuest = () => {
    setIsGuestMode(true);
    setUser(null);
    Alert.alert("Guest Mode", "You can explore limited features");
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated: !!user || isGuestMode, 
      user, 
      login, 
      signup, 
      logout, 
      isLoading,
      isGuestMode,
      continueAsGuest
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
export default AuthProvider;
export { AuthContext }; 
// This context provides authentication state and methods for login, signup, logout, and guest mode handling