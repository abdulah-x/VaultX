import { Metadata } from 'next'

export const metadata: Metadata = {
 title: 'Welcome | Crypto Portfolio',
 description: 'Learn about your crypto portfolio platform features and get started',
}

interface OnboardingLayoutProps {
 children: React.ReactNode
}

export default function OnboardingLayout({ children }: OnboardingLayoutProps) {
 return children
}