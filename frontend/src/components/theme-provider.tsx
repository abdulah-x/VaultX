'use client';

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps as NextThemeProviderProps } from 'next-themes';
import * as React from 'react';

interface ThemeProviderProps extends Omit<NextThemeProviderProps, 'children'> {
 children: React.ReactNode;
}

export function ThemeProvider({ 
 children, 
 attribute = "class",
 defaultTheme = "dark",
 enableSystem = false,
 disableTransitionOnChange = false,
 ...props 
}: ThemeProviderProps) {
 return (
 <NextThemesProvider
 attribute={attribute}
 defaultTheme={defaultTheme}
 enableSystem={enableSystem}
 disableTransitionOnChange={disableTransitionOnChange}
 {...props}
 >
 {children}
 </NextThemesProvider>
 );
}