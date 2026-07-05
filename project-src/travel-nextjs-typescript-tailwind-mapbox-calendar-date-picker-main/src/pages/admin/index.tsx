import {
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  CreditCardIcon,
  Squares2X2Icon,
  TagIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminStatCard from "../../components/admin/AdminStatCard";
import {
  listAdminCategories,
  getAdminBookings,
  getAdminPayments,
  listAdminProductDates,
  listAdminProducts,
} from "../../lib/admin/client";

type DashboardStats = {
  products: number;
  activeProducts: number;
  productDates: number;
  categories: number;
  bookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  reviewBookings: number;
  paidPayments: number;
  attentionPayments: number;
  paidRevenue: number;
};

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    products: 0,
    activeProducts: 0,
    productDates: 0,
    categories: 0,
    bookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    reviewBookings: 0,
    paidPayments: 0,
    attentionPayments: 0,
    paidRevenue: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useEffect(() => {
    const loadStats = async () => {
      setLoadStatus("loading");
      try {
        const [products, productDates, categories, bookings, payments] =
          await Promise.all([
          listAdminProducts(),
          listAdminProductDates(),
          listAdminCategories(),
          getAdminBookings(),
          getAdminPayments(),
        ]);

        const paidPayments = payments.filter(
          (payment) => payment.status === "paid"
        );

        setStats({
          products: products.length,
          activeProducts: products.filter((product) => product.active).length,
          productDates: productDates.length,
          categories: categories.length,
          bookings: bookings.length,
          pendingBookings: bookings.filter(
            (booking) => booking.status === "pending"
          ).length,
          confirmedBookings: bookings.filter(
            (booking) => booking.status === "confirmed"
          ).length,
          reviewBookings: bookings.filter(
            (booking) => booking.payment_status === "requires_review"
          ).length,
          paidPayments: paidPayments.length,
          attentionPayments: payments.filter(
            (payment) =>
              payment.status === "failed" ||
              payment.status === "requires_review"
          ).length,
          paidRevenue: paidPayments.reduce(
            (total, payment) => total + Number(payment.amount),
            0
          ),
        });
        setLoadStatus("ready");
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar as métricas."
        );
        setLoadStatus("error");
      }
    };

    loadStats();
  }, []);

  return (
    <AdminGuard>
      <AdminLayout
        title="Dashboard"
        description="Visao operacional da vitrine interna de turismo."
      >
        {error && (
          <p className="mb-5 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {loadStatus === "loading" && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                className="h-28 animate-pulse rounded-lg border bg-white"
                key={index}
              />
            ))}
          </section>
        )}
        {loadStatus === "ready" && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            helper="Produtos cadastrados"
            icon={Squares2X2Icon}
            label="Produtos"
            value={stats.products}
          />
          <AdminStatCard
            helper="Disponiveis na vitrine"
            icon={Squares2X2Icon}
            label="Ativos"
            value={stats.activeProducts}
          />
          <AdminStatCard
            helper="Janelas de disponibilidade"
            icon={CalendarDaysIcon}
            label="Datas"
            value={stats.productDates}
          />
          <AdminStatCard
            helper="Filtros editoriais"
            icon={TagIcon}
            label="Categorias"
            value={stats.categories}
          />
          <AdminStatCard
            helper="Reservas internas"
            icon={ClipboardDocumentListIcon}
            label="Reservas"
            value={stats.bookings}
          />
          <AdminStatCard
            helper="Aguardando pagamento"
            icon={ClipboardDocumentListIcon}
            label="Pending"
            value={stats.pendingBookings}
          />
          <AdminStatCard
            helper="Confirmadas por webhook"
            icon={ClipboardDocumentListIcon}
            label="Confirmadas"
            value={stats.confirmedBookings}
          />
          <AdminStatCard
            helper="Exigem analise"
            icon={CreditCardIcon}
            label="Revisao"
            value={stats.reviewBookings}
          />
          <AdminStatCard
            helper="Pagamentos confirmados"
            icon={CreditCardIcon}
            label="Pagos"
            value={stats.paidPayments}
          />
          <AdminStatCard
            helper="Falha ou revisao"
            icon={CreditCardIcon}
            label="Atencao"
            value={stats.attentionPayments}
          />
          <AdminStatCard
            helper="Total pago confirmado"
            icon={CreditCardIcon}
            label="Receita paga"
            value={new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(stats.paidRevenue)}
          />
        </section>
        )}

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Link
            className="rounded-lg border bg-white p-5 shadow-sm hover:shadow-md"
            href="/admin/products/new"
          >
            <h2 className="font-semibold">Novo produto</h2>
            <p className="mt-2 text-sm text-gray-500">
              Cadastre pacotes, hoteis, experiencias ou hospedagens.
            </p>
          </Link>
          <Link
            className="rounded-lg border bg-white p-5 shadow-sm hover:shadow-md"
            href="/admin/product-dates/new"
          >
            <h2 className="font-semibold">Nova data</h2>
            <p className="mt-2 text-sm text-gray-500">
              Gerencie disponibilidade e preco por periodo.
            </p>
          </Link>
          <Link
            className="rounded-lg border bg-white p-5 shadow-sm hover:shadow-md"
            href="/admin/categories"
          >
            <h2 className="font-semibold">Categorias</h2>
            <p className="mt-2 text-sm text-gray-500">
              Organize a vitrine por temas de viagem.
            </p>
          </Link>
          <Link
            className="rounded-lg border bg-white p-5 shadow-sm hover:shadow-md"
            href="/admin/bookings"
          >
            <h2 className="font-semibold">Reservas</h2>
            <p className="mt-2 text-sm text-gray-500">
              Consulte status, pagamentos, passageiros e logs internos.
            </p>
          </Link>
          <Link
            className="rounded-lg border bg-white p-5 shadow-sm hover:shadow-md"
            href="/admin/payments"
          >
            <h2 className="font-semibold">Pagamentos</h2>
            <p className="mt-2 text-sm text-gray-500">
              Acompanhe Stripe, revisoes manuais e falhas de pagamento.
            </p>
          </Link>
        </section>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminDashboard;
