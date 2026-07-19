import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

export type VoucherBooking = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  travelers_count: number;
  total_amount: number | string;
  status: string;
  payment_status: string;
  products?: {
    title?: string | null;
    destination?: string | null;
    itinerary?: unknown;
  } | null;
  product_dates?: {
    start_date?: string | null;
    end_date?: string | null;
  } | null;
  passengers?:
    | { full_name: string; document: string | null; type: string }[]
    | null;
};

const brl = (value: number | string) =>
  `R$ ${Number(value).toFixed(2).replace(".", ",")}`;

const dateBR = (iso?: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR") : "-";

const typeLabel = (type: string) =>
  ({ adult: "Adulto", child: "Criança", infant: "Bebê" }[type] ?? type);

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: "#1f2937", fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 2,
    borderBottomColor: "#f97316",
    paddingBottom: 10,
    marginBottom: 16,
  },
  brand: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#ea580c" },
  docTitle: { fontSize: 12, color: "#6b7280" },
  ref: { fontSize: 10, color: "#6b7280", marginBottom: 18 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#9ca3af",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 110, color: "#6b7280" },
  value: { flex: 1, fontFamily: "Helvetica-Bold" },
  total: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#ea580c" },
  paxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingVertical: 3,
  },
  dayTitle: { fontFamily: "Helvetica-Bold", marginTop: 6 },
  dayText: { color: "#374151", marginBottom: 2 },
  footer: {
    marginTop: 24,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    fontSize: 9,
    color: "#9ca3af",
  },
});

const VoucherDocument = ({ booking }: { booking: VoucherBooking }) => {
  const itinerary = Array.isArray(booking.products?.itinerary)
    ? (booking.products?.itinerary as {
        day?: number;
        title?: string;
        description?: string;
      }[])
    : [];
  const passengers = booking.passengers ?? [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>RW Turismo</Text>
          <Text style={styles.docTitle}>Voucher de Reserva</Text>
        </View>
        <Text style={styles.ref}>
          Reserva #{booking.id.slice(0, 8).toUpperCase()} · {booking.status} ·
          pagamento {booking.payment_status}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Viagem</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Produto</Text>
            <Text style={styles.value}>
              {booking.products?.title ?? "Reserva"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Destino</Text>
            <Text style={styles.value}>
              {booking.products?.destination ?? "-"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Período</Text>
            <Text style={styles.value}>
              {dateBR(booking.product_dates?.start_date)} a{" "}
              {dateBR(booking.product_dates?.end_date)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Viajantes</Text>
            <Text style={styles.value}>{booking.travelers_count}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Valor total</Text>
            <Text style={styles.total}>{brl(booking.total_amount)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Titular</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nome</Text>
            <Text style={styles.value}>{booking.customer_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>E-mail</Text>
            <Text style={styles.value}>{booking.customer_email}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Telefone</Text>
            <Text style={styles.value}>{booking.customer_phone ?? "-"}</Text>
          </View>
        </View>

        {passengers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Passageiros</Text>
            {passengers.map((passenger, index) => (
              <View key={index} style={styles.paxRow}>
                <Text>{passenger.full_name}</Text>
                <Text>
                  {typeLabel(passenger.type)}
                  {passenger.document ? ` · ${passenger.document}` : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        {itinerary.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Itinerário</Text>
            {itinerary.map((day, index) => (
              <View key={index}>
                <Text style={styles.dayTitle}>
                  Dia {day.day ?? index + 1}
                  {day.title ? ` — ${day.title}` : ""}
                </Text>
                {day.description ? (
                  <Text style={styles.dayText}>{day.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer}>
          RW Turismo · Este voucher confirma sua reserva. Em caso de dúvida, fale
          com a gente pelos canais de atendimento. Boa viagem!
        </Text>
      </Page>
    </Document>
  );
};

export const renderVoucherPdf = (booking: VoucherBooking): Promise<Buffer> =>
  renderToBuffer(<VoucherDocument booking={booking} />);
