import type { GetServerSideProps } from "next";
const Robots=()=>null;export default Robots;
export const getServerSideProps:GetServerSideProps=async({res})=>{const base=(process.env.NEXT_PUBLIC_SITE_URL||"").replace(/\/+$/,"");res.setHeader("Content-Type","text/plain");res.write(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /api\nDisallow: /signin\nDisallow: /auth\nDisallow: /forgot-password\nDisallow: /reset-password\n\nSitemap: ${base}/sitemap.xml\n`);res.end();return{props:{}}};
