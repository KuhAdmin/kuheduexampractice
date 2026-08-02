import { getOrdersSummary, listOrders, streamOrdersCsv } from "../services/ordersService.js";

const parseOrdersFilters = (query) => {
  const { search, plan, paymentStatus, subscriptionStatus, paymentMethod, dateFrom, dateTo } = query;
  return {
    search: search || undefined,
    plan: plan || undefined,
    paymentStatus: paymentStatus || undefined,
    subscriptionStatus: subscriptionStatus || undefined,
    paymentMethod: paymentMethod || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };
};

export const getOrders = async (req, res, next) => {
  try {
    const { page, pageSize, sortBy, sortDir } = req.query;
    const filters = parseOrdersFilters(req.query);

    const { orders, total } = await listOrders(filters, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      sortBy,
      sortDir,
    });

    const resolvedPageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
    const resolvedPage = Math.max(Number(page) || 1, 1);

    return res.json({
      orders,
      total,
      page: resolvedPage,
      pageSize: resolvedPageSize,
      totalPages: Math.max(Math.ceil(total / resolvedPageSize), 1),
    });
  } catch (error) {
    return next(error);
  }
};

export const getOrdersSummaryHandler = async (req, res, next) => {
  try {
    const summary = await getOrdersSummary(parseOrdersFilters(req.query));
    return res.json(summary);
  } catch (error) {
    return next(error);
  }
};

export const exportOrders = async (req, res, next) => {
  try {
    await streamOrdersCsv(parseOrdersFilters(req.query), res);
  } catch (error) {
    return next(error);
  }
};
