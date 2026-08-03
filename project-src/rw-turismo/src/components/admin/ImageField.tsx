import { useRef, useState } from "react";
import { Input } from "../ui/form";
import {
  acceptAttribute,
  ImageUploadError,
  uploadImage,
  type ImageBucket,
} from "../../lib/admin/uploadImage";

type Props = {
  bucket: ImageBucket;
  value: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  placeholder?: string;
};

// Uma imagem por dois caminhos: colar o link de sempre OU enviar do
// computador/celular. O campo de texto continua sendo a fonte da verdade — o
// upload só preenche ele com a URL pública —, então nada muda para quem já
// trabalha com links e o valor salvo no banco é o mesmo dos dois jeitos.
const ImageField = ({
  bucket,
  value,
  onChange,
  onRemove,
  placeholder = "https://… ou envie do computador",
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
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
      // Permite reenviar o mesmo arquivo depois de um erro.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="flex items-start gap-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt="Prévia"
            className="mt-1 h-16 w-16 shrink-0 rounded border object-cover"
            src={value}
          />
        ) : (
          <div className="mt-1 flex h-16 w-16 shrink-0 items-center justify-center rounded border border-dashed bg-gray-50 text-xs text-gray-400">
            sem foto
          </div>
        )}

        <div className="flex-1">
          <Input
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            value={value}
          />
          <div className="mt-1 flex items-center gap-3">
            <button
              className="text-sm font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-60"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              {isUploading ? "Enviando…" : "Enviar do computador"}
            </button>
            {value && !isUploading && (
              <button
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={() => onChange("")}
                type="button"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {onRemove && (
          <button
            aria-label="Remover foto"
            className="mt-1 rounded border px-3 py-2 text-red-600 hover:bg-red-50"
            onClick={onRemove}
            type="button"
          >
            ✕
          </button>
        )}
      </div>

      <input
        accept={acceptAttribute(bucket)}
        className="hidden"
        onChange={(event) => void upload(event.target.files?.[0])}
        ref={inputRef}
        type="file"
      />

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export default ImageField;
