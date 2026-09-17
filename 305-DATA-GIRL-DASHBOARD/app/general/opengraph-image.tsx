import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "305 Data Girl — Florida 2026 General Election";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const artwork = "https://florida-live-turnout.politicalgrl0318.workers.dev/general-election-og-v3.jpg?v=flipflops-20260916";

export default function Image() {
  return new ImageResponse(
    <div style={{width:"100%",height:"100%",display:"flex",overflow:"hidden",background:"#f4f1ea"}}>
      <img src={artwork} width="1200" height="630" style={{width:"1200px",height:"630px",objectFit:"cover"}} />
    </div>,
    size,
  );
}
