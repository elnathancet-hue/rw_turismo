import { createSupabaseBrowserClient } from "../supabase/browser";

// Upload de imagem para o Supabase Storage — fonte única usada pelo ImageUpload
// (logo, favicon, blocos de página) e pelo ImageField (capa e galeria dos
// produtos). Centralizado para que a validação do navegador case com o que o
// bucket aceita: divergir aqui vira erro só na hora de enviar.

export type ImageBucket = "site-assets" | "product-images" | "blog-images";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Espelha allowed_mime_types de storage.buckets em supabase/schema.sql.
// site-assets aceita svg/ico porque guarda logo e favicon; as fotos de produto
// e do blog são só foto mesmo.
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const ALLOWED_TYPES_BY_BUCKET: Record<ImageBucket, string[]> = {
  "site-assets": [...PHOTO_TYPES, "image/svg+xml", "image/x-icon"],
  "product-images": PHOTO_TYPES,
  "blog-images": PHOTO_TYPES,
};

export const acceptAttribute = (bucket: ImageBucket): string =>
  ALLOWED_TYPES_BY_BUCKET[bucket].join(",");

export class ImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageUploadError";
  }
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
};

const formatMegabytes = (bytes: number) =>
  `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;

export const validateImage = (bucket: ImageBucket, file: File): void => {
  if (!ALLOWED_TYPES_BY_BUCKET[bucket].includes(file.type)) {
    throw new ImageUploadError(
      `"${file.name}" não é um formato aceito aqui. Use JPG, PNG ou WEBP.`
    );
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageUploadError(
      `"${file.name}" tem ${formatMegabytes(file.size)}. O limite é 5 MB.`
    );
  }
};

// Envia e devolve a URL pública. A extensão vem do tipo do arquivo, não do
// nome: foto vinda do celular às vezes chega sem extensão ou com maiúscula.
export const uploadImage = async (
  bucket: ImageBucket,
  file: File
): Promise<string> => {
  validateImage(bucket, file);

  const extension =
    EXTENSION_BY_TYPE[file.type] ??
    file.name.split(".").pop()?.toLowerCase() ??
    "jpg";
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${extension}`;

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: "31536000", upsert: false });

  if (error) {
    // Causa mais comum em produção: sessão sem permissão de escrita no bucket.
    throw new ImageUploadError(
      `Não foi possível enviar "${file.name}". ${error.message}`
    );
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};
