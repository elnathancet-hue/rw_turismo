import AdminGuard from "../../../components/admin/AdminGuard";
import HomeBuilder from "../../../components/admin/builder/HomeBuilder";

const AdminHome = () => (
  <AdminGuard>
    <HomeBuilder />
  </AdminGuard>
);

export default AdminHome;
