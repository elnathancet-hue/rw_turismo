import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import BlogPostForm from "../../../components/admin/BlogPostForm";
import { getAdminBlogPost } from "../../../lib/content/client";
import type { BlogPost } from "../../../lib/content/types";
const EditBlogPost=()=>{const router=useRouter();const[post,setPost]=useState<BlogPost|null>();useEffect(()=>{if(router.query.id)void getAdminBlogPost(String(router.query.id)).then(setPost)},[router.query.id]);return <AdminGuard><AdminLayout title="Editar post">{post===undefined?<p>Carregando...</p>:post?<BlogPostForm onSaved={setPost} post={post}/>:<p>Post não encontrado.</p>}</AdminLayout></AdminGuard>};export default EditBlogPost;
