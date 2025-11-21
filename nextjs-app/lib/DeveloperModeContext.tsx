'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface DeveloperModeContextType {
  isDeveloperMode: boolean;
  toggleDeveloperMode: () => void;
}

const DeveloperModeContext = createContext<DeveloperModeContextType | undefined>(undefined);

export function DeveloperModeProvider({ children }: { children: ReactNode }) {
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('developerMode');
    if (stored === 'true') {
      setIsDeveloperMode(true);
    }
  }, []);

  const toggleDeveloperMode = () => {
    setIsDeveloperMode((prev) => {
      const newValue = !prev;
      localStorage.setItem('developerMode', String(newValue));
      return newValue;
    });
  };

  return (
    <DeveloperModeContext.Provider value={{ isDeveloperMode, toggleDeveloperMode }}>
      {children}
    </DeveloperModeContext.Provider>
  );
}

export function useDeveloperMode() {
  const context = useContext(DeveloperModeContext);
  if (context === undefined) {
    throw new Error('useDeveloperMode must be used within a DeveloperModeProvider');
  }
  return context;
}
