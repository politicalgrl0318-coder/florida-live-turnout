import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nixon vs. Vindman Precinct Map Preview | 305 Data Girl",
  description: "Florida's 2026 Democratic U.S. Senate primary, assembled precinct by precinct from official county election files.",
  openGraph: {
    title: "Nixon vs. Vindman Precinct Map Preview",
    description: "Official county precinct results, statewide collection coverage and congressional-district mapping progress.",
    type: "website",
    images: ["/primary-map-social.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nixon vs. Vindman Precinct Map Preview",
    description: "Official county precinct results assembled by 305 Data Girl.",
    images: ["/primary-map-social.png"],
  },
};

export default function Layout({children}:{children:React.ReactNode}) {
  return children;
}
