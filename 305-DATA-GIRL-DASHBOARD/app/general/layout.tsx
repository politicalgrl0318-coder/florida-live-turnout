import GeneralNavigation from "./navigation";
import type { Metadata } from "next";

const siteUrl = "https://florida-live-turnout.politicalgrl0318.workers.dev";
const socialImage = `${siteUrl}/305-data-girl-general-2026.jpg`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "305 Data Girl | Florida 2026 General Election",
  description:
    "Live Florida General Election turnout plus Vote-by-Mail and Early Voting activity for the November 3 election.",
  openGraph: {
    title: "305 Data Girl | Florida 2026 General Election",
    description:
      "Live Florida General Election turnout plus Vote-by-Mail and Early Voting activity for the November 3 election.",
    type: "website",
    siteName: "305 Data Girl",
    url: `${siteUrl}/general`,
    images: [{ url: socialImage, width: 1536, height: 768, alt: "305 Data Girl — Florida 2026 General Election", type: "image/jpeg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "305 Data Girl | Florida 2026 General Election",
    description:
      "Live Florida General Election turnout plus Vote-by-Mail and Early Voting activity for the November 3 election.",
    images: [socialImage],
  },
};

export default function GeneralLayout({ children }: { children: React.ReactNode }) {
  return <>
    <GeneralNavigation/>
    {children}
  </>;
}
