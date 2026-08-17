import type { Metadata } from "next";

const previewImage = "/live-results/opengraph-image";

export const metadata: Metadata = {
  title: "Florida August 2026 Primary — Live Election Results | 305 Data Girl",
  description:
    "Live statewide and federal results for Florida’s August 2026 Primary Election, sourced from Florida Election Watch.",
  openGraph: {
    title: "Florida August 2026 Primary — Live Election Results",
    description:
      "Follow live statewide and federal primary results from Florida’s official reporting source.",
    type: "website",
    siteName: "305 Data Girl",
    url: "/live-results",
    images: [
      {
        url: previewImage,
        width: 1200,
        height: 630,
        alt: "Florida August 2026 Primary live election results from 305 Data Girl",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Florida August 2026 Primary — Live Election Results",
    description:
      "Follow live statewide and federal primary results from Florida’s official reporting source.",
    images: [previewImage],
  },
};

export default function LiveResultsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
