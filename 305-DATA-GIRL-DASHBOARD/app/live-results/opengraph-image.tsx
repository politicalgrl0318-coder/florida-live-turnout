import { ImageResponse } from "next/og";

export const alt =
  "Florida August 2026 Primary live election results from 305 Data Girl";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #071a33 0%, #0d3157 100%)",
          color: "white",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "62px 70px",
          borderLeft: "18px solid #2fb3ff",
          fontFamily: "Arial, sans-serif",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", fontSize: 36, fontWeight: 800, letterSpacing: 2 }}>
          305 DATA GIRL
        </div>
        <div style={{ display: "flex", marginTop: 22, color: "#56c7ff", fontSize: 26, fontWeight: 800, letterSpacing: 1 }}>
          FLORIDA ELECTION WATCH
        </div>
        <div style={{ display: "flex", marginTop: 54, fontSize: 62, fontWeight: 800, lineHeight: 1.05 }}>
          Florida August 2026 Primary
        </div>
        <div style={{ display: "flex", marginTop: 10, fontSize: 76, fontWeight: 900, lineHeight: 1 }}>
          LIVE RESULTS
        </div>
        <div style={{ display: "flex", marginTop: 38, color: "#c9d8e8", fontSize: 28 }}>
          Statewide and federal races • Official source
        </div>
        <div style={{ display: "flex", marginTop: 76, color: "#dbe9f5", fontSize: 24 }}>
          Results are unofficial until canvassing and certification are complete.
        </div>
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 70,
            top: 80,
            width: 86,
            height: 86,
            borderRadius: 43,
            alignItems: "center",
            justifyContent: "center",
            background: "#ef4444",
            fontSize: 24,
            fontWeight: 900,
          }}
        >
          LIVE
        </div>
      </div>
    ),
    size,
  );
}
