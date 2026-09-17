import type { Metadata } from "next";

const siteUrl = "https://florida-live-turnout.politicalgrl0318.workers.dev";
const socialImage = `${siteUrl}/305-data-girl-social.png?v=20260916-1`;

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
    images: [
      {
        url: socialImage,
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
    images: [socialImage],
  },
};

export default function GeneralLayout({ children }: { children: React.ReactNode }) {
  return <>
    <nav aria-label="General Election dashboard sections" style={{background:"#08111f",color:"white",display:"flex",justifyContent:"center",gap:"8px",padding:"9px 14px",fontFamily:"Arial, Helvetica, sans-serif",fontSize:"12px",fontWeight:800}}>
      <a href="/general" style={{color:"white",textDecoration:"none",padding:"7px 11px",borderRadius:"999px",border:"1px solid #ffffff38"}}>Dashboard</a>
      <a href="/general/map" style={{color:"#07151c",background:"#5ed0cf",textDecoration:"none",padding:"7px 11px",borderRadius:"999px"}}>Interactive Turnout Map</a>
    </nav>
    {children}
  </>;
}
