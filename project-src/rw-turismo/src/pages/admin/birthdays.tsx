import { useEffect, useMemo, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminListState from "../../components/admin/AdminListState";
import Button from "../../components/ui/Button";
import { Select } from "../../components/ui/form";
import {
  listBirthdayPeople,
  type BirthdayPerson,
} from "../../lib/admin/client";
import { downloadCsv } from "../../lib/csv";

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// "1995-07-15" → { day: 15, month: 7, year: 1995 } sem sofrer com fuso.
const parseBirth = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return { year: year ?? 0, month: month ?? 0, day: day ?? 0 };
};

const toWhatsAppLink = (phone: string | null): string | null => {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return `https://wa.me/${digits}`;
};

const AdminBirthdays = () => {
  const [people, setPeople] = useState<BirthdayPerson[]>([]);
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoadStatus("loading");
    setError(null);
    try {
      setPeople(await listBirthdayPeople());
      setLoadStatus("ready");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar os aniversariantes."
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const ofMonth = useMemo(() => {
    const seen = new Set<string>();
    return people
      .filter((person) => parseBirth(person.birth_date).month === month)
      .filter((person) => {
        const key = `${person.name.trim().toLowerCase()}|${person.birth_date}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(
        (a, b) => parseBirth(a.birth_date).day - parseBirth(b.birth_date).day
      );
  }, [people, month]);

  const currentYear = new Date().getFullYear();

  const exportCsv = () => {
    downloadCsv(`aniversariantes-${monthNames[month - 1]}.csv`, [
      ["Dia", "Nome", "Nascimento", "Faz (anos)", "Origem", "Telefone"],
      ...ofMonth.map((person) => {
        const birth = parseBirth(person.birth_date);
        return [
          birth.day,
          person.name,
          person.birth_date,
          birth.year ? currentYear - birth.year : "",
          person.source === "cliente" ? "Cliente" : "Passageiro",
          person.phone,
        ];
      }),
    ]);
  };

  return (
    <AdminGuard>
      <AdminLayout
        title="Aniversariantes"
        description="Nascimentos de passageiros e clientes — mande os parabéns (e uma oferta)."
      >
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="block text-sm font-medium text-gray-700">
            Mês
            <Select
              className="mt-1 w-44"
              onChange={(event) => setMonth(Number(event.target.value))}
              value={month}
            >
              {monthNames.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </Select>
          </label>
          <Button onClick={exportCsv} type="button" variant="secondary">
            Exportar CSV
          </Button>
        </div>

        <AdminListState
          emptyHint="Cadastre a data de nascimento dos passageiros nas reservas (e dos clientes no perfil) para alimentar este relatório."
          emptyTitle={`Nenhum aniversariante em ${monthNames[month - 1]}`}
          error={error}
          isEmpty={ofMonth.length === 0}
          onRetry={load}
          status={loadStatus}
        >
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Dia</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Faz</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3 text-right">Contato</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ofMonth.map((person, index) => {
                  const birth = parseBirth(person.birth_date);
                  const wa = toWhatsAppLink(person.phone);
                  return (
                    <tr key={`${person.name}-${person.birth_date}-${index}`}>
                      <td className="px-4 py-3 font-semibold">
                        {String(birth.day).padStart(2, "0")}/
                        {String(month).padStart(2, "0")}
                      </td>
                      <td className="px-4 py-3">{person.name}</td>
                      <td className="px-4 py-3">
                        {birth.year ? `${currentYear - birth.year} anos` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {person.source === "cliente" ? "Cliente" : "Passageiro"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {wa ? (
                          <a
                            className="font-semibold text-green-700 hover:text-green-800"
                            href={wa}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            WhatsApp →
                          </a>
                        ) : (
                          <span className="text-gray-400">sem telefone</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AdminListState>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminBirthdays;
