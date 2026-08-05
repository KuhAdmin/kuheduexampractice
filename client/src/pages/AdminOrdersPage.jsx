import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getAdminOrders, getAdminOrdersSummary, fetchAdminOrdersExportBlob } from "../api/client";
import { AdminOrdersDateRangeFilter } from "../components/AdminOrdersDateRangeFilter";
import { thisMonthRange } from "../lib/dateRangePresets";
import { pricingCards, trial } from "../content/pricingContent";

const PAGE_SIZE = 20;

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
  { value: "pending", label: "Pending" },
];

const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: "", label: "All subscription states" },
  { value: "created", label: "Created" },
  { value: "authenticated", label: "Authenticated" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended (Trial expired)" },
  { value: "none", label: "N/A (Yearly)" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "All payment modes" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "netbanking", label: "Netbanking" },
  { value: "wallet", label: "Wallet" },
  { value: "emi", label: "EMI" },
  { value: "paylater", label: "Pay Later" },
  { value: "unknown", label: "Unknown" },
];

const PLAN_OPTIONS = [
  { value: "", label: "All plans" },
  ...pricingCards.flatMap((card) => [
    { value: `${card.id}-monthly`, label: `${card.name} (Monthly)` },
    { value: `${card.id}-yearly`, label: `${card.name} (Yearly)` },
  ]),
  { value: trial.id, label: trial.label },
];

const PLAN_LABEL_BY_ID = Object.fromEntries(PLAN_OPTIONS.map((option) => [option.value, option.label]));

const STATUS_BADGE_CLASS = {
  success: "is-completed",
  failed: "is-failed",
  pending: "is-queued",
};

// Collapses the subscription lifecycle's raw statuses (created/authenticated
// pre-mandate, active while charging, completed/cancelled/paused once it
// stops) into the three states that actually matter at a glance: still
// working toward its first charge, currently active, or over. Yearly has no
// subscription/expiry at all -- subscriptionStatus is null there, rendered
// as "--" by the caller, not through this map. Trial (one-time, but with a
// real expiry window) contributes its own active/ended values directly from
// ordersService.js's SQL, reusing this same vocabulary.
const SUBSCRIPTION_STATUS_LABEL = {
  created: "Pending",
  authenticated: "Pending",
  active: "Active",
  completed: "Ended",
  cancelled: "Ended",
  paused: "Ended",
  ended: "Ended",
};

const SUBSCRIPTION_STATUS_BADGE_CLASS = {
  created: "is-queued",
  authenticated: "is-queued",
  active: "is-completed",
  completed: "is-aborted",
  cancelled: "is-aborted",
  paused: "is-aborted",
  ended: "is-aborted",
};

const capitalize = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : "");

const subscriptionStatusLabel = (status) => SUBSCRIPTION_STATUS_LABEL[status] || capitalize(status);

const planLabel = (planId) => PLAN_LABEL_BY_ID[planId] || capitalize(planId);

const formatRupees = (paise) =>
  paise === null || paise === undefined
    ? "—"
    : `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

const formatChartDate = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

const sortIndicator = (active, dir) => (active ? (dir === "asc" ? " ▲" : " ▼") : "");

export const AdminOrdersPage = () => {
  const [filters, setFilters] = useState(() => ({
    search: "",
    plan: "",
    paymentStatus: "",
    subscriptionStatus: "",
    paymentMethod: "",
    ...thisMonthRange(),
  }));
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("transaction_at");
  const [sortDir, setSortDir] = useState("desc");

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // Debounces free-text search so every keystroke doesn't fire a request;
  // lands as a normal filter change (resets to page 1) once the user pauses.
  useEffect(() => {
    const handle = setTimeout(() => {
      setFilters((current) => {
        if (current.search === searchInput) return current;
        return { ...current, search: searchInput };
      });
      setPage(1);
    }, 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const queryParams = useMemo(
    () => ({ ...filters, page, pageSize: PAGE_SIZE, sortBy, sortDir }),
    [filters, page, sortBy, sortDir]
  );

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminOrders(queryParams);
      setOrders(result?.orders || []);
      setTotal(result?.total || 0);
      setTotalPages(result?.totalPages || 1);
    } catch (loadError) {
      setError(loadError.message || "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const result = await getAdminOrdersSummary(filters);
      setSummary(result);
    } catch (loadError) {
      setSummaryError(loadError.message || "Failed to load summary.");
    } finally {
      setSummaryLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleDateRangeChange = useCallback(({ dateFrom, dateTo }) => {
    setFilters((current) => ({ ...current, dateFrom, dateTo }));
    setPage(1);
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      const blob = await fetchAdminOrdersExportBlob(filters);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (caughtError) {
      setExportError(caughtError.message || "Failed to export orders.");
    } finally {
      setExporting(false);
    }
  };

  const chartData = useMemo(
    () =>
      (summary?.revenueByDay || []).map((day) => ({
        date: formatChartDate(day.date),
        revenue: Math.round(day.revenuePaise / 100),
        success: day.successCount,
        failed: day.failedCount,
      })),
    [summary]
  );

  return (
    <section className="admin-bulk-pipeline-page admin-orders-page">
      <div className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Orders</h1>
          <p>Every Premium transaction — one-time purchases and recurring Monthly charges — in one place.</p>
        </div>
        <div className="admin-bulk-pipeline-header-actions">
          <button type="button" className="ghost-button" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      {exportError && <p className="error-text">{exportError}</p>}

      <section className="admin-stat-grid">
        <article className="admin-stat-card">
          <strong>{summaryLoading ? "…" : formatRupees(summary?.totalRevenuePaise)}</strong>
          <span>Total revenue</span>
        </article>
        <article className="admin-stat-card">
          <strong>{summaryLoading ? "…" : summary?.totalTransactions ?? 0}</strong>
          <span>Transactions</span>
        </article>
        <article className="admin-stat-card">
          <strong>{summaryLoading ? "…" : `${summary?.successRatePercent ?? 0}%`}</strong>
          <span>Success rate</span>
        </article>
        <article className="admin-stat-card">
          <strong>{summaryLoading ? "…" : summary?.failedCount ?? 0}</strong>
          <span>Failed</span>
        </article>
        <article className="admin-stat-card">
          <strong>{summaryLoading ? "…" : summary?.pendingCount ?? 0}</strong>
          <span>Pending</span>
        </article>
      </section>

      {summaryError && <p className="error-text">{summaryError}</p>}

      <section className="admin-orders-charts-grid">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Revenue</h2>
            <span>By day, current filters</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,41,51,0.08)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]} />
              <Bar dataKey="revenue" fill="#146c94" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Success vs. failed</h2>
            <span>By day, current filters</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,41,51,0.08)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="success" name="Success" stackId="status" fill="#1f9d55" />
              <Bar dataKey="failed" name="Failed" stackId="status" fill="#d64545" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="admin-orders-filters-bar">
        <input
          type="text"
          className="admin-orders-search-input"
          placeholder="Search by email…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <select value={filters.plan} onChange={(event) => handleFilterChange("plan", event.target.value)}>
          {PLAN_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={filters.paymentMethod}
          onChange={(event) => handleFilterChange("paymentMethod", event.target.value)}
        >
          {PAYMENT_METHOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <AdminOrdersDateRangeFilter onChange={handleDateRangeChange} />
      </div>

      <div className="admin-bulk-pipeline-grid-shell">
        {loading ? (
          <div className="admin-bulk-pipeline-empty">Loading orders...</div>
        ) : error ? (
          <p className="error-text">{error}</p>
        ) : orders.length === 0 ? (
          <div className="admin-bulk-pipeline-empty">No transactions match these filters.</div>
        ) : (
          <table className="admin-bulk-pipeline-grid">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Email</th>
                <th>Mobile Phone</th>
                <th>Plan</th>
                <th>Payment Mode</th>
                <th className="admin-orders-sortable" onClick={() => handleSort("amount")}>
                  Amount{sortIndicator(sortBy === "amount", sortDir)}
                </th>
                <th className="admin-orders-sortable" onClick={() => handleSort("transaction_at")}>
                  Transaction Date &amp; Time{sortIndicator(sortBy === "transaction_at", sortDir)}
                </th>
                <th>
                  <div className="admin-orders-column-filter">
                    <span>Status</span>
                    <select
                      value={filters.paymentStatus}
                      onChange={(event) => handleFilterChange("paymentStatus", event.target.value)}
                    >
                      {PAYMENT_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th>
                  <div className="admin-orders-column-filter">
                    <span>Subscription Status</span>
                    <select
                      value={filters.subscriptionStatus}
                      onChange={(event) => handleFilterChange("subscriptionStatus", event.target.value)}
                    >
                      {SUBSCRIPTION_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th>Access Ends</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={`${order.sourceType}-${order.sourceId}`}>
                  <td>{order.referenceId}</td>
                  <td>{order.email}</td>
                  <td>{order.phone || "—"}</td>
                  <td>{planLabel(order.plan)}</td>
                  <td>{order.paymentMethod ? capitalize(order.paymentMethod) : "—"}</td>
                  <td>{formatRupees(order.amount)}</td>
                  <td className="admin-pipeline-runs-datetime">{formatDateTime(order.transactionAt)}</td>
                  <td>
                    <span className={`admin-bulk-pipeline-status-badge ${STATUS_BADGE_CLASS[order.status] || ""}`}>
                      {capitalize(order.status)}
                    </span>
                  </td>
                  <td>
                    {order.subscriptionStatus ? (
                      <span
                        className={`admin-bulk-pipeline-status-badge ${
                          SUBSCRIPTION_STATUS_BADGE_CLASS[order.subscriptionStatus] || ""
                        }`}
                      >
                        {subscriptionStatusLabel(order.subscriptionStatus)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="admin-pipeline-runs-datetime">
                    {order.accessEndsAt ? formatDateTime(order.accessEndsAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !error && orders.length > 0 ? (
        <div className="admin-orders-pagination">
          <button
            type="button"
            className="admin-orders-pagination-button"
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
            disabled={page <= 1}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages} · {total} total
          </span>
          <button
            type="button"
            className="admin-orders-pagination-button"
            onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
};
