import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Jobfolio · Your next chapter", description: "A little order for your next big move. Keep job opportunities, applications and documents together.", icons: {icon: "/favicon.svg"} };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><head><link rel="preload" href="/fonts/open-sans.ttf" as="font" type="font/ttf" crossOrigin="anonymous" /></head><body>{children}</body></html>; }
