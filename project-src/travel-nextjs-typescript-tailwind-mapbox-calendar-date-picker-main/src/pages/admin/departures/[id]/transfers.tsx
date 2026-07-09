import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useState } from "react";
import AdminGuard from "../../../../components/admin/AdminGuard";
import AdminLayout from "../../../../components/admin/AdminLayout";
import ConfirmButton from "../../../../components/admin/ConfirmButton";
import DepartureTabs from "../../../../components/admin/DepartureTabs";
import Button from "../../../../components/ui/Button";
import Card from "../../../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../../../components/ui/form";
import {
  createAdminTransfer,
  deleteAdminTransfer,
  getAdminDeparture,
  listAdminSuppliers,
  listDepartureTransfers,
  updateAdminTransfer,
  type AdminDeparture,
  type Supplier,
  type Transfer,
  type TransferFormValues,
} from "../../../../lib/admin/client";
import { formatDateBR, formatDateRangeBR } from "../../../../lib/format";

const emptyValues: TransferFormValues = {
  title: "",
  transfer_date: "",
  transfer_time: "",
  meeting_point: "",
  driver_name: "",
  driver_phone: "",
  vehicle: "",
  supplier_id: "",
  capacity: null,
  notes: "",
};

const AdminDepartureTransfers = () => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [departure, setDeparture] = useState<AdminDeparture | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [values, setValues] = useState<TransferFormValues>(emptyValues);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadTransfers = async () => {
    if (!id) return;
    setTransfers(await listDepartureTransfers(id));
  };

  useEffect(() => {
    if (!id) return;
    setLoadStatus("loading");
    Promise.all([
      getAdminDeparture(id),
      listDepartureTransfers(id),
      listAdminSuppliers().catch(() => [] as Supplier[]),
    ])
      .then(([dep, list, sups]) => {
        setDeparture(dep);
        setTransfers(list);
        setSuppliers(sups.filter((s) => s.active));
        setLoadStatus("ready");
      })
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível carregar os transfers. A migration da Fase 2 já rodou?"
        );
        setLoadStatus("error");
      });
  }, [id]);

  const set = <K extends keyof TransferFormValues>(
    key: K,
    value: TransferFormValues[K]
  ) => setValues((current) => ({ ...current, [key]: value }));

  const resetForm = () => {
    setValues(emptyValues);
    setEditingId(null);
  };

  const startEditing = (transfer: Transfer) => {
    setEditingId(transfer.id);
    setValues({
      title: transfer.title,
      transfer_date: transfer.transfer_date ?? "",
      transfer_time: transfer.transfer_time ?? "",
      meeting_point: transfer.meeting_point ?? "",
      driver_name: transfer.driver_name ?? "",
      driver_phone: transfer.driver_phone ?? "",
      vehicle: transfer.vehicle ?? "",
      supplier_id: transfer.supplier_id ?? "",
      capacity: transfer.capacity,
      notes: transfer.notes ?? "",
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!id) return;
    setMessage(null);
    setError(null);
    setIsSaving(true);
    try {
      if (editingId) {
        await updateAdminTransfer(editingId, id, values);
      } else {
        await createAdminTransfer(id, values);
      }
      setMessage("Transfer salvo.");
      resetForm();
      await loadTransfers();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível salvar o transfer."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminGuard>
      <AdminLayout
        title="Transfers"
        description="Traslados da saída: motorista, horário e ponto de encontro."
      >
        <Link
          className="text-sm font-semibold text-orange-600 hover:text-orange-700"
          href="/admin/departures"
        >
          ← Voltar para saídas
        </Link>
        {id && <DepartureTabs active="transfers" id={id} />}

        {loadStatus === "loading" && (
          <p className="mt-6 text-gray-500">Carregando…</p>
        )}
        {error && (
          <p
            className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        {loadStatus === "ready" && departure && (
          <div className="mt-4 grid gap-6 lg:grid-cols-[380px_1fr]">
            <Card className="h-fit p-5">
              <h2 className="text-lg font-semibold">
                {editingId ? "Editar transfer" : "Novo transfer"}
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                {departure.products?.title} ·{" "}
                {formatDateRangeBR(departure.start_date, departure.end_date)}
              </p>
              <form className="mt-4 space-y-4" onSubmit={submit}>
                <Field label="Trajeto">
                  <Input
                    onChange={(event) => set("title", event.target.value)}
                    placeholder="Ex.: Aeroporto → Hotel"
                    required
                    value={values.title}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Data">
                    <Input
                      onChange={(event) =>
                        set("transfer_date", event.target.value)
                      }
                      type="date"
                      value={values.transfer_date}
                    />
                  </Field>
                  <Field label="Horário">
                    <Input
                      onChange={(event) =>
                        set("transfer_time", event.target.value)
                      }
                      type="time"
                      value={values.transfer_time}
                    />
                  </Field>
                </div>
                <Field label="Ponto de encontro">
                  <Input
                    onChange={(event) =>
                      set("meeting_point", event.target.value)
                    }
                    placeholder="Ex.: Portão 2 do aeroporto"
                    value={values.meeting_point}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Motorista">
                    <Input
                      onChange={(event) =>
                        set("driver_name", event.target.value)
                      }
                      value={values.driver_name}
                    />
                  </Field>
                  <Field label="Telefone do motorista">
                    <Input
                      onChange={(event) =>
                        set("driver_phone", event.target.value)
                      }
                      value={values.driver_phone}
                    />
                  </Field>
                  <Field label="Veículo">
                    <Input
                      onChange={(event) => set("vehicle", event.target.value)}
                      placeholder="Ex.: Van branca ABC-1234"
                      value={values.vehicle}
                    />
                  </Field>
                  <Field label="Capacidade">
                    <Input
                      min={1}
                      onChange={(event) =>
                        set(
                          "capacity",
                          event.target.value
                            ? Number(event.target.value)
                            : null
                        )
                      }
                      type="number"
                      value={values.capacity ?? ""}
                    />
                  </Field>
                </div>
                <Field label="Fornecedor (transporte)">
                  <Select
                    onChange={(event) =>
                      set("supplier_id", event.target.value)
                    }
                    value={values.supplier_id}
                  >
                    <option value="">Sem fornecedor</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Observações">
                  <Textarea
                    className="min-h-[70px]"
                    onChange={(event) => set("notes", event.target.value)}
                    value={values.notes}
                  />
                </Field>
                {message && (
                  <p className="text-sm text-green-700" role="status">
                    {message}
                  </p>
                )}
                <div className="flex gap-3">
                  <Button loading={isSaving} type="submit">
                    {isSaving ? "Salvando…" : editingId ? "Salvar" : "Criar"}
                  </Button>
                  {editingId && (
                    <Button
                      onClick={resetForm}
                      type="button"
                      variant="secondary"
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </Card>

            <div className="space-y-3">
              {transfers.length === 0 && (
                <Card className="p-8 text-center text-gray-500">
                  Nenhum transfer nesta saída ainda. Cadastre o primeiro ao
                  lado.
                </Card>
              )}
              {transfers.map((transfer) => (
                <Card className="p-4" key={transfer.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{transfer.title}</p>
                      <p className="mt-0.5 text-sm text-gray-600">
                        {[
                          transfer.transfer_date
                            ? formatDateBR(transfer.transfer_date)
                            : null,
                          transfer.transfer_time
                            ? `às ${transfer.transfer_time.slice(0, 5)}`
                            : null,
                          transfer.meeting_point,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Sem data/horário definidos"}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        {[
                          transfer.driver_name
                            ? `Motorista: ${transfer.driver_name}`
                            : null,
                          transfer.driver_phone,
                          transfer.vehicle,
                          transfer.suppliers?.name,
                          transfer.capacity
                            ? `${transfer.capacity} lugares`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {transfer.notes && (
                        <p className="mt-1 text-xs text-gray-500">
                          {transfer.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-3">
                      <button
                        className="font-semibold text-orange-600 hover:text-orange-700"
                        onClick={() => startEditing(transfer)}
                        type="button"
                      >
                        Editar
                      </button>
                      <ConfirmButton
                        confirmLabel="Excluir transfer"
                        message={`Excluir o transfer "${transfer.title}"?`}
                        onConfirm={() => deleteAdminTransfer(transfer.id)}
                        onDone={loadTransfers}
                      >
                        Excluir
                      </ConfirmButton>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminDepartureTransfers;
