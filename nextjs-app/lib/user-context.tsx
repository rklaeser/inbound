'use client';

import { createContext, useContext, ReactNode } from 'react';

interface UserContextType {
  userName: string;
  userEmail?: string;
}

const UserContext = createContext<UserContextType>({
  userName: 'Ryan',
  userEmail: 'ryan@example.com',
});

export function UserProvider({ children }: { children: ReactNode }) {
  // For now, hardcode the user. In production, this would come from auth
  const user: UserContextType = {
    userName: 'Ryan',
    userEmail: 'ryan@example.com',
  };

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
