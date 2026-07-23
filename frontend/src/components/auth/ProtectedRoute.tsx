'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';

interface ProtectedRouteProps {
 children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
 const { isAuthenticated, isLoading, user } = useAuth();
 const router = useRouter();

 useEffect(() => {
 if (!isLoading) {
 if (!isAuthenticated) {
 router.push('/login');
 } else if (user) {
 // Check if user needs onboarding
 const hasCompletedOnboarding = user.hasCompletedOnboarding || localStorage.getItem('hasCompletedOnboarding') === 'true';
 
 if (!hasCompletedOnboarding && window.location.pathname === '/dashboard') {
 router.push('/onboarding');
 }
 }
 }
 }, [isAuthenticated, isLoading, user, router]);

 // Show loading spinner while checking auth status
 if (isLoading) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="text-center">
 <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mb-4 mx-auto animate-pulse">
 <span className="text-foreground font-bold text-xl">🔒</span>
 </div>
 <div className="text-foreground text-lg font-medium">Authenticating...</div>
 <div className="text-muted-foreground text-sm mt-2">Please wait while we verify your session</div>
 </div>
 </div>
 );
 }

 // Show nothing while redirecting unauthenticated users
 if (!isAuthenticated) {
 return null;
 }

 // User is authenticated, show the protected content
 return <>{children}</>;
}