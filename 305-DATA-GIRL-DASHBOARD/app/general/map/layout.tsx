import type { Metadata } from "next";

const site = "https://florida-live-turnout.politicalgrl0318.workers.dev";
const socialImage = `${site}/305-data-girl-social.png?map=20260916-1`;

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "305 Data Girl | Florida 2026 Interactive Turnout Map",
  description: "Interactive Florida 2026 General Election county turnout map with live VBM, Early Vote, Election Day and party-registration turnout data.",
  alternates: { canonical: `${site}/general/map` },
  openGraph: {
    title: "305 Data Girl | Florida 2026 Interactive Turnout Map",
    description: "Tap any Florida county to explore live General Election turnout as official county reporting comes online.",
    url: `${site}/general/map`,
    type: "website",
    siteName: "305 Data Girl",
    images: [{
      url: socialImage,
      width: 1774,
      height: 887,
      alt: "305 Data Girl — Florida 2026 General Election",
      type: "image/png",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "305 Data Girl | Florida 2026 Interactive Turnout Map",
    description: "Tap any Florida county to explore live General Election turnout as official county reporting comes online.",
    images: [socialImage],
  },
};

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
