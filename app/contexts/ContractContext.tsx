
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Contract {
  id: string;
  title: string;
  content: string;
  analysisDate: string;
  complianceScore: number;
  analysisResult?: any;
}

interface ContractContextType {
  contracts: Contract[];
  addContract: (contract: Contract) => void;
  removeContract: (id: string) => void;
  updateContract: (id: string, updates: Partial<Contract>) => void;
  getContract: (id: string) => Contract | undefined;
  clearAllContracts: () => void;
}

const ContractContext = createContext<ContractContextType | undefined>(undefined);

export const ContractProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    try {
      const data = await AsyncStorage.getItem('shariaa_contracts');
      if (data) {
        setContracts(JSON.parse(data));
      }
    } catch (error) {
      console.error('Error loading contracts:', error);
    }
  };

  const saveContracts = async (newContracts: Contract[]) => {
    try {
      await AsyncStorage.setItem('shariaa_contracts', JSON.stringify(newContracts));
    } catch (error) {
      console.error('Error saving contracts:', error);
    }
  };

  const addContract = (contract: Contract) => {
    const newContracts = [contract, ...contracts];
    setContracts(newContracts);
    saveContracts(newContracts);
  };

  const removeContract = (id: string) => {
    const newContracts = contracts.filter(contract => contract.id !== id);
    setContracts(newContracts);
    saveContracts(newContracts);
  };

  const updateContract = (id: string, updates: Partial<Contract>) => {
    const newContracts = contracts.map(contract =>
      contract.id === id ? { ...contract, ...updates } : contract
    );
    setContracts(newContracts);
    saveContracts(newContracts);
  };

  const getContract = (id: string) => {
    return contracts.find(contract => contract.id === id);
  };

  const clearAllContracts = () => {
    setContracts([]);
    saveContracts([]);
  };

  return (
    <ContractContext.Provider
      value={{
        contracts,
        addContract,
        removeContract,
        updateContract,
        getContract,
        clearAllContracts,
      }}
    >
      {children}
    </ContractContext.Provider>
  );
};

export const useContract = () => {
  const context = useContext(ContractContext);
  if (context === undefined) {
    throw new Error('useContract must be used within a ContractProvider');
  }
  return context;
};
export default ContractProvider;
export {ContractContext};
// This context provides a way to manage contracts in the application, allowing for adding, removing,