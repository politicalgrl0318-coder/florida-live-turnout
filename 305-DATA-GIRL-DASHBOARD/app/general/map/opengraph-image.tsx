import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "305 Data Girl — Florida 2026 Interactive Turnout Map";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{width:"100%",height:"100%",display:"flex",background:"#08111f",color:"white",fontFamily:"Arial, Helvetica, sans-serif",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",right:-80,top:-80,width:430,height:430,borderRadius:430,background:"#16a6a6",opacity:.2}} />
      <div style={{width:"100%",padding:"62px 72px",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:18}}><div style={{fontSize:68,fontWeight:900,color:"#5ed0cf"}}>305</div><div style={{fontSize:34,fontWeight:900}}>DATA GIRL</div></div>
        <div style={{display:"flex",flexDirection:"column",maxWidth:960}}>
          <div style={{fontSize:24,fontWeight:800,letterSpacing:2,color:"#5ed0cf",marginBottom:14}}>FLORIDA 2026 GENERAL ELECTION</div>
          <div style={{fontSize:62,fontWeight:900,lineHeight:1.02,letterSpacing:-2}}>Interactive County<br/>Turnout Map</div>
          <div style={{fontSize:25,color:"#d7dfeb",marginTop:22}}>Tap a county • D–R turnout margin • Turnout rate • Ballots cast</div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:19,color:"#b7c5d8"}}><div>Florida Politics with Receipts</div><div style={{color:"#5ed0cf",fontWeight:800}}>Dr. Vanessa Brito</div></div>
      </div>
    </div>,
    size,
  );
}
