import Link from "next/link";

type TabKey = "checkin" | "seats" | "rooms" | "transfers";

const tabs: { key: TabKey; label: string; suffix: string }[] = [
  { key: "checkin", label: "Check-in & Pax", suffix: "" },
  { key: "seats", label: "Assentos", suffix: "/seats" },
  { key: "rooms", label: "Quartos", suffix: "/rooms" },
  { key: "transfers", label: "Transfers", suffix: "/transfers" },
];

const DepartureTabs = ({ id, active }: { id: string; active: TabKey }) => (
  <nav
    aria-label="Seções da saída"
    className="mt-4 flex gap-2 overflow-x-auto print:hidden"
  >
    {tabs.map((tab) => (
      <Link
        className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold ${
          tab.key === active
            ? "bg-orange-500 text-white"
            : "border bg-white text-gray-600 hover:bg-gray-50"
        }`}
        href={`/admin/departures/${id}${tab.suffix}`}
        key={tab.key}
      >
        {tab.label}
      </Link>
    ))}
  </nav>
);

export default DepartureTabs;
