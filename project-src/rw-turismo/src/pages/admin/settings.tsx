import { FormEvent, useEffect, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import ImageUpload from "../../components/admin/ImageUpload";
import { listAdminSettings, saveAdminSetting } from "../../lib/content/client";
import type { SiteSetting } from "../../lib/content/types";
const keys = ["site_identity","home_seo","contact","social_links","footer","default_seo"];
const AdminSettings = () => {
  const [items,setItems]=useState<SiteSetting[]>([]); const [key,setKey]=useState("site_identity"); const [json,setJson]=useState("{}"); const [error,setError]=useState<string|null>(null);
  const load=async()=>setItems(await listAdminSettings()); useEffect(()=>{void load()},[]);
  useEffect(()=>{const item=items.find(i=>i.setting_key===key);setJson(JSON.stringify(item?.value??{},null,2))},[key,items]);
  const submit=async(e:FormEvent)=>{e.preventDefault();try{await saveAdminSetting(key,JSON.parse(json));await load()}catch{setError("JSON inválido ou configuração não salva.")}};
  const current=items.find(i=>i.setting_key===key)?.value??{};
  return <AdminGuard><AdminLayout title="Configurações do site"><form className="max-w-3xl space-y-5 rounded-xl border bg-white p-6" onSubmit={submit}><label className="block text-sm">Grupo<select className="mt-1 w-full rounded border px-3 py-2" onChange={e=>setKey(e.target.value)} value={key}>{keys.map(k=><option key={k}>{k}</option>)}</select></label>{key==="site_identity"&&<ImageUpload bucket="site-assets" onChange={url=>setJson(JSON.stringify({...current,logo:url},null,2))} value={current.logo}/>}<label className="block text-sm">Valor JSON<textarea className="mt-1 min-h-[300px] w-full rounded border p-3 font-mono text-xs" onChange={e=>setJson(e.target.value)} value={json}/></label>{error&&<p className="text-red-600">{error}</p>}<button className="rounded bg-orange-500 px-5 py-2 font-semibold text-white">Salvar configurações</button></form></AdminLayout></AdminGuard>;
};
export default AdminSettings;
