import Link from "next/link";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
const AdminHome = () => (
  <AdminGuard><AdminLayout title="Home editável" description="Gerencie o conteúdo público da página inicial."><div className="grid gap-5 md:grid-cols-2"><Link className="rounded-xl border bg-white p-6 shadow-sm" href="/admin/home/banners"><h2 className="text-xl font-semibold">Banners</h2><p className="mt-2 text-gray-600">Imagens, chamadas, links e período de exibição.</p></Link><Link className="rounded-xl border bg-white p-6 shadow-sm" href="/admin/home/sections"><h2 className="text-xl font-semibold">Seções</h2><p className="mt-2 text-gray-600">Ordem, visibilidade, títulos e conteúdo estruturado.</p></Link></div></AdminLayout></AdminGuard>
);
export default AdminHome;
