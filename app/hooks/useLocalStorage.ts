
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadValue = async () => {
      try {
        const item = await AsyncStorage.getItem(key);
        const value = item ? JSON.parse(item) : initialValue;
        setStoredValue(value);
      } catch (error) {
        console.error(`Error loading ${key} from AsyncStorage:`, error);
        setStoredValue(initialValue);
      } finally {
        setLoading(false);
      }
    };

    loadValue();
  }, [key, initialValue]);

  const setValue = async (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      await AsyncStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error saving ${key} to AsyncStorage:`, error);
    }
  };

  const removeValue = async () => {
    try {
      await AsyncStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error(`Error removing ${key} from AsyncStorage:`, error);
    }
  };

  return [storedValue, setValue, removeValue, loading] as const;
}
export default useLocalStorage;
// This custom hook provides a way to manage local storage with React state, allowing for easy retrieval