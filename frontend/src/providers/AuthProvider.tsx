'use client';

import React, { ReactNode } from 'react';
import { useAuthState } from '@/hooks/useAuth';

interface AuthProviderProps {
 children: ReactNode;
}

const AuthContext = React.createContext<ReturnType<typeof useAuthState> | undefined>(undefined);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
 const auth = useAuthState();

 return (
 <AuthContext.Provider value={auth}>
 {children}
 </AuthContext.Provider>
 );
};

export const useAuth = () => {
 const context = React.useContext(AuthContext);
 if (context === undefined) {
 throw new Error('useAuth must be used within an AuthProvider');
 }
 return context;
};