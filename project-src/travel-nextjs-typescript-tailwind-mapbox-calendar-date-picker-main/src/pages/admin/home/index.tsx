import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import HomeEditor from "../../../components/admin/HomeEditor";
const AdminHome = () => (
  <AdminGuard><AdminLayout title="Home editável" description="Edite o conteúdo que aparece na página inicial da RW Turismo."><HomeEditor /></AdminLayout></AdminGuard>
);
export default AdminHome;
