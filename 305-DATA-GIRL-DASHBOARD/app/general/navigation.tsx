"use client";
import { usePathname } from "next/navigation";
export default function GeneralNavigation(){
 const pathname=usePathname();
 return (<>
    <nav className="general-navigation" aria-label="General Election dashboard sections" style={{background:"#08111f",color:"white",display:"flex",flexWrap:"wrap",justifyContent:"center",gap:"8px",padding:"9px 14px",fontFamily:"Arial, Helvetica, sans-serif",fontSize:"12px",fontWeight:800}}>
      <a aria-current={pathname === "/general" ? "page" : undefined} href="/general" style={{color:"white",textDecoration:"none",padding:"7px 11px",borderRadius:"999px",border:"1px solid #ffffff38",display:"inline-flex",alignItems:"center",justifyContent:"center",textAlign:"center",lineHeight:1.25,minHeight:"42px"}}>Dashboard</a>
      <a aria-current={pathname === "/general/results" ? "page" : undefined} href="/general/results" style={{color:"white",textDecoration:"none",padding:"7px 11px",borderRadius:"999px",border:"1px solid #ffffff38",display:"inline-flex",alignItems:"center",justifyContent:"center",textAlign:"center",lineHeight:1.25,minHeight:"42px"}}>Election Results</a>
    </nav>
<style>{`.general-navigation a[aria-current="page"] { background: #5ed0cf !important; color: #07151c !important; }`}</style></>);
}
