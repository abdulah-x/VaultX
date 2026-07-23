"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { 
 ArrowRight, 
 ArrowLeft,
 TrendingUp, 
 PieChart, 
 BarChart3, 
 Target, 
 Bell, 
 Shield, 
 Zap,
 Eye,
 Calculator,
 LineChart,
 DollarSign,
 CheckCircle,
 Sparkles,
 X
} from "lucide-react";

interface OnboardingStep {
 id: number;
 title: string;
 subtitle: string;
 content: string;
 features: Array<{
 icon: React.ReactNode;
 title: string;
 description: string;
 }>;
 image?: string;
}

const onboardingSteps: OnboardingStep[] = [
 {
 id: 1,
 title: "Welcome to Professional Crypto Trading",
 subtitle: "Your Gateway to Advanced Portfolio Management",
 content: "Experience institutional-grade crypto portfolio tracking with real-time analytics, professional insights, and bank-level security. Join thousands of traders who trust our platform for their digital asset management.",
 features: [
 {
 icon: <PieChart className="w-8 h-8 text-primary" />,
 title: "Unified Portfolio Dashboard",
 description: "Monitor all your crypto assets across exchanges in one comprehensive view with real-time price feeds"
 },
 {
 icon: <TrendingUp className="w-8 h-8 text-vaultx-success" />,
 title: "Advanced Analytics Engine",
 description: "Professional-grade performance metrics, trend analysis, and predictive insights powered by AI"
 },
 {
 icon: <Shield className="w-8 h-8 text-primary" />,
 title: "Bank-Grade Security",
 description: "Military-grade encryption, cold storage integration, and zero-trust architecture protect your assets"
 }
 ]
 },
 {
 id: 2,
 title: "Professional Analytics Suite", 
 subtitle: "Data-Driven Investment Decisions",
 content: "Access institutional-quality analytics tools that professional traders use. Our platform provides deep market insights, risk analysis, and performance attribution to maximize your trading potential.",
 features: [
 {
 icon: <BarChart3 className="w-8 h-8 text-vaultx-secondary" />,
 title: "Interactive Performance Charts",
 description: "Advanced charting with 50+ technical indicators, pattern recognition, and multi-timeframe analysis"
 },
 {
 icon: <Calculator className="w-8 h-8 text-vaultx-warning" />,
 title: "Real-Time P&L Analytics", 
 description: "Instant profit/loss calculations, tax reporting, and performance attribution across all positions"
 },
 {
 icon: <Target className="w-8 h-8 text-vaultx-danger" />,
 title: "Risk Management Tools",
 description: "Portfolio diversification analysis, correlation matrices, and automated risk alerts"
 }
 ]
 },
 {
 id: 3,
 title: "AI-Powered Market Intelligence",
 subtitle: "Stay Ahead with Smart Trading Insights", 
 content: "Leverage artificial intelligence and machine learning to identify market opportunities, optimize your portfolio allocation, and receive personalized trading recommendations.",
 features: [
 {
 icon: <Zap className="w-8 h-8 text-vaultx-warning" />,
 title: "Real-Time Market Data",
 description: "Live price feeds from 100+ exchanges, order book analysis, and institutional-grade market depth"
 },
 {
 icon: <Bell className="w-8 h-8 text-primary" />,
 title: "Smart Alert System",
 description: "AI-powered notifications for price movements, trend changes, and portfolio optimization opportunities"
 },
 {
 icon: <LineChart className="w-8 h-8 text-teal-400" />,
 title: "Technical Analysis Suite",
 description: "Professional charting tools, automated pattern detection, and algorithmic trading signals"
 }
 ]
 },
 {
 id: 4,
 title: "Your Professional Trading Hub Awaits",
 subtitle: "Everything You Need for Successful Crypto Trading",
 content: "You now have access to professional-grade tools that institutional traders use. Your personalized dashboard is ready with real-time data, advanced analytics, and intelligent insights.",
 features: [
 {
 icon: <Eye className="w-8 h-8 text-primary" />,
 title: "Instant Market Overview",
 description: "Real-time portfolio valuation, asset allocation, and performance metrics updated every second"
 },
 {
 icon: <DollarSign className="w-8 h-8 text-vaultx-success" />,
 title: "Live Portfolio Tracking",
 description: "Dynamic portfolio value calculation with P&L attribution and performance benchmarking"
 },
 {
 icon: <Sparkles className="w-8 h-8 text-pink-400" />,
 title: "Personalized Intelligence",
 description: "AI-curated insights, custom alerts, and tailored recommendations based on your trading style"
 }
 ]
 }
];

export default function OnboardingPage() {
 const [currentStep, setCurrentStep] = useState(0);
 const [isCompleting, setIsCompleting] = useState(false);
 const router = useRouter();
 const { user, updateUserProfile, isAuthenticated, isLoading } = useAuth();

 // Redirect to login if not authenticated
 if (!isLoading && !isAuthenticated) {
 router.push('/login');
 return null;
 }

 // Show loading while checking auth
 if (isLoading) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="text-center">
 <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mb-4 mx-auto animate-pulse">
 <TrendingUp className="w-8 h-8 text-foreground" />
 </div>
 <div className="text-foreground text-lg font-medium">Loading...</div>
 </div>
 </div>
 );
 }

 const handleNext = () => {
 if (currentStep < onboardingSteps.length - 1) {
 setCurrentStep(currentStep + 1);
 } else {
 completeOnboarding();
 }
 };

 const handlePrevious = () => {
 if (currentStep > 0) {
 setCurrentStep(currentStep - 1);
 }
 };

 const completeOnboarding = async () => {
 setIsCompleting(true);
 
 try {
 // Mark user as having completed onboarding
 if (updateUserProfile && user) {
 await updateUserProfile({
 hasCompletedOnboarding: true
 });
 }
 
 // Store in localStorage as backup
 localStorage.setItem('hasCompletedOnboarding', 'true');
 
 // Redirect to dashboard
 router.push('/dashboard');
 } catch (error) {
 console.error('Error completing onboarding:', error);
 // Still redirect to dashboard even if profile update fails
 router.push('/dashboard');
 } finally {
 setIsCompleting(false);
 }
 };

 const skipOnboarding = () => {
 router.push('/dashboard');
 };

 const currentStepData = onboardingSteps[currentStep];
 const progress = ((currentStep + 1) / onboardingSteps.length) * 100;

 return (
 <div className="min-h-screen relative overflow-hidden">
 {/* Animated Background Elements */}
 <div className="absolute inset-0 overflow-hidden">
 <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl animate-pulse" />
 <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />
 </div>
 
 <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
 <div className="max-w-5xl w-full">
 {/* Enhanced Header */}
 <div className="text-center mb-10">
 <div className="flex items-center justify-center gap-3 mb-6">
 <div className="relative">
 <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
 <TrendingUp className="w-6 h-6 text-foreground" />
 </div>
 <div className="absolute -top-2 -right-2 w-6 h-6 bg-vaultx-success rounded-full flex items-center justify-center">
 <Sparkles className="w-3 h-3 text-foreground" />
 </div>
 </div>
 <div className="text-left">
 <h1 className="text-3xl font-bold from-white bg-clip-text text-transparent">
 Crypto Portfolio
 </h1>
 <p className="text-primary text-sm font-medium">Professional Trading Platform</p>
 </div>
 </div>
 
 {/* Enhanced Progress Bar */}
 <div className="w-full max-w-lg mx-auto mb-4">
 <div className="flex justify-between items-center mb-3">
 {onboardingSteps.map((_, index) => (
 <div key={index} className="flex items-center">
 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
 index <= currentStep 
 ? 'bg-primary text-foreground shadow-lg' 
 : 'bg-secondary text-muted-foreground border border-border'
 }`}>
 {index < currentStep ? <CheckCircle className="w-4 h-4" /> : index + 1}
 </div>
 {index < onboardingSteps.length - 1 && (
 <div className={`h-1 w-16 mx-2 rounded-full transition-all duration-300 ${
 index < currentStep ? 'bg-primary' : 'bg-secondary'
 }`} />
 )}
 </div>
 ))}
 </div>
 <p className="text-muted-foreground text-sm">
 Step {currentStep + 1} of {onboardingSteps.length} • {Math.round(progress)}% Complete
 </p>
 </div>
 </div>

 {/* Premium Content Card */}
 <div className="bg-secondary border border-border rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
 {/* Step Header */}
 <div className="text-center mb-10">
 <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 border border-primary/40">
 {currentStepData.features[0].icon}
 </div>
 <h2 className="text-4xl font-bold from-white bg-clip-text text-transparent mb-4">
 {currentStepData.title}
 </h2>
 <p className="text-xl text-primary font-medium mb-4">
 {currentStepData.subtitle}
 </p>
 <p className="text-foreground leading-relaxed max-w-3xl mx-auto text-lg">
 {currentStepData.content}
 </p>
 </div>

 {/* Premium Features Grid */}
 <div className="grid lg:grid-cols-3 gap-8 mb-10">
 {currentStepData.features.map((feature, index) => (
 <div 
 key={index}
 className="group relative border border-border rounded-2xl p-6 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10"
 style={{ animationDelay: `${index * 100}ms` }}
 >
 {/* Card Glow Effect */}
 <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
 
 <div className="relative z-10">
 <div className="flex justify-center mb-6">
 <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center group-hover: group-hover: transition-all duration-300 border border-border/30 group-hover:border-primary/40">
 {feature.icon}
 </div>
 </div>
 <h3 className="text-foreground font-bold mb-3 text-lg text-center group-hover:text-primary transition-colors">
 {feature.title}
 </h3>
 <p className="text-muted-foreground text-center leading-relaxed">
 {feature.description}
 </p>
 </div>
 </div>
 ))}
 </div>

 {/* Premium Navigation */}
 <div className="flex justify-between items-center pt-6 border-t border-border">
 <button
 onClick={skipOnboarding}
 className="text-muted-foreground hover:text-primary transition-colors font-medium flex items-center gap-2"
 >
 <X className="w-4 h-4" />
 Skip tour
 </button>

 <div className="flex items-center gap-4">
 {currentStep > 0 && (
 <button
 onClick={handlePrevious}
 className="flex items-center gap-2 px-6 py-3 bg-secondary hover:bg-secondary/70 text-foreground rounded-xl transition-all duration-200 border border-border hover:border-border/50 font-medium"
 >
 <ArrowLeft className="w-4 h-4" />
 Previous
 </button>
 )}
 
 <button
 onClick={handleNext}
 disabled={isCompleting}
 className="flex items-center gap-2 px-8 py-3 bg-primary hover: hover: text-foreground rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl font-medium min-w-[140px] justify-center"
 >
 {isCompleting ? (
 <>
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
 <span>Setting up...</span>
 </>
 ) : currentStep === onboardingSteps.length - 1 ? (
 <>
 <CheckCircle className="w-4 h-4" />
 <span>Enter Dashboard</span>
 </>
 ) : (
 <>
 <span>Continue</span>
 <ArrowRight className="w-4 h-4" />
 </>
 )}
 </button>
 </div>
 </div>
 </div>

 {/* Bottom Accent */}
 <div className="text-center mt-8">
 <p className="text-muted-foreground text-sm">
 Secure • Professional • Real-time Analytics
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}