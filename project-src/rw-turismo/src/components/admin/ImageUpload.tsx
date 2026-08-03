import { useState } from "react";
import {
  acceptAttribute,
  ImageUploadError,
  uploadImage,
  type ImageBucket,
} from "../../lib/admin/uploadImage";

type Props = {
  bucket: ImageBucket;
  value?: string | null;
  onChange: (url: string) => void;
};

// Envio simples de uma imagem (logo, favicon, blocos de página). Para capa e
// galeria de produto use ImageField, que combina link + upload.
const ImageUpload = ({ bucket, value, onChange }: Props) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file?: File) => {
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      onChange(await uploadImage(bucket, file));
    } catch (caught) {
      setError(
        caught instanceof ImageUploadError
          ? caught.message
          : "Não foi possível enviar a imagem."
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <input
        accept={acceptAttribute(bucket)}
        disabled={isUploading}
        onChange={(event) => void upload(event.target.files?.[0])}
        type="file"
      />
      {isUploading && (
        <p className="mt-1 text-sm text-gray-500">Enviando...</p>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="Prévia"
          className="mt-3 h-28 max-w-full rounded object-cover"
          src={value}
        />
      )}
    </div>
  );
};

export default ImageUpload;
