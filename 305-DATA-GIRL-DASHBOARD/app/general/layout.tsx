import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "305 Data Girl | Florida 2026 General Election",
  description:
    "Live Florida General Election turnout plus Vote-by-Mail and Early Voting activity for the November 3 election.",
  openGraph: {
    title: "305 Data Girl | Florida 2026 General Election",
    description:
      "Live Florida General Election turnout plus Vote-by-Mail and Early Voting activity for the November 3 election.",
    type: "website",
    siteName: "305 Data Girl",
    images: [
      {
        url: "/general-election-og-v3.jpg?v=20260915-3",
        width: 1200,
        height: 630,
        alt: "305 Data Girl — Florida 2026 General Election",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "305 Data Girl | Florida 2026 General Election",
    description:
      "Live Florida General Election turnout plus Vote-by-Mail and Early Voting activity for the November 3 election.",
    images: ["/general-election-og-v3.jpg?v=20260915-3"],
  },
};

export default function GeneralLayout({ children }: { children: React.ReactNode }) {
  return children;
}
