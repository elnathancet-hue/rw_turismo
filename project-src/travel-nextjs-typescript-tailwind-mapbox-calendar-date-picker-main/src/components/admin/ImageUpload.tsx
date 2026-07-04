import { useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

type Props = { bucket: "site-assets" | "product-images" | "blog-images"; value?: string | null; onChange: (url: string) => void };
const ImageUpload = ({ bucket, value, onChange }: Props) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = async (file?: File) => {
    if (!file) return;
    setError(null);
    if (!["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/x-icon"].includes(file.type)) return setError("Formato de imagem não permitido.");
    if (file.size > 5 * 1024 * 1024) return setError("A imagem deve ter no máximo 5 MB.");
    setIsUploading(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${extension}`;
      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
    } catch {
      setError("Não foi possível enviar a imagem.");
    } finally {
      setIsUploading(false);
    }
  };
  return (
    <div>
      <input accept="image/jpeg,image/png,image/webp,image/svg+xml,image/x-icon" disabled={isUploading} onChange={(event) => void upload(event.target.files?.[0])} type="file" />
      {isUploading && <p className="mt-1 text-sm text-gray-500">Enviando...</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {value && <img alt="Prévia" className="mt-3 h-28 max-w-full rounded object-cover" src={value} />}
    </div>
  );
};
export default ImageUpload;
