import { FormEvent, useEffect, useMemo, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import ConfirmButton from "../../components/admin/ConfirmButton";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../components/ui/form";
import {
  addLeadActivity,
  createLead,
  deleteLead,
  getCrmStages,
  importWaitlistLeads,
  listLeadActivities,
  listLeads,
  saveCrmStages,
  sourceLabels,
  stageId as newStageId,
  updateLead,
  type CrmStage,
  type Lead,
  type LeadActivity,
  type LeadFormValues,
} from "../../lib/admin/crm";
import { formatDateTimeBR } from "../../lib/format";

const emptyLead: LeadFormValues = {
  name: "",
  email: "",
  phone: "",
  interest: "",
  source: "manual",
};

const toWhatsAppLink = (phone: string | null): string | null => {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return `https://wa.me/${digits}`;
};

const AdminCrm = () => {
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // painéis
  const [showNewLead, setShowNewLead] = useState(false);
  const [showStages, setShowStages] = useState(false);
  const [newLead, setNewLead] = useState<LeadFormValues>(emptyLead);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [stageDrafts, setStageDrafts] = useState<CrmStage[]>([]);
  const [isSavingStages, setIsSavingStages] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // detalhe
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailValues, setDetailValues] = useState<LeadFormValues & {
    stage_id: string;
  }>({ ...emptyLead, stage_id: "" });
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isSavingDetail, setIsSavingDetail] = useState(false);

  // drag
  const [dragId, setDragId] = useState<string | null>(null);

  const selectedLead = leads.find((l) => l.id === selectedId) ?? null;

  const load = async () => {
    setLoadStatus("loading");
    setError(null);
    try {
      const [stageList, leadList] = await Promise.all([
        getCrmStages(),
        listLeads(),
      ]);
      setStages(stageList);
      setStageDrafts(stageList);
      setLeads(leadList);
      setLoadStatus("ready");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar o CRM. A migration da Fase 4 já rodou?"
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedLead) return;
    setDetailValues({
      name: selectedLead.name,
      email: selectedLead.email ?? "",
      phone: selectedLead.phone ?? "",
      interest: selectedLead.interest ?? "",
      source: selectedLead.source,
      stage_id: selectedLead.stage_id,
    });
    setActivities([]);
    listLeadActivities(selectedLead.id)
      .then(setActivities)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const byStage = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const lead of leads) {
      const key = map.has(lead.stage_id) ? lead.stage_id : stages[0]?.id;
      if (!key) continue;
      map.get(key)!.push(lead);
    }
    map.forEach((list) => {
      list.sort((a, b) => a.position - b.position);
    });
    return map;
  }, [leads, stages]);

  const moveLead = async (lead: Lead, stageIdValue: string) => {
    if (lead.stage_id === stageIdValue) return;
    const previous = lead.stage_id;
    const position = Date.now();
    setLeads((current) =>
      current.map((l) =>
        l.id === lead.id ? { ...l, stage_id: stageIdValue, position } : l
      )
    );
    try {
      await updateLead(lead.id, { stage_id: stageIdValue, position });
    } catch {
      setLeads((current) =>
        current.map((l) =>
          l.id === lead.id ? { ...l, stage_id: previous } : l
        )
      );
      setError("Não foi possível mover o lead. Tente novamente.");
    }
  };

  const submitNewLead = async (event: FormEvent) => {
    event.preventDefault();
    if (!stages[0]) return;
    setIsSavingLead(true);
    setError(null);
    try {
      const created = await createLead(newLead, stages[0].id);
      setLeads((current) => [...current, created]);
      setNewLead(emptyLead);
      setShowNewLead(false);
      setNotice("Lead criado.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível criar o lead."
      );
    } finally {
      setIsSavingLead(false);
    }
  };

  const submitStages = async () => {
    const cleaned = stageDrafts
      .map((s) => ({ ...s, label: s.label.trim() }))
      .filter((s) => s.label);
    if (cleaned.length === 0) return;
    setIsSavingStages(true);
    setError(null);
    try {
      const saved = await saveCrmStages(cleaned);
      setStages(saved);
      setStageDrafts(saved);
      setShowStages(false);
      setNotice("Etapas salvas.");
    } catch {
      setError("Não foi possível salvar as etapas.");
    } finally {
      setIsSavingStages(false);
    }
  };

  const runImport = async () => {
    if (!stages[0]) return;
    setIsImporting(true);
    setError(null);
    setNotice(null);
    try {
      const count = await importWaitlistLeads(stages[0].id);
      if (count > 0) await load();
      setNotice(
        count === 0
          ? "Nenhum interessado novo na lista de espera."
          : `${count} ${count === 1 ? "lead importado" : "leads importados"} da lista de espera.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível importar a lista de espera."
      );
    } finally {
      setIsImporting(false);
    }
  };

  const saveDetail = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedLead) return;
    setIsSavingDetail(true);
    try {
      const updated = await updateLead(selectedLead.id, {
        name: detailValues.name.trim(),
        email: detailValues.email.trim().toLowerCase() || null,
        phone: detailValues.phone.trim() || null,
        interest: detailValues.interest.trim() || null,
        source: detailValues.source,
        stage_id: detailValues.stage_id,
      });
      setLeads((current) =>
        current.map((l) => (l.id === updated.id ? updated : l))
      );
      setNotice("Lead salvo.");
    } catch {
      setError("Não foi possível salvar o lead.");
    } finally {
      setIsSavingDetail(false);
    }
  };

  const submitNote = async () => {
    if (!selectedLead || !newNote.trim()) return;
    try {
      const activity = await addLeadActivity(selectedLead.id, newNote);
      setActivities((current) => [activity, ...current]);
      setNewNote("");
    } catch {
      setError("Não foi possível salvar a anotação.");
    }
  };

  return (
    <AdminGuard>
      <AdminLayout
        title="CRM"
        description="Pipeline de leads: arraste os cards entre as etapas (ou use as setas)."
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <Button onClick={() => setShowNewLead((v) => !v)} type="button">
            + Novo lead
          </Button>
          <Button
            loading={isImporting}
            onClick={runImport}
            type="button"
            variant="secondary"
          >
            Importar lista de espera
          </Button>
          <Button
            onClick={() => setShowStages((v) => !v)}
            type="button"
            variant="secondary"
          >
            Etapas
          </Button>
        </div>

        {error && (
          <p
            className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            className="mb-3 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800"
            role="status"
          >
            {notice}
          </p>
        )}

        {showNewLead && (
          <Card className="mb-4 max-w-2xl p-5">
            <h2 className="font-semibold">Novo lead</h2>
            <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={submitNewLead}>
              <Field label="Nome">
                <Input
                  onChange={(e) =>
                    setNewLead((v) => ({ ...v, name: e.target.value }))
                  }
                  required
                  value={newLead.name}
                />
              </Field>
              <Field label="Telefone (WhatsApp)">
                <Input
                  onChange={(e) =>
                    setNewLead((v) => ({ ...v, phone: e.target.value }))
                  }
                  value={newLead.phone}
                />
              </Field>
              <Field label="E-mail">
                <Input
                  onChange={(e) =>
                    setNewLead((v) => ({ ...v, email: e.target.value }))
                  }
                  type="email"
                  value={newLead.email}
                />
              </Field>
              <Field label="Origem">
                <Select
                  onChange={(e) =>
                    setNewLead((v) => ({ ...v, source: e.target.value }))
                  }
                  value={newLead.source}
                >
                  {Object.entries(sourceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field
                  hint="Ex.: Lençóis Maranhenses · setembro · 2 pax"
                  label="Interesse"
                >
                  <Input
                    onChange={(e) =>
                      setNewLead((v) => ({ ...v, interest: e.target.value }))
                    }
                    value={newLead.interest}
                  />
                </Field>
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button loading={isSavingLead} type="submit">
                  Criar lead
                </Button>
                <Button
                  onClick={() => setShowNewLead(false)}
                  type="button"
                  variant="secondary"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        )}

        {showStages && (
          <Card className="mb-4 max-w-2xl p-5">
            <h2 className="font-semibold">Etapas do pipeline</h2>
            <p className="mt-1 text-xs text-gray-500">
              Renomeie, adicione ou remova etapas (só é possível remover etapa
              sem leads).
            </p>
            <div className="mt-3 space-y-2">
              {stageDrafts.map((stage, index) => {
                const count = (byStage.get(stage.id) ?? []).length;
                return (
                  <div className="flex items-center gap-2" key={stage.id}>
                    <Input
                      aria-label={`Nome da etapa ${index + 1}`}
                      className="mt-0"
                      onChange={(e) =>
                        setStageDrafts((current) =>
                          current.map((s, i) =>
                            i === index ? { ...s, label: e.target.value } : s
                          )
                        )
                      }
                      value={stage.label}
                    />
                    <span className="w-16 shrink-0 text-xs text-gray-500">
                      {count} {count === 1 ? "lead" : "leads"}
                    </span>
                    <Button
                      disabled={count > 0 || stageDrafts.length <= 1}
                      onClick={() =>
                        setStageDrafts((current) =>
                          current.filter((_, i) => i !== index)
                        )
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Remover
                    </Button>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() =>
                  setStageDrafts((current) => [
                    ...current,
                    { id: newStageId(), label: "" },
                  ])
                }
                size="sm"
                type="button"
                variant="secondary"
              >
                + Etapa
              </Button>
              <Button
                loading={isSavingStages}
                onClick={submitStages}
                size="sm"
                type="button"
              >
                Salvar etapas
              </Button>
            </div>
          </Card>
        )}

        {loadStatus === "loading" && (
          <p className="text-gray-500">Carregando CRM…</p>
        )}

        {loadStatus === "ready" && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map((stage, stageIndex) => {
              const stageLeads = byStage.get(stage.id) ?? [];
              return (
                <div
                  className="w-72 shrink-0"
                  key={stage.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const lead = leads.find((l) => l.id === dragId);
                    if (lead) void moveLead(lead, stage.id);
                    setDragId(null);
                  }}
                >
                  <div className="flex items-center justify-between rounded-t-lg border border-b-0 bg-gray-50 px-3 py-2">
                    <p className="text-sm font-semibold">{stage.label}</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-500">
                      {stageLeads.length}
                    </span>
                  </div>
                  <div className="min-h-[300px] space-y-2 rounded-b-lg border bg-gray-100/60 p-2">
                    {stageLeads.map((lead) => {
                      const wa = toWhatsAppLink(lead.phone);
                      const campaign = lead.utm?.utm_campaign;
                      return (
                        <div
                          className={`cursor-grab rounded-lg border bg-white p-3 shadow-sm transition hover:shadow ${
                            dragId === lead.id ? "opacity-50" : ""
                          }`}
                          draggable
                          key={lead.id}
                          onDragEnd={() => setDragId(null)}
                          onDragStart={() => setDragId(lead.id)}
                        >
                          <button
                            className="block w-full text-left"
                            onClick={() => setSelectedId(lead.id)}
                            type="button"
                          >
                            <p className="truncate text-sm font-semibold">
                              {lead.name}
                            </p>
                            {lead.interest && (
                              <p className="mt-0.5 truncate text-xs text-gray-600">
                                {lead.interest}
                              </p>
                            )}
                            <p className="mt-1 text-[11px] text-gray-400">
                              {sourceLabels[lead.source] ?? lead.source}
                              {campaign ? ` · ${campaign}` : ""} ·{" "}
                              {formatDateTimeBR(lead.created_at)}
                            </p>
                          </button>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex gap-1">
                              <button
                                aria-label="Mover para a etapa anterior"
                                className="rounded border px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                                disabled={stageIndex === 0}
                                onClick={() =>
                                  void moveLead(
                                    lead,
                                    stages[stageIndex - 1]!.id
                                  )
                                }
                                type="button"
                              >
                                ←
                              </button>
                              <button
                                aria-label="Mover para a próxima etapa"
                                className="rounded border px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                                disabled={stageIndex === stages.length - 1}
                                onClick={() =>
                                  void moveLead(
                                    lead,
                                    stages[stageIndex + 1]!.id
                                  )
                                }
                                type="button"
                              >
                                →
                              </button>
                            </div>
                            {wa && (
                              <a
                                className="text-xs font-semibold text-green-700 hover:text-green-800"
                                href={wa}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                WhatsApp
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {stageLeads.length === 0 && (
                      <p className="p-3 text-center text-xs text-gray-400">
                        Arraste leads para cá
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Painel de detalhe */}
        {selectedLead && (
          <div
            className="fixed inset-0 z-[90] flex justify-end bg-black/30"
            onClick={() => setSelectedId(null)}
          >
            <div
              className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{selectedLead.name}</h2>
                <Button
                  onClick={() => setSelectedId(null)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Fechar
                </Button>
              </div>

              {Object.keys(selectedLead.utm ?? {}).length > 0 && (
                <p className="mt-2 rounded bg-gray-50 p-2 font-mono text-[11px] text-gray-500">
                  {Object.entries(selectedLead.utm)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(" · ")}
                </p>
              )}

              <form className="mt-4 space-y-3" onSubmit={saveDetail}>
                <Field label="Nome">
                  <Input
                    onChange={(e) =>
                      setDetailValues((v) => ({ ...v, name: e.target.value }))
                    }
                    required
                    value={detailValues.name}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Telefone">
                    <Input
                      onChange={(e) =>
                        setDetailValues((v) => ({
                          ...v,
                          phone: e.target.value,
                        }))
                      }
                      value={detailValues.phone}
                    />
                  </Field>
                  <Field label="E-mail">
                    <Input
                      onChange={(e) =>
                        setDetailValues((v) => ({
                          ...v,
                          email: e.target.value,
                        }))
                      }
                      value={detailValues.email}
                    />
                  </Field>
                  <Field label="Origem">
                    <Select
                      onChange={(e) =>
                        setDetailValues((v) => ({
                          ...v,
                          source: e.target.value,
                        }))
                      }
                      value={detailValues.source}
                    >
                      {Object.entries(sourceLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Etapa">
                    <Select
                      onChange={(e) =>
                        setDetailValues((v) => ({
                          ...v,
                          stage_id: e.target.value,
                        }))
                      }
                      value={detailValues.stage_id}
                    >
                      {stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Interesse">
                  <Input
                    onChange={(e) =>
                      setDetailValues((v) => ({
                        ...v,
                        interest: e.target.value,
                      }))
                    }
                    value={detailValues.interest}
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-2">
                  <Button loading={isSavingDetail} size="sm" type="submit">
                    Salvar
                  </Button>
                  {toWhatsAppLink(detailValues.phone) && (
                    <a
                      className="rounded-lg border px-3 py-1.5 text-sm font-semibold text-green-700 hover:bg-green-50"
                      href={toWhatsAppLink(detailValues.phone)!}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Abrir WhatsApp
                    </a>
                  )}
                  <ConfirmButton
                    className="text-sm font-semibold text-red-600 hover:text-red-700"
                    confirmLabel="Excluir lead"
                    message={`Excluir o lead "${selectedLead.name}"? As anotações também serão apagadas.`}
                    onConfirm={() => deleteLead(selectedLead.id)}
                    onDone={() => {
                      setSelectedId(null);
                      return load();
                    }}
                  >
                    Excluir
                  </ConfirmButton>
                </div>
              </form>

              <div className="mt-6 border-t pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Histórico de contato
                </h3>
                <div className="mt-2 flex gap-2">
                  <Textarea
                    aria-label="Nova anotação"
                    className="mt-0 min-h-[60px]"
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Ex.: liguei, pediu proposta por e-mail…"
                    value={newNote}
                  />
                </div>
                <Button
                  className="mt-2"
                  disabled={!newNote.trim()}
                  onClick={submitNote}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Anotar
                </Button>
                <div className="mt-3 space-y-2">
                  {activities.map((activity) => (
                    <div
                      className="rounded-lg bg-gray-50 p-3 text-sm"
                      key={activity.id}
                    >
                      <p className="whitespace-pre-wrap text-gray-800">
                        {activity.note}
                      </p>
                      <p className="mt-1 text-[11px] text-gray-400">
                        {formatDateTimeBR(activity.created_at)}
                      </p>
                    </div>
                  ))}
                  {activities.length === 0 && (
                    <p className="text-sm text-gray-400">
                      Nenhuma anotação ainda.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminCrm;
