import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "305 Data Girl — Florida 2026 General Election";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{width:"100%",height:"100%",display:"flex",background:"#08111f",color:"white",fontFamily:"Arial, Helvetica, sans-serif",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",right:-110,top:-120,width:520,height:520,borderRadius:520,background:"#16a6a6",opacity:.18}} />
      <div style={{position:"absolute",right:80,bottom:-190,width:500,height:500,borderRadius:500,border:"54px solid #f26f61",opacity:.18}} />
      <div style={{width:"100%",padding:"64px 72px",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:18}}>
          <div style={{fontSize:72,fontWeight:900,lineHeight:1,color:"#5ed0cf"}}>305</div>
          <div style={{display:"flex",flexDirection:"column"}}>
            <div style={{fontSize:35,fontWeight:900,letterSpacing:1}}>DATA GIRL</div>
            <div style={{fontSize:20,color:"#a9dede",marginTop:4}}>Florida Politics with Receipts</div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",maxWidth:900}}>
          <div style={{fontSize:24,fontWeight:800,letterSpacing:2,color:"#5ed0cf",marginBottom:14}}>LIVE STATEWIDE ELECTION DATA</div>
          <div style={{fontSize:64,fontWeight:900,lineHeight:1.02,letterSpacing:-2}}>Florida 2026<br/>General Election</div>
          <div style={{fontSize:25,color:"#d7dfeb",marginTop:22}}>County turnout • Vote-by-Mail • Early Voting • All 67 counties</div>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:19,color:"#b7c5d8"}}>
          <div>Dr. Vanessa Brito</div><div style={{color:"#5ed0cf",fontWeight:800}}>305 Data Girl</div>
        </div>
      </div>
    </div>,
    size,
  );
}
