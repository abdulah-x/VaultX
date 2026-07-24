"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, CheckCircle2, AlertCircle } from "lucide-react";

export default function VerifyEmailPage() {
 const router = useRouter();
 const [otp, setOtp] = useState("");
 const [email, setEmail] = useState("");
 const [isLoading, setIsLoading] = useState(false);
 const [isSending, setIsSending] = useState(false);
 const [error, setError] = useState("");
 const [success, setSuccess] = useState(false);
 const [resendMessage, setResendMessage] = useState("");

 const handleResend = async () => {
 if (!email) {
 setError("Please enter your email address");
 return;
 }

 setIsSending(true);
 setError("");
 setResendMessage("");

 try {
 const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/send-verification`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({ email }),
 });

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.detail || 'Failed to send verification code');
 }

 setResendMessage("Verification code sent! Check your email.");
 setTimeout(() => setResendMessage(""), 5000);
 } catch (err: any) {
 setError(err.message || "Failed to send verification code");
 } finally {
 setIsSending(false);
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError("");

 if (!email || !otp) {
 setError("Please enter both email and verification code");
 return;
 }

 setIsLoading(true);

 try {
 const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify-email`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({ email, otp }),
 });

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.detail || 'Verification failed');
 }

 setSuccess(true);
 
 // Redirect to dashboard after 2 seconds
 setTimeout(() => {
 router.push('/dashboard');
 }, 2000);
 
 } catch (err: any) {
 setError(err.message || "Verification failed");
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
 Email Verified!
 </h1>
 <p className="text-muted-foreground mb-6">
 Your email has been successfully verified. Redirecting to dashboard...
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
 {/* Back to Login Link */}
 <Link 
 href="/login" 
 className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
 >
 ← Back to Login
 </Link>

 {/* Main Card */}
 <div className="bg-secondary backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl">
 {/* Header */}
 <div className="text-center mb-8">
 <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
 <Mail className="h-8 w-8 text-foreground" />
 </div>
 <h1 className="text-3xl font-bold text-foreground mb-2">
 Verify Your Email
 </h1>
 <p className="text-muted-foreground">
 Enter the verification code sent to your email
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

 {resendMessage && (
 <div className="bg-vaultx-success/10 border border-vaultx-success/40 rounded-lg p-4 text-vaultx-success text-sm flex items-start gap-3">
 <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
 <span>{resendMessage}</span>
 </div>
 )}

 {/* Email */}
 <div>
 <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
 Email Address
 </label>
 <input
 type="email"
 id="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 required
 className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
 placeholder="your@email.com"
 />
 </div>

 {/* OTP Code */}
 <div>
 <label htmlFor="otp" className="block text-sm font-medium text-foreground mb-2">
 Verification Code
 </label>
 <input
 type="text"
 id="otp"
 value={otp}
 onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
 required
 maxLength={6}
 className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-center text-2xl tracking-widest font-mono"
 placeholder="000000"
 />
 <p className="mt-2 text-xs text-muted-foreground">
 Enter the 6-digit code from your email
 </p>
 </div>

 {/* Submit Button */}
 <button
 type="submit"
 disabled={isLoading}
 className="w-full bg-primary text-foreground font-semibold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {isLoading ? (
 <span className="flex items-center justify-center gap-2">
 <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 Verifying...
 </span>
 ) : (
 'Verify Email'
 )}
 </button>

 {/* Resend Button */}
 <div className="text-center">
 <button
 type="button"
 onClick={handleResend}
 disabled={isSending}
 className="text-sm text-vaultx-secondary hover:text-muted-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {isSending ? 'Sending...' : "Didn't receive the code? Resend"}
 </button>
 </div>

 {/* Skip for now */}
 <div className="text-center">
 <Link 
 href="/dashboard" 
 className="text-sm text-muted-foreground hover:text-muted-foreground transition-colors"
 >
 Skip for now →
 </Link>
 </div>
 </form>
 </div>
 </div>
 </div>
 );
}
