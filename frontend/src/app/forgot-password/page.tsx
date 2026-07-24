"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
 const [email, setEmail] = useState("");
 const [isSubmitted, setIsSubmitted] = useState(false);
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState("");

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError("");
 setIsLoading(true);

 try {
 const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/forgot-password`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({ email }),
 });

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.detail || 'Failed to send reset email');
 }

 setIsSubmitted(true);
 } catch (err: any) {
 setError(err.message || "Failed to send reset email");
 } finally {
 setIsLoading(false);
 }
 };

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
 className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 group"
 >
 <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
 Back to Login
 </Link>

 {/* Main Card */}
 <div className="bg-secondary backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl">
 {!isSubmitted ? (
 <>
 {/* Header */}
 <div className="text-center mb-8">
 <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
 <Mail className="h-8 w-8 text-foreground" />
 </div>
 <h1 className="text-3xl font-bold text-foreground mb-2">
 Forgot Password?
 </h1>
 <p className="text-muted-foreground">
 No worries! Enter your email and we'll send you reset instructions.
 </p>
 </div>

 {/* Form */}
 <form onSubmit={handleSubmit} className="space-y-6">
 {error && (
 <div className="bg-vaultx-danger/10 border border-vaultx-danger/40 rounded-lg p-4 text-vaultx-danger text-sm">
 {error}
 </div>
 )}

 <div>
 <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
 Email Address
 </label>
 <input
 type="email"
 id="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
 placeholder="your.email@example.com"
 required
 />
 </div>

 <button
 type="submit"
 disabled={isLoading}
 className="w-full py-3 bg-primary text-foreground font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 {isLoading ? (
 <>
 <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
 Sending...
 </>
 ) : (
 "Send Reset Link"
 )}
 </button>
 </form>
 </>
 ) : (
 <>
 {/* Success State */}
 <div className="text-center">
 <div className="w-16 h-16 bg-vaultx-success rounded-xl flex items-center justify-center mx-auto mb-4">
 <CheckCircle2 className="h-8 w-8 text-foreground" />
 </div>
 <h1 className="text-3xl font-bold text-foreground mb-2">
 Check Your Email
 </h1>
 <p className="text-muted-foreground mb-6">
 We've sent password reset instructions to <span className="text-foreground font-medium">{email}</span>
 </p>
 <div className="bg-card border border-border rounded-lg p-4 text-left space-y-2 mb-6">
 <p className="text-foreground text-sm">📧 Didn't receive the email?</p>
 <ul className="text-muted-foreground text-sm space-y-1 ml-4">
 <li>• Check your spam/junk folder</li>
 <li>• Verify the email address is correct</li>
 <li>• Wait a few minutes and try again</li>
 </ul>
 </div>
 <button
 onClick={() => setIsSubmitted(false)}
 className="text-vaultx-secondary hover:text-muted-foreground font-medium transition-colors"
 >
 Try another email
 </button>
 </div>
 </>
 )}

 {/* Footer Links */}
 <div className="mt-6 pt-6 border-t border-border text-center">
 <p className="text-muted-foreground text-sm">
 Remember your password?{" "}
 <Link href="/login" className="text-vaultx-secondary hover:text-muted-foreground font-medium transition-colors">
 Sign In
 </Link>
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}
