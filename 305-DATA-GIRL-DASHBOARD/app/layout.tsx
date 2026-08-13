import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://florida-live-turnout.politicalgrl0318.workers.dev"),
  title: "305 Data Girl | Florida Live Voter Turnout",
  description: "Florida politics—with receipts. Live unofficial voter turnout across all 67 Florida counties.",
  openGraph: {
    title: "305 Data Girl | Florida Live Voter Turnout",
    description: "Florida politics—with receipts. Live unofficial voter turnout across all 67 Florida counties.",
    type: "website",
    siteName: "305 Data Girl",
    images: [
      {
        url: "/vanessa-brito.jpg",
        width: 1536,
        height: 2048,
        alt: "Vanessa Brito — 305 Data Girl",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "305 Data Girl | Florida Live Voter Turnout",
    description: "Florida politics—with receipts. Live unofficial voter turnout across all 67 Florida counties.",
    images: ["/vanessa-brito.jpg"],
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
