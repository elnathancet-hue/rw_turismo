import type { GetServerSideProps } from "next";
import { getPublicBlogTaxonomy, getPublishedPosts } from "../lib/content/server";
import { getActiveProductsServer } from "../lib/products/server";
const escapeXml=(value:string)=>value.replace(/[<>&'"]/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[char]||char));
const Sitemap=()=>null;
export default Sitemap;
export const getServerSideProps:GetServerSideProps=async({res})=>{
  const base=(process.env.NEXT_PUBLIC_SITE_URL||"").replace(/\/+$/,"");
  const urls:{loc:string;lastmod?:string}[]=[{loc:`${base}/`},{loc:`${base}/blog`}];
  const [productsResult, blogResult, taxonomyResult] = await Promise.allSettled([
    getActiveProductsServer(),
    getPublishedPosts({ limit: 50 }),
    getPublicBlogTaxonomy(),
  ]);
  if (productsResult.status === "fulfilled") {
    productsResult.value.forEach(item=>urls.push({loc:`${base}/products/${item.slug}`,lastmod:item.updated_at}));
  }
  if (blogResult.status === "fulfilled") {
    blogResult.value.posts.forEach(item=>urls.push({loc:`${base}/blog/${item.slug}`,lastmod:item.updated_at}));
  }
  if (taxonomyResult.status === "fulfilled") {
    taxonomyResult.value.categories.forEach(item=>urls.push({loc:`${base}/blog/categoria/${item.slug}`,lastmod:item.updated_at}));
  }
  const xml=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(item=>`<url><loc>${escapeXml(item.loc)}</loc>${item.lastmod?`<lastmod>${new Date(item.lastmod).toISOString()}</lastmod>`:""}</url>`).join("")}</urlset>`;
  res.setHeader("Content-Type","application/xml");res.setHeader("Cache-Control","public, s-maxage=3600, stale-while-revalidate=86400");res.write(xml);res.end();return{props:{}};
};
