"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

function ResetPasswordForm() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const token = searchParams.get('token');

 const [password, setPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [showPassword, setShowPassword] = useState(false);
 const [showConfirmPassword, setShowConfirmPassword] = useState(false);
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState("");
 const [success, setSuccess] = useState(false);
 const [validationErrors, setValidationErrors] = useState<string[]>([]);

 useEffect(() => {
 if (!token) {
 setError("Invalid or missing reset token");
 }
 }, [token]);

 const validatePassword = (pwd: string): string[] => {
 const errors: string[] = [];
 if (pwd.length < 8) errors.push("At least 8 characters long");
 if (!/[A-Z]/.test(pwd)) errors.push("One uppercase letter");
 if (!/[a-z]/.test(pwd)) errors.push("One lowercase letter");
 if (!/\d/.test(pwd)) errors.push("One number");
 return errors;
 };

 const handlePasswordChange = (value: string) => {
 setPassword(value);
 setValidationErrors(validatePassword(value));
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError("");

 // Validate passwords match
 if (password !== confirmPassword) {
 setError("Passwords do not match");
 return;
 }

 // Validate password strength
 const errors = validatePassword(password);
 if (errors.length > 0) {
 setError("Password does not meet requirements");
 return;
 }

 if (!token) {
 setError("Invalid reset token");
 return;
 }

 setIsLoading(true);

 try {
 const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/reset-password`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 token,
 new_password: password
 }),
 });

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.detail || 'Failed to reset password');
 }

 setSuccess(true);
 
 // Redirect to login after 3 seconds
 setTimeout(() => {
 router.push('/login');
 }, 3000);
 
 } catch (err: any) {
 setError(err.message || "Failed to reset password");
 } finally {
 setIsLoading(false);
 }
 };

 if (success) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center p-4">
 <div className="absolute inset-0 overflow-hidden">
 <div className="absolute inset-0 via-transparent "></div>
 <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.05)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
 </div>

 <div className="relative z-10 w-full max-w-md">
 <div className="bg-secondary backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl text-center">
 <div className="w-16 h-16 bg-vaultx-success rounded-full flex items-center justify-center mx-auto mb-4">
 <CheckCircle2 className="h-8 w-8 text-foreground" />
 </div>
 <h1 className="text-3xl font-bold text-foreground mb-4">
 Password Reset Successful!
 </h1>
 <p className="text-muted-foreground mb-6">
 Your password has been successfully reset. You can now log in with your new password.
 </p>
 <p className="text-sm text-muted-foreground">
 Redirecting to login page...
 </p>
 </div>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-background flex items-center justify-center p-4">
 {/* Background Effects */}
 <div className="absolute inset-0 overflow-hidden">
 <div className="absolute inset-0 via-transparent "></div>
 <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.05)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
 </div>

 <div className="relative z-10 w-full max-w-md">
 {/* Main Card */}
 <div className="bg-secondary backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl">
 {/* Header */}
 <div className="text-center mb-8">
 <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
 <Lock className="h-8 w-8 text-foreground" />
 </div>
 <h1 className="text-3xl font-bold text-foreground mb-2">
 Reset Password
 </h1>
 <p className="text-muted-foreground">
 Enter your new password below
 </p>
 </div>

 {/* Form */}
 <form onSubmit={handleSubmit} className="space-y-6">
 {error && (
 <div className="bg-vaultx-danger/10 border border-vaultx-danger/40 rounded-lg p-4 text-vaultx-danger text-sm flex items-start gap-3">
 <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
 <span>{error}</span>
 </div>
 )}

 {/* New Password */}
 <div>
 <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
 New Password
 </label>
 <div className="relative">
 <input
 type={showPassword ? "text" : "password"}
 id="password"
 value={password}
 onChange={(e) => handlePasswordChange(e.target.value)}
 required
 className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-12"
 placeholder="Enter new password"
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
 >
 {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
 </button>
 </div>

 {/* Password Requirements */}
 {password && (
 <div className="mt-3 space-y-2">
 <p className="text-xs text-muted-foreground font-medium">Password must contain:</p>
 <div className="space-y-1">
 {[
 { text: "At least 8 characters", valid: password.length >= 8 },
 { text: "One uppercase letter", valid: /[A-Z]/.test(password) },
 { text: "One lowercase letter", valid: /[a-z]/.test(password) },
 { text: "One number", valid: /\d/.test(password) },
 ].map((req, idx) => (
 <div key={idx} className="flex items-center gap-2">
 <div className={`h-1.5 w-1.5 rounded-full ${req.valid ? 'bg-vaultx-success' : 'bg-secondary'}`} />
 <span className={`text-xs ${req.valid ? 'text-vaultx-success' : 'text-muted-foreground'}`}>
 {req.text}
 </span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* Confirm Password */}
 <div>
 <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
 Confirm Password
 </label>
 <div className="relative">
 <input
 type={showConfirmPassword ? "text" : "password"}
 id="confirmPassword"
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 required
 className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-12"
 placeholder="Confirm new password"
 />
 <button
 type="button"
 onClick={() => setShowConfirmPassword(!showConfirmPassword)}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
 >
 {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
 </button>
 </div>
 {confirmPassword && password !== confirmPassword && (
 <p className="mt-2 text-xs text-vaultx-danger">Passwords do not match</p>
 )}
 </div>

 {/* Submit Button */}
 <button
 type="submit"
 disabled={isLoading || !token || validationErrors.length > 0 || password !== confirmPassword}
 className="w-full bg-primary text-foreground font-semibold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {isLoading ? (
 <span className="flex items-center justify-center gap-2">
 <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 Resetting Password...
 </span>
 ) : (
 'Reset Password'
 )}
 </button>

 {/* Back to Login */}
 <div className="text-center">
 <Link 
 href="/login" 
 className="text-sm text-vaultx-secondary hover:text-muted-foreground transition-colors"
 >
 Back to Login
 </Link>
 </div>
 </form>
 </div>
 </div>
 </div>
 );
}

export default function ResetPasswordPage() {
 return (
 <Suspense fallback={
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
 </div>
 }>
 <ResetPasswordForm />
 </Suspense>
 );
}
