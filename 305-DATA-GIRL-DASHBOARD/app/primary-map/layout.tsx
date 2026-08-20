import type { Metadata } from "next";

const pageUrl = "https://florida-live-turnout.politicalgrl0318.workers.dev/primary-map";
const previewImage = "https://florida-live-turnout.politicalgrl0318.workers.dev/primary-map-social.png";

export const metadata: Metadata = {
  title: "2026 Florida Primary Turnout Map | 305 Data Girl",
  description: "Explore an interactive county map comparing Democratic and Republican turnout in Florida's August 2026 primary.",
  alternates: { canonical: pageUrl },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "305 Data Girl",
    title: "Florida 2026 Primary: Interactive County Turnout Map",
    description: "Explore Democratic and Republican primary turnout county by county across Florida.",
    images: [{ url: previewImage, width: 1200, height: 630, alt: "Florida 2026 Primary interactive county turnout map by 305 Data Girl" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Florida 2026 Primary: Interactive County Turnout Map",
    description: "Explore Democratic and Republican primary turnout county by county across Florida.",
    images: [previewImage],
  },
};

export default function PrimaryMapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
