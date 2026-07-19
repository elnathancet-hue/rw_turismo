import { FormEvent, useEffect, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminListState from "../../components/admin/AdminListState";
import ConfirmButton from "../../components/admin/ConfirmButton";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { Field, Input, Select } from "../../components/ui/form";
import {
  createAdminCoupon,
  deleteAdminCoupon,
  listAdminCoupons,
  listAdminProducts,
  updateAdminCoupon,
  type Coupon,
  type CouponFormValues,
} from "../../lib/admin/client";
import type { Product } from "../../lib/products/types";

const emptyValues: CouponFormValues = {
  code: "",
  discount_type: "percent",
  discount_value: 10,
  product_id: null,
  max_uses: null,
  active: true,
  expires_at: null,
};

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value
  );

const describeDiscount = (coupon: Coupon) =>
  coupon.discount_type === "percent"
    ? `${coupon.discount_value}%`
    : money(coupon.discount_value);

const AdminCoupons = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [values, setValues] = useState<CouponFormValues>(emptyValues);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  const load = async () => {
    setLoadStatus("loading");
    setLoadError(null);
    try {
      const [couponsData, productsData] = await Promise.all([
        listAdminCoupons(),
        listAdminProducts(),
      ]);
      setCoupons(couponsData);
      setProducts(productsData);
      setLoadStatus("ready");
    } catch (caught) {
      setLoadError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar os cupons. A migration já rodou?"
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const set = <K extends keyof CouponFormValues>(
    key: K,
    value: CouponFormValues[K]
  ) => setValues((current) => ({ ...current, [key]: value }));

  const resetForm = () => {
    setValues(emptyValues);
    setEditingId(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);
    try {
      if (editingId) {
        await updateAdminCoupon(editingId, values);
      } else {
        await createAdminCoupon(values);
      }
      setMessage({ tone: "ok", text: "Cupom salvo." });
      resetForm();
      await load();
    } catch (caught) {
      setMessage({
        tone: "error",
        text:
          caught instanceof Error
            ? caught.message.includes("duplicate")
              ? "Já existe um cupom com esse código."
              : caught.message
            : "Não foi possível salvar o cupom.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (coupon: Coupon) => {
    setEditingId(coupon.id);
    setValues({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      product_id: coupon.product_id,
      max_uses: coupon.max_uses,
      active: coupon.active,
      expires_at: coupon.expires_at,
    });
  };

  const productTitle = (id: string | null) =>
    id ? products.find((p) => p.id === id)?.title ?? "—" : "Todos";

  return (
    <AdminGuard>
      <AdminLayout
        title="Cupons"
        description="Descontos aplicados na reserva (validados no servidor). O uso só conta quando o pagamento confirma."
      >
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card className="h-fit p-5">
            <h2 className="text-lg font-semibold">
              {editingId ? "Editar cupom" : "Novo cupom"}
            </h2>
            <form className="mt-4 space-y-4" onSubmit={submit}>
              <Field label="Código">
                <Input
                  className="uppercase placeholder:normal-case"
                  onChange={(event) => set("code", event.target.value)}
                  placeholder="Ex.: VERAO10"
                  required
                  value={values.code}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo">
                  <Select
                    onChange={(event) =>
                      set(
                        "discount_type",
                        event.target.value as CouponFormValues["discount_type"]
                      )
                    }
                    value={values.discount_type}
                  >
                    <option value="percent">Percentual (%)</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </Select>
                </Field>
                <Field
                  label={
                    values.discount_type === "percent"
                      ? "Desconto (%)"
                      : "Desconto (R$)"
                  }
                >
                  <Input
                    max={values.discount_type === "percent" ? 100 : undefined}
                    min={0}
                    onChange={(event) =>
                      set("discount_value", Number(event.target.value))
                    }
                    required
                    step="0.01"
                    type="number"
                    value={values.discount_value}
                  />
                </Field>
              </div>
              <Field
                hint="Deixe em 'Todos' para valer em qualquer produto."
                label="Produto"
              >
                <Select
                  onChange={(event) =>
                    set("product_id", event.target.value || null)
                  }
                  value={values.product_id ?? ""}
                >
                  <option value="">Todos os produtos</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field hint="Vazio = ilimitado." label="Usos máximos">
                  <Input
                    min={0}
                    onChange={(event) =>
                      set(
                        "max_uses",
                        event.target.value ? Number(event.target.value) : null
                      )
                    }
                    type="number"
                    value={values.max_uses ?? ""}
                  />
                </Field>
                <Field hint="Vazio = sem prazo." label="Validade">
                  <Input
                    onChange={(event) =>
                      set("expires_at", event.target.value || null)
                    }
                    type="date"
                    value={values.expires_at ?? ""}
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  checked={values.active}
                  onChange={(event) => set("active", event.target.checked)}
                  type="checkbox"
                />
                Cupom ativo
              </label>
              {message && (
                <p
                  className={`text-sm ${
                    message.tone === "ok" ? "text-green-700" : "text-red-600"
                  }`}
                  role="alert"
                >
                  {message.text}
                </p>
              )}
              <div className="flex gap-3">
                <Button loading={isSaving} type="submit">
                  {isSaving ? "Salvando…" : editingId ? "Salvar" : "Criar"}
                </Button>
                {editingId && (
                  <Button onClick={resetForm} type="button" variant="secondary">
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <AdminListState
            emptyHint="Crie o primeiro cupom no formulário ao lado."
            emptyTitle="Nenhum cupom ainda"
            error={loadError}
            isEmpty={coupons.length === 0}
            onRetry={load}
            status={loadStatus}
          >
            <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Desconto</th>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Usos</th>
                    <th className="px-4 py-3">Validade</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {coupons.map((coupon) => (
                    <tr className="hover:bg-gray-50" key={coupon.id}>
                      <td className="px-4 py-3 font-mono font-semibold">
                        {coupon.code}
                      </td>
                      <td className="px-4 py-3">{describeDiscount(coupon)}</td>
                      <td className="px-4 py-3">
                        {productTitle(coupon.product_id)}
                      </td>
                      <td className="px-4 py-3">
                        {coupon.used_count}
                        {coupon.max_uses !== null ? `/${coupon.max_uses}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        {coupon.expires_at
                          ? new Date(
                              `${coupon.expires_at}T00:00:00`
                            ).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {coupon.active ? "Ativo" : "Inativo"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="font-semibold text-orange-600 hover:text-orange-700"
                          onClick={() => startEditing(coupon)}
                          type="button"
                        >
                          Editar
                        </button>
                        <ConfirmButton
                          className="ml-4 font-semibold text-red-600 hover:text-red-700"
                          confirmLabel="Excluir cupom"
                          message={`Excluir o cupom "${coupon.code}"? Esta ação não pode ser desfeita.`}
                          onConfirm={() => deleteAdminCoupon(coupon.id)}
                          onDone={load}
                        >
                          Excluir
                        </ConfirmButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminListState>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminCoupons;
