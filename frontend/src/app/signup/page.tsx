'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
 validateSignupForm, 
 validatePassword, 
 getPasswordStrengthColor, 
 getPasswordStrengthWidth,
 type ValidationResult 
} from '@/utils/validation';
import { useAuth } from '@/providers/AuthProvider';
import { Eye, EyeOff, Shield } from 'lucide-react';
import GoogleOAuthModal from '@/components/auth/GoogleOAuthModal';

export default function SignupPage() {
 const router = useRouter();
 const { signup, isAuthenticated, error: authError } = useAuth();
 
 const [formData, setFormData] = useState({
 firstName: '',
 lastName: '',
 email: '',
 password: '',
 confirmPassword: ''
 });
 const [errors, setErrors] = useState<{[key: string]: string}>({});
 const [isLoading, setIsLoading] = useState(false);
 const [agreedToTerms, setAgreedToTerms] = useState(false);
 const [passwordStrength, setPasswordStrength] = useState<ValidationResult | null>(null);
 const [showGoogleModal, setShowGoogleModal] = useState(false);

 // Redirect to onboarding if authenticated (new user)
 useEffect(() => {
 if (isAuthenticated) {
 router.push('/onboarding');
 }
 }, [isAuthenticated, router]);

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const { name, value } = e.target;
 setFormData(prev => ({
 ...prev,
 [name]: value
 }));
 
 // Clear error when user starts typing
 if (errors[name]) {
 setErrors(prev => ({
 ...prev,
 [name]: ''
 }));
 }

 // Real-time password strength validation
 if (name === 'password') {
 const strength = validatePassword(value);
 setPasswordStrength(strength);
 }
 };

 const validateForm = () => {
 const newErrors = validateSignupForm(formData, agreedToTerms);
 setErrors(newErrors);
 return Object.keys(newErrors).length === 0;
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 
 if (!validateForm()) return;

 setIsLoading(true);
 setErrors({});
 
 try {
 await signup(
 formData.email, 
 formData.password, 
 formData.firstName, 
 formData.lastName,
 formData.email // Using email as username for now
 );
 
 console.log('Signup successful, redirecting to onboarding...');
 
 } catch (error) {
 console.error('Signup failed:', error);
 const errorMessage = authError || 'An error occurred during registration. Please try again.';
 setErrors({ general: errorMessage });
 } finally {
 setIsLoading(false);
 }
 };

 return (
 <div className="min-h-screen text-foreground relative overflow-hidden">
 {/* Enhanced Background Effects */}
 <div className="absolute inset-0">
 {/* Gradient Overlays */}
 <div className="absolute inset-0 via-transparent "></div>
 <div className="absolute inset-0 from-transparent to-transparent"></div>
 
 {/* Animated Geometric Shapes */}
 <div className="absolute top-20 left-20 opacity-10">
 <div className="w-32 h-32 border border-primary/40 rotate-45 animate-pulse"></div>
 </div>
 <div className="absolute top-40 right-32 opacity-10">
 <div className="w-24 h-24 border border-primary/40 rounded-full animate-pulse delay-1000"></div>
 </div>
 <div className="absolute bottom-40 left-32 opacity-10">
 <div className="w-28 h-28 border border-primary/40 rounded-full animate-pulse delay-2000"></div>
 </div>
 <div className="absolute bottom-20 right-20 opacity-10">
 <div className="w-20 h-20 border border-primary/40 rotate-45 animate-pulse delay-3000"></div>
 </div>
 
 {/* Grid Pattern */}
 <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
 </div>

 {/* Main Content */}
 <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
 <div className="max-w-md w-full space-y-8">
 {/* Header */}
 <div className="text-center">
 <Link 
 href="/"
 className="inline-block mb-8 text-2xl sm:text-3xl font-black bg-clip-text text-transparent hover:scale-105 transition-transform duration-300"
 >
 VaultX
 </Link>
 <h2 className="text-3xl sm:text-4xl font-bold mb-4 from-white bg-clip-text text-transparent">
 Create Account
 </h2>
 <p className="text-sm sm:text-base text-foreground leading-relaxed">
 Join thousands of traders managing their portfolios with VaultX
 </p>
 </div>

 {/* Signup Form */}
 <div className="bg-secondary backdrop-blur-md rounded-2xl border border-border p-6 sm:p-8 shadow-2xl">
 {errors.general && (
 <div className="mb-6 p-4 bg-vaultx-danger/20 border border-vaultx-danger/40 rounded-xl">
 <p className="text-vaultx-danger text-sm flex items-center gap-2">
 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
 </svg>
 {errors.general}
 </p>
 </div>
 )}

 <form onSubmit={handleSubmit} className="space-y-6">
 {/* Name Fields */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 {/* First Name */}
 <div className="group">
 <label 
 htmlFor="firstName" 
 className="block text-sm font-medium text-foreground mb-2 group-focus-within:text-muted-foreground transition-colors duration-300"
 >
 First Name
 </label>
 <div className="relative">
 <input
 type="text"
 id="firstName"
 name="firstName"
 value={formData.firstName}
 onChange={handleInputChange}
 className={`w-full bg-secondary border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-secondary transition-all duration-300 backdrop-blur-sm ${
 errors.firstName 
 ? 'border-vaultx-danger/40 focus:border-vaultx-danger/40' 
 : 'border-border focus:border-primary/40'
 }`}
 placeholder="John"
 />
 <div className="absolute inset-0 bg-primary/10 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 -z-10"></div>
 </div>
 {errors.firstName && (
 <p className="mt-2 text-xs text-vaultx-danger">{errors.firstName}</p>
 )}
 </div>

 {/* Last Name */}
 <div className="group">
 <label 
 htmlFor="lastName" 
 className="block text-sm font-medium text-foreground mb-2 group-focus-within:text-muted-foreground transition-colors duration-300"
 >
 Last Name
 </label>
 <div className="relative">
 <input
 type="text"
 id="lastName"
 name="lastName"
 value={formData.lastName}
 onChange={handleInputChange}
 className={`w-full bg-secondary border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-secondary transition-all duration-300 backdrop-blur-sm ${
 errors.lastName 
 ? 'border-vaultx-danger/40 focus:border-vaultx-danger/40' 
 : 'border-border focus:border-primary/40'
 }`}
 placeholder="Doe"
 />
 <div className="absolute inset-0 bg-primary/10 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 -z-10"></div>
 </div>
 {errors.lastName && (
 <p className="mt-2 text-xs text-vaultx-danger">{errors.lastName}</p>
 )}
 </div>
 </div>

 {/* Email Field */}
 <div className="group">
 <label 
 htmlFor="email" 
 className="block text-sm font-medium text-foreground mb-2 group-focus-within:text-muted-foreground transition-colors duration-300"
 >
 Email Address
 </label>
 <div className="relative">
 <input
 type="email"
 id="email"
 name="email"
 value={formData.email}
 onChange={handleInputChange}
 className={`w-full bg-secondary border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-secondary transition-all duration-300 backdrop-blur-sm ${
 errors.email 
 ? 'border-vaultx-danger/40 focus:border-vaultx-danger/40' 
 : 'border-border focus:border-primary/40'
 }`}
 placeholder="john.doe@example.com"
 />
 <div className="absolute inset-0 bg-primary/10 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 -z-10"></div>
 </div>
 {errors.email && (
 <p className="mt-2 text-sm text-vaultx-danger flex items-center gap-2">
 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
 </svg>
 {errors.email}
 </p>
 )}
 </div>

 {/* Password Fields */}
 <div className="space-y-4">
 {/* Password */}
 <div className="group">
 <label 
 htmlFor="password" 
 className="block text-sm font-medium text-foreground mb-2 group-focus-within:text-muted-foreground transition-colors duration-300"
 >
 Password
 </label>
 <div className="relative">
 <input
 type="password"
 id="password"
 name="password"
 value={formData.password}
 onChange={handleInputChange}
 className={`w-full bg-secondary border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-secondary transition-all duration-300 backdrop-blur-sm ${
 errors.password 
 ? 'border-vaultx-danger/40 focus:border-vaultx-danger/40' 
 : 'border-border focus:border-primary/40'
 }`}
 placeholder="Create a secure password"
 />
 <div className="absolute inset-0 bg-primary/10 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 -z-10"></div>
 </div>
 {errors.password && (
 <p className="mt-2 text-sm text-vaultx-danger flex items-center gap-2">
 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
 </svg>
 {errors.password}
 </p>
 )}
 
 {/* Password Strength Indicator */}
 {formData.password && (
 <div className="mt-3 space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-xs text-muted-foreground">Password Strength</span>
 {passwordStrength && (
 <span className={`text-xs font-medium ${getPasswordStrengthColor(passwordStrength.strength)}`}>
 {passwordStrength.strength?.replace('-', ' ').toUpperCase()}
 </span>
 )}
 </div>
 <div className="w-full bg-secondary rounded-full h-2">
 <div 
 className={`h-2 rounded-full transition-all duration-300 ${
 passwordStrength?.strength === 'weak' ? 'bg-vaultx-danger' :
 passwordStrength?.strength === 'fair' ? 'bg-vaultx-warning' :
 passwordStrength?.strength === 'good' ? 'bg-vaultx-warning' :
 passwordStrength?.strength === 'strong' ? 'bg-vaultx-success' :
 passwordStrength?.strength === 'very-strong' ? 'bg-vaultx-success' :
 'bg-secondary'
 } ${passwordStrength ? getPasswordStrengthWidth(passwordStrength.strength) : 'w-0'}`}
 />
 </div>
 {passwordStrength && (
 <p className={`text-xs ${getPasswordStrengthColor(passwordStrength.strength)}`}>
 {passwordStrength.message}
 </p>
 )}
 </div>
 )}
 
 {!formData.password && (
 <div className="mt-2 text-xs text-muted-foreground">
 <div className="space-y-1">
 <div>Password requirements:</div>
 <ul className="ml-3 space-y-1 text-muted-foreground">
 <li>• At least 8 characters long</li>
 <li>• Include uppercase and lowercase letters</li>
 <li>• Include at least one number</li>
 <li>• Include at least one special character</li>
 <li>• Avoid common passwords and patterns</li>
 </ul>
 </div>
 </div>
 )}
 </div>

 {/* Confirm Password */}
 <div className="group">
 <label 
 htmlFor="confirmPassword" 
 className="block text-sm font-medium text-foreground mb-2 group-focus-within:text-muted-foreground transition-colors duration-300"
 >
 Confirm Password
 </label>
 <div className="relative">
 <input
 type="password"
 id="confirmPassword"
 name="confirmPassword"
 value={formData.confirmPassword}
 onChange={handleInputChange}
 className={`w-full bg-secondary border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-secondary transition-all duration-300 backdrop-blur-sm ${
 errors.confirmPassword 
 ? 'border-vaultx-danger/40 focus:border-vaultx-danger/40' 
 : 'border-border focus:border-primary/40'
 }`}
 placeholder="Confirm your password"
 />
 <div className="absolute inset-0 bg-primary/10 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 -z-10"></div>
 </div>
 {errors.confirmPassword && (
 <p className="mt-2 text-sm text-vaultx-danger flex items-center gap-2">
 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
 </svg>
 {errors.confirmPassword}
 </p>
 )}
 </div>
 </div>

 {/* Terms and Conditions */}
 <div className="space-y-3">
 <div className="flex items-start gap-3">
 <input
 type="checkbox"
 id="terms"
 checked={agreedToTerms}
 onChange={(e) => {
 setAgreedToTerms(e.target.checked);
 if (errors.terms) {
 setErrors(prev => ({...prev, terms: ''}));
 }
 }}
 className="mt-1 w-4 h-4 text-vaultx-secondary bg-secondary border-border rounded focus:ring-purple-500 focus:ring-2"
 />
 <label htmlFor="terms" className="text-sm text-foreground leading-relaxed">
 I agree to the{' '}
 <Link href="/terms" className="text-vaultx-secondary hover:text-muted-foreground transition-colors underline underline-offset-2">
 Terms of Service
 </Link>{' '}
 and{' '}
 <Link href="/privacy" className="text-vaultx-secondary hover:text-muted-foreground transition-colors underline underline-offset-2">
 Privacy Policy
 </Link>
 </label>
 </div>
 {errors.terms && (
 <p className="text-sm text-vaultx-danger flex items-center gap-2">
 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
 </svg>
 {errors.terms}
 </p>
 )}
 </div>

 {/* Submit Button */}
 <button
 type="submit"
 disabled={isLoading}
 className={`w-full bg-primary text-foreground font-semibold py-3 px-4 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 transform ${
 isLoading 
 ? 'opacity-75 cursor-not-allowed' 
 : 'hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/30 active:scale-[0.98]'
 }`}
 >
 {isLoading ? (
 <div className="flex items-center justify-center gap-2">
 <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 Creating Account...
 </div>
 ) : (
 'Create Account'
 )}
 </button>
 </form>

 {/* Security-First Message */}
 <div className=" border border-vaultx-success/40 rounded-xl p-4 mb-6">
 <div className="flex items-start gap-3">
 <div className="p-2 rounded-lg bg-vaultx-success/20 border border-vaultx-success/40 flex-shrink-0">
 <Shield className="h-4 w-4 text-vaultx-success" />
 </div>
 <div>
 <h4 className="text-sm font-bold text-vaultx-success mb-1">Your Security, Our Priority</h4>
 <p className="text-xs text-vaultx-success leading-relaxed">
 End-to-end encryption • No private keys stored • Read-only access • SOC 2 compliant
 </p>
 </div>
 </div>
 </div>

 {/* Social Signup Divider */}
 <div className="relative my-6">
 <div className="absolute inset-0 flex items-center">
 <div className="w-full border-t border-border"></div>
 </div>
 <div className="relative flex justify-center text-sm">
 <span className="px-4 bg-secondary text-muted-foreground font-medium">or sign up with</span>
 </div>
 </div>

 {/* Enhanced Social Signup Buttons */}
 <div className="space-y-3">
 {/* Google OAuth Signup */}
 <button 
 onClick={() => setShowGoogleModal(true)}
 className="w-full bg-white hover:bg-muted border border-border hover:border-border rounded-xl px-4 py-3 flex items-center justify-center gap-3 text-sm font-medium transition-all duration-300 hover:scale-[1.02] hover:shadow-md group"
 >
 <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24">
 <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
 <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
 <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
 <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
 </svg>
 <span className="text-muted-foreground group-hover:text-foreground">Sign up with Google</span>
 </button>
 </div>
 </div>

 {/* Sign In Link */}
 <div className="text-center">
 <p className="text-muted-foreground">
 Already have an account?{' '}
 <Link 
 href="/login"
 className="text-vaultx-secondary hover:text-muted-foreground font-medium transition-colors duration-300 underline underline-offset-2"
 >
 Sign in here
 </Link>
 </p>
 </div>

 {/* Google OAuth Modal */}
 <GoogleOAuthModal
 isOpen={showGoogleModal}
 onClose={() => setShowGoogleModal(false)}
 context="signup"
 onSuccess={(token, user) => {
 // New Google OAuth users always go to onboarding
 router.push('/onboarding');
 }}
 />
 </div>
 </div>
 </div>
 );
}