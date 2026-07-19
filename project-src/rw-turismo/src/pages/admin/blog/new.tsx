import { useRouter } from "next/router";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import BlogPostForm from "../../../components/admin/BlogPostForm";
const NewBlogPost=()=>{const router=useRouter();return <AdminGuard><AdminLayout title="Novo post"><BlogPostForm onSaved={post=>void router.push(`/admin/blog/${post.id}`)}/></AdminLayout></AdminGuard>};export default NewBlogPost;
