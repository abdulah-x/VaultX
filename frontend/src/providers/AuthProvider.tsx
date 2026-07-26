'use client';

import React, { ReactNode, useEffect } from 'react';
import { useAuthState } from '@/hooks/useAuth';

interface AuthProviderProps {
 children: ReactNode;
}

const AuthContext = React.createContext<ReturnType<typeof useAuthState> | undefined>(undefined);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
 const auth = useAuthState();

 // A successful mount of the root layout means the current bundle loaded
 // fine, so clear the chunk-error reload guard (lib/chunkErrorRecovery) --
 // otherwise a real, later chunk error on a future stale tab would be seen
 // as "already tried reloading" and skip straight to the error fallback
 // instead of self-healing.
 useEffect(() => {
 window.sessionStorage.removeItem('vaultx_chunk_reload_attempted');
 }, []);

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