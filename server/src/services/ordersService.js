import { pool } from "../db/pool.js";

// Unifies two structurally different sources into one "Orders" row shape for
// the admin dashboard: one-time Yearly/Trial purchases (payment_order) and
// recurring Monthly charges (subscription_invoice, joined to its parent
// subscription for status/plan). A third branch surfaces Monthly signups
// that have authenticated a mandate but not been charged yet -- otherwise
// they'd be entirely invisible on this dashboard even though the user has an
// active subscription. Every consumer below (list/summary/export) reuses
// this exact CTE so their numbers can never drift apart from each other.
const ORDERS_CTE = `
  WITH orders AS (
    SELECT
      'order'                                                 AS source_type,
      po.id                                                   AS source_id,
      po.user_id,
      u.email,
      po.plan                                                 AS plan,
      -- Yearly grants permanent access (no expiry to report), so this stays
      -- NULL there like before. Trial is the one one-time plan with a real
      -- expiry window (users.premium_expires_at, set by
      -- paymentService.js's markOrderPaidAndActivatePremium) -- surfaced
      -- here as active/ended so it doesn't just look permanently blank.
      -- Reads the user's CURRENT expiry, not a per-order snapshot, so a
      -- user who has purchased Trial more than once shows their latest
      -- state on every one of those rows.
      CASE
        WHEN po.plan = 'trial' AND po.status = 'paid' THEN
          CASE WHEN u.premium_expires_at > NOW() THEN 'active' ELSE 'ended' END
        ELSE NULL
      END                                                      AS subscription_status,
      -- Real stored timestamp (users.premium_expires_at, set once at
      -- purchase time in paymentService.js), not derived -- only meaningful
      -- for a paid Trial order, same condition as subscription_status above.
      CASE WHEN po.plan = 'trial' AND po.status = 'paid' THEN u.premium_expires_at ELSE NULL END
                                                                 AS access_ends_at,
      po.payment_method,
      po.amount,
      CASE po.status
        WHEN 'paid' THEN 'success'
        WHEN 'failed' THEN 'failed'
        ELSE 'pending'
      END                                                      AS normalized_status,
      COALESCE(po.razorpay_payment_id, po.razorpay_order_id)  AS reference_id,
      po.created_at                                           AS transaction_at
    FROM payment_order po
    JOIN users u ON u.id = po.user_id

    UNION ALL

    SELECT
      'invoice',
      si.id,
      s.user_id,
      u.email,
      COALESCE(s.card_id || '-monthly', 'monthly'),
      s.status,
      -- Monthly's real analog of Trial's premium_expires_at above: the
      -- current billing cycle's end, already a stored column on
      -- subscription (kept in sync by subscriptionService.js's
      -- recordSubscriptionCharge on each subscription.charged webhook).
      s.current_end,
      si.payment_method,
      si.amount,
      CASE si.status
        WHEN 'paid' THEN 'success'
        WHEN 'partially_paid' THEN 'pending'
        ELSE 'failed'
      END,
      si.razorpay_invoice_id,
      COALESCE(si.paid_at, si.created_at)
    FROM subscription_invoice si
    JOIN subscription s ON s.id = si.subscription_id
    JOIN users u ON u.id = s.user_id

    UNION ALL

    SELECT
      'subscription',
      s.id,
      s.user_id,
      u.email,
      COALESCE(s.card_id || '-monthly', 'monthly'),
      s.status,
      s.current_end,
      NULL,
      NULL,
      'pending',
      s.razorpay_subscription_id,
      s.created_at
    FROM subscription s
    JOIN users u ON u.id = s.user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM subscription_invoice si WHERE si.subscription_id = s.id
    )
  )
`;

const SORTABLE_COLUMNS = new Set(["transaction_at", "amount", "email"]);

// "none"/"unknown" are the UI's explicit buckets for "one-time purchase, no
// subscription" and "webhook hasn't reported a payment method yet" -- both
// need IS NULL, not a $-param equality check.
const buildOrdersFilterClause = (filters = {}) => {
  const { search, plan, paymentStatus, subscriptionStatus, paymentMethod, dateFrom, dateTo } = filters;
  const conditions = [];
  const values = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`email ILIKE $${values.length}`);
  }

  if (plan) {
    values.push(plan);
    conditions.push(`plan = $${values.length}`);
  }

  if (paymentStatus) {
    values.push(paymentStatus);
    conditions.push(`normalized_status = $${values.length}`);
  }

  if (subscriptionStatus) {
    if (subscriptionStatus === "none") {
      conditions.push(`subscription_status IS NULL`);
    } else {
      values.push(subscriptionStatus);
      conditions.push(`subscription_status = $${values.length}`);
    }
  }

  if (paymentMethod) {
    if (paymentMethod === "unknown") {
      conditions.push(`payment_method IS NULL`);
    } else {
      values.push(paymentMethod);
      conditions.push(`payment_method = $${values.length}`);
    }
  }

  if (dateFrom) {
    values.push(dateFrom);
    conditions.push(`transaction_at >= $${values.length}`);
  }

  if (dateTo) {
    values.push(dateTo);
    conditions.push(`transaction_at <= $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { whereClause, values };
};

// phone is always null -- no capture flow exists for it (see init.sql); the
// column is kept in the shape so the table/CSV can render a placeholder
// without a shape mismatch once a capture flow does exist.
const mapOrderRow = (row) => ({
  sourceType: row.source_type,
  sourceId: row.source_id,
  userId: row.user_id,
  email: row.email,
  phone: null,
  plan: row.plan,
  subscriptionStatus: row.subscription_status,
  accessEndsAt: row.access_ends_at,
  paymentMethod: row.payment_method,
  amount: row.amount !== null && row.amount !== undefined ? Number(row.amount) : null,
  status: row.normalized_status,
  referenceId: row.reference_id,
  transactionAt: row.transaction_at,
});

export const listOrders = async (
  filters = {},
  { page = 1, pageSize = 20, sortBy = "transaction_at", sortDir = "desc" } = {}
) => {
  const { whereClause, values } = buildOrdersFilterClause(filters);

  const sortColumn = SORTABLE_COLUMNS.has(sortBy) ? sortBy : "transaction_at";
  const direction = sortDir === "asc" ? "ASC" : "DESC";
  const clampedPageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
  const clampedPage = Math.max(Number(page) || 1, 1);
  const offset = (clampedPage - 1) * clampedPageSize;

  const listValues = [...values, clampedPageSize, offset];
  const limitParamIndex = values.length + 1;
  const offsetParamIndex = values.length + 2;

  const result = await pool.query(
    `
      ${ORDERS_CTE}
      SELECT *, COUNT(*) OVER() AS total_count
      FROM orders
      ${whereClause}
      ORDER BY ${sortColumn} ${direction} NULLS LAST
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `,
    listValues
  );

  const total = result.rows[0]?.total_count ? Number(result.rows[0].total_count) : 0;
  return { orders: result.rows.map(mapOrderRow), total };
};

export const getOrdersSummary = async (filters = {}) => {
  const { whereClause, values } = buildOrdersFilterClause(filters);

  const [totalsResult, byDayResult] = await Promise.all([
    pool.query(
      `
        ${ORDERS_CTE}
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE normalized_status = 'success'), 0) AS total_revenue_paise,
          COUNT(*)                                                              AS total_transactions,
          COUNT(*) FILTER (WHERE normalized_status = 'success')                 AS success_count,
          COUNT(*) FILTER (WHERE normalized_status = 'failed')                  AS failed_count,
          COUNT(*) FILTER (WHERE normalized_status = 'pending')                 AS pending_count
        FROM orders
        ${whereClause}
      `,
      values
    ),
    pool.query(
      `
        ${ORDERS_CTE}
        SELECT
          date_trunc('day', transaction_at AT TIME ZONE 'Asia/Kolkata')          AS bucket_date,
          COALESCE(SUM(amount) FILTER (WHERE normalized_status = 'success'), 0) AS revenue_paise,
          COUNT(*) FILTER (WHERE normalized_status = 'success')                 AS success_count,
          COUNT(*) FILTER (WHERE normalized_status = 'failed')                  AS failed_count,
          COUNT(*) FILTER (WHERE normalized_status = 'pending')                 AS pending_count
        FROM orders
        ${whereClause}
        GROUP BY 1
        ORDER BY 1
      `,
      values
    ),
  ]);

  const totals = totalsResult.rows[0] || {};
  const totalTransactions = Number(totals.total_transactions || 0);
  const successCount = Number(totals.success_count || 0);

  return {
    totalRevenuePaise: Number(totals.total_revenue_paise || 0),
    totalTransactions,
    successCount,
    failedCount: Number(totals.failed_count || 0),
    pendingCount: Number(totals.pending_count || 0),
    successRatePercent: totalTransactions > 0 ? Math.round((successCount / totalTransactions) * 1000) / 10 : 0,
    revenueByDay: byDayResult.rows.map((row) => ({
      date: row.bucket_date,
      revenuePaise: Number(row.revenue_paise || 0),
      successCount: Number(row.success_count || 0),
      failedCount: Number(row.failed_count || 0),
      pendingCount: Number(row.pending_count || 0),
    })),
  };
};

const CSV_HEADERS = [
  "Reference ID",
  "Email",
  "Mobile Phone",
  "Plan",
  "Payment Mode",
  "Amount (INR)",
  "Transaction Date & Time",
  "Payment Status",
  "Subscription Status",
  "Access Ends At",
];

// RFC 4180 escaping -- no CSV library exists in this codebase and the rule
// set is small enough not to need one.
const escapeCsvField = (value) => {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const toCsvRow = (fields) => fields.map(escapeCsvField).join(",") + "\r\n";

const orderToCsvFields = (order) => [
  order.referenceId,
  order.email,
  order.phone ?? "—",
  order.plan,
  order.paymentMethod ?? "",
  order.amount !== null ? (order.amount / 100).toFixed(2) : "",
  order.transactionAt ? new Date(order.transactionAt).toISOString() : "",
  order.status,
  order.subscriptionStatus ?? "",
  order.accessEndsAt ? new Date(order.accessEndsAt).toISOString() : "",
];

// Defensive cap, not a real pagination boundary -- a genuinely larger export
// need would call for a background job/async download instead of a
// synchronous request/response cycle.
const EXPORT_ROW_LIMIT = 50000;

export const streamOrdersCsv = async (filters = {}, res) => {
  const { whereClause, values } = buildOrdersFilterClause(filters);

  const result = await pool.query(
    `
      ${ORDERS_CTE}
      SELECT *
      FROM orders
      ${whereClause}
      ORDER BY transaction_at DESC
      LIMIT ${EXPORT_ROW_LIMIT}
    `,
    values
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="orders-export-${new Date().toISOString().slice(0, 10)}.csv"`
  );

  res.write(toCsvRow(CSV_HEADERS));

  const BATCH_SIZE = 500;
  for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
    const chunk = result.rows
      .slice(i, i + BATCH_SIZE)
      .map(mapOrderRow)
      .map((order) => toCsvRow(orderToCsvFields(order)))
      .join("");
    res.write(chunk);
  }

  res.end();
};
