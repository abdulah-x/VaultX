"use client";

import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AdvisorChat from "@/components/advisor/AdvisorChat";

export default function AdvisorPage() {
 return (
 <ProtectedRoute>
 <AppLayout>
 <div className="h-[calc(100vh-73px)] flex flex-col">
 <AdvisorChat />
 </div>
 </AppLayout>
 </ProtectedRoute>
 );
}
