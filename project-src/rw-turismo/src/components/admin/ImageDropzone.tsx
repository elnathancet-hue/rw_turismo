import { useRef, useState, type DragEvent } from "react";
import {
  acceptAttribute,
  ImageUploadError,
  uploadImage,
  type ImageBucket,
} from "../../lib/admin/uploadImage";

type Props = {
  bucket: ImageBucket;
  onUploaded: (urls: string[]) => void;
};

// Envio de várias fotos de uma vez (galeria da viagem). Arrasta ou clica.
// Um arquivo que falha não derruba os outros: sobe o que dá e lista o que não
// foi, para não perder um envio de 15 fotos por causa de uma fora do padrão.
const ImageDropzone = ({ bucket, onUploaded }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [errors, setErrors] = useState<string[]>([]);

  const uploadAll = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    setErrors([]);
    setProgress({ done: 0, total: files.length });

    const urls: string[] = [];
    const failures: string[] = [];

    // Sequencial de propósito: 15 uploads paralelos de celular costumam
    // estourar a conexão e falhar em bloco.
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]!;
      try {
        urls.push(await uploadImage(bucket, file));
      } catch (caught) {
        failures.push(
          caught instanceof ImageUploadError
            ? caught.message
            : `Falha ao enviar "${file.name}".`
        );
      }
      setProgress({ done: index + 1, total: files.length });
    }

    if (urls.length > 0) onUploaded(urls);
    setErrors(failures);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void uploadAll(event.dataTransfer.files);
  };

  const isBusy = progress !== null;

  return (
    <div>
      <div
        className={`rounded-lg border-2 border-dashed p-4 text-center transition ${
          isDragging
            ? "border-orange-400 bg-orange-50"
            : "border-gray-300 bg-gray-50"
        }`}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDrop={onDrop}
      >
        {isBusy ? (
          <p className="text-sm text-gray-600">
            Enviando {progress.done} de {progress.total}…
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Arraste as fotos da viagem aqui
            </p>
            <button
              className="mt-1 text-sm font-semibold text-orange-600 hover:text-orange-700"
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              ou clique para escolher várias
            </button>
            <p className="mt-1 text-xs text-gray-400">
              JPG, PNG ou WEBP, até 5 MB cada
            </p>
          </>
        )}
      </div>

      <input
        accept={acceptAttribute(bucket)}
        className="hidden"
        multiple
        onChange={(event) => void uploadAll(event.target.files)}
        ref={inputRef}
        type="file"
      />

      {errors.length > 0 && (
        <ul className="mt-2 space-y-1">
          {errors.map((message) => (
            <li className="text-sm text-red-600" key={message}>
              {message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ImageDropzone;
