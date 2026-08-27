import { createSupabaseAdminClient } from "../supabase/admin";

// Documento do passageiro: upload por URL assinada em bucket PRIVADO.
//
// Por que não reaproveitar lib/admin/uploadImage.ts: os três buckets dele são
// `public = true` e ele devolve getPublicUrl(). Documento de passageiro — ainda
// mais de menor de idade — numa URL pública e permanente é vazamento sem
// revogação possível.
//
// Por que URL assinada em vez de o cliente enviar direto pelo RLS: na compra
// sem cadastro o navegador não tem sessão, então não existe auth.uid() para uma
// policy avaliar. O servidor confere a posse da reserva e só então emite uma
// permissão de escrita curta, para um caminho específico.

export class PassengerDocumentError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "PassengerDocumentError";
    this.statusCode = statusCode;
  }
}

export const DOCUMENT_BUCKET = "booking-documents";

// Espelha allowed_mime_types do bucket. PDF entra aqui e em nenhum outro bucket
// do projeto: documento digitalizado quase sempre chega em PDF.
export const DOCUMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

// Validade curta: o link serve para a pessoa abrir o arquivo agora, não para
// virar um endereço permanente que circula por aí.
const VIEW_URL_TTL_SECONDS = 300;

const admin = () => createSupabaseAdminClient() as any;

type PassengerRow = {
  id: string;
  booking_id: string;
  full_name: string;
  document_status: string;
  document_path: string | null;
};

// Confere que o passageiro é DESTA reserva e que a reserva ainda aceita
// documento (pendente, não paga e dentro do prazo). Sem o vínculo, quem tivesse
// um passenger_id qualquer escreveria na reserva de outra pessoa.
const loadPassengerForUpload = async (
  bookingId: string,
  passengerId: string
): Promise<PassengerRow> => {
  const { data: booking } = await admin()
    .from("bookings")
    .select("id, status, payment_status, expires_at")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) {
    throw new PassengerDocumentError("Reserva não encontrada.", 404);
  }

  if (booking.status !== "pending" || booking.payment_status !== "pending") {
    throw new PassengerDocumentError(
      "Esta reserva não aceita mais envio de documento.",
      409
    );
  }

  if (booking.expires_at && new Date(booking.expires_at).getTime() < Date.now()) {
    throw new PassengerDocumentError("O prazo desta reserva expirou.", 409);
  }

  const { data: passenger } = await admin()
    .from("passengers")
    .select("id, booking_id, full_name, document_status, document_path")
    .eq("id", passengerId)
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (!passenger) {
    throw new PassengerDocumentError("Passageiro não encontrado.", 404);
  }

  return passenger as PassengerRow;
};

// Caminho {booking_id}/{passenger_id}/{arquivo}: é a estrutura de pastas que
// permite a policy do Storage escopar "só o dono desta reserva". Caminho plano,
// como o dos buckets de imagem, tornaria essa regra impossível de escrever.
export const createDocumentUploadUrl = async (
  bookingId: string,
  passengerId: string,
  contentType: string
): Promise<{ path: string; token: string }> => {
  if (!DOCUMENT_MIME_TYPES.includes(contentType)) {
    throw new PassengerDocumentError(
      "Formato não aceito. Envie JPG, PNG, WEBP ou PDF.",
      400
    );
  }

  const passenger = await loadPassengerForUpload(bookingId, passengerId);

  const extension = EXTENSION_BY_TYPE[contentType] ?? "bin";
  const path = `${bookingId}/${passenger.id}/${crypto.randomUUID()}.${extension}`;

  const { data, error } = await admin()
    .storage.from(DOCUMENT_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data?.token) {
    throw new PassengerDocumentError(
      "Não foi possível preparar o envio do documento.",
      500
    );
  }

  return { path, token: data.token as string };
};

export const confirmDocumentUpload = async (
  bookingId: string,
  passengerId: string,
  path: string
): Promise<void> => {
  const passenger = await loadPassengerForUpload(bookingId, passengerId);

  // O caminho tem que ser o desta reserva E deste passageiro: sem isto, alguém
  // apontaria o registro para um arquivo de outra reserva.
  if (!path.startsWith(`${bookingId}/${passenger.id}/`)) {
    throw new PassengerDocumentError("Arquivo inválido.", 400);
  }

  const antigo = passenger.document_path;

  const { error } = await admin()
    .from("passengers")
    .update({
      document_path: path,
      document_status: "uploaded",
      document_uploaded_at: new Date().toISOString(),
      document_verified_at: null,
    })
    .eq("id", passenger.id)
    .eq("booking_id", bookingId);

  if (error) {
    throw new PassengerDocumentError(
      "Não foi possível registrar o documento.",
      500
    );
  }

  // Reenvio: apaga o anterior em vez de acumular documento de menor esquecido
  // no bucket. Falha aqui não desfaz o envio novo — só fica o lixo.
  if (antigo && antigo !== path) {
    await admin()
      .storage.from(DOCUMENT_BUCKET)
      .remove([antigo])
      .catch(() => {});
  }
};

// Quem ainda trava o pagamento. É a consulta do portão do checkout.
export const countPendingDocuments = async (
  bookingId: string
): Promise<number> => {
  const { count, error } = await admin()
    .from("passengers")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    // "resend" volta a travar de propósito: se a operação recusou o arquivo, a
    // exigência do documento não foi cumprida — o estado é o mesmo de "pending".
    .in("document_status", ["pending", "resend"]);

  // Falha ao consultar NÃO libera o pagamento: tratar erro como "zero pendente"
  // deixaria o portão aberto justamente quando o banco está instável.
  if (error) {
    throw new PassengerDocumentError(
      "Não foi possível conferir os documentos da reserva.",
      503
    );
  }

  return count ?? 0;
};

// Link temporário para a operação conferir o documento. Nunca é URL pública.
export const createDocumentViewUrl = async (
  path: string
): Promise<string | null> => {
  const { data, error } = await admin()
    .storage.from(DOCUMENT_BUCKET)
    .createSignedUrl(path, VIEW_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl as string;
};

// Retenção: apaga o arquivo do documento depois que a viagem passou.
//
// Guardar documento de passageiro — ainda mais de menor — para sempre é o
// oposto do princípio da necessidade: o arquivo servia para embarcar, e o
// embarque já aconteceu. A RPC limpa o registro em lotes de 200 e devolve os
// caminhos; apagar o arquivo no Storage é responsabilidade daqui.
export const DOCUMENT_RETENTION_DAYS = 90;

export const purgeExpiredDocuments = async (
  days: number = DOCUMENT_RETENTION_DAYS
): Promise<number> => {
  let removidos = 0;

  // Teto de voltas para o cron não virar laço infinito se algo der errado no
  // meio: o resto sai na execução do dia seguinte.
  for (let volta = 0; volta < 10; volta += 1) {
    const { data, error } = await admin().rpc("expire_booking_documents", {
      p_days: days,
    });

    if (error) {
      throw new PassengerDocumentError(
        "Não foi possível executar a retenção de documentos.",
        500
      );
    }

    const lote = (data ?? []) as Array<{ document_path: string | null }>;
    if (lote.length === 0) break;

    const caminhos = lote
      .map((linha) => linha.document_path)
      .filter((caminho): caminho is string => Boolean(caminho));

    if (caminhos.length > 0) {
      // O registro já foi limpo pela RPC. Se a remoção do arquivo falhar, sobra
      // um órfão no bucket sem ligação com passageiro nenhum — ruim, mas não
      // impede o restante do expurgo de continuar.
      const { error: removeError } = await admin()
        .storage.from(DOCUMENT_BUCKET)
        .remove(caminhos);
      if (removeError) {
        console.error("purge de documentos: falha ao remover arquivos", removeError);
      }
    }

    removidos += lote.length;
  }

  return removidos;
};
