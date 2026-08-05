import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk, Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/providers/AuthProvider";
import { ReactQueryProvider } from "@/lib/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

// Landing-page display face, replacing Times New Roman. Fraunces is a
// variable serif built for exactly this register -- editorial, some
// personality in the curves -- without reading as a system-font default the
// way Times does. Weight range covers the landing's bold headings down to
// the lighter hero lead.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

// Landing-page UI-chrome face -- nav, buttons, badges, body copy -- distinct
// from the app's Inter. Public Sans was built for the U.S. Web Design System:
// neutral, built for clarity in dense/data-heavy contexts, which is the
// closest semantic fit in the sans-serif field for a page arguing the product
// is a rigorous analytical instrument rather than another balance tracker.
// Scoped to the landing route only in globals.css (.vx-landing overrides
// --font-sans locally); the rest of the app keeps Inter untouched.
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "VaultX - Professional Crypto Portfolio Tracker",
  description:
    "Track, analyze, and optimize your cryptocurrency investments with VaultX. Real-time data, advanced analytics, and professional-grade portfolio management.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon", sizes: "32x32", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.svg",
    other: [
      {
        rel: "icon",
        url: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        rel: "icon",
        url: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
      {
        rel: "mask-icon",
        url: "/favicon.svg",
        color: "#8B5CF6",
      },
    ],
  },
  manifest: "/site.webmanifest",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#8B5CF6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} ${fraunces.variable} ${publicSans.variable} font-sans antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <ReactQueryProvider>
            <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
              <AuthProvider>{children}</AuthProvider>
            </GoogleOAuthProvider>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
