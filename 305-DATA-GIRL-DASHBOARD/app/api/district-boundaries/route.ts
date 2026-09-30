import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const urls:Record<string,string> = {
  congressional:"https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/FL_Congressional_Districts_May_2026/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson",
  house:"https://services2.arcgis.com/LvWGAAhHwbCJ2GMP/ArcGIS/rest/services/Florida_Districts/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson",
  senate:"https://services2.arcgis.com/LvWGAAhHwbCJ2GMP/ArcGIS/rest/services/Florida_Districts/FeatureServer/1/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson",
};

export async function GET(request:NextRequest){
  const chamber=String(request.nextUrl.searchParams.get("chamber")||"congressional").toLowerCase();
  const url=urls[chamber];
  if(!url) return NextResponse.json({error:"Choose congressional, house, or senate."},{status:400});
  try{
    const upstream=await fetch(url,{headers:{Accept:"application/geo+json,application/json"},cache:"force-cache"});
    if(!upstream.ok) throw new Error("Boundary service returned "+upstream.status);
    const body=await upstream.text();
    return new NextResponse(body,{status:200,headers:{"Content-Type":"application/geo+json; charset=utf-8","Cache-Control":"public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"}});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:"Official district boundary service unavailable."},{status:502,headers:{"Cache-Control":"no-store"}});
  }
}
