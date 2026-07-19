import AdminGuard from "../../../components/admin/AdminGuard";
import PageBuilder from "../../../components/admin/builder/PageBuilder";

const NewPage = () => (
  <AdminGuard>
    <PageBuilder page={null} />
  </AdminGuard>
);

export default NewPage;
