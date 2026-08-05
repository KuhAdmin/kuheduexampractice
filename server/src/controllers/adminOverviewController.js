import { getOverviewStats } from "../services/adminOverviewService.js";

export const getOverviewStatsHandler = async (_req, res, next) => {
  try {
    const stats = await getOverviewStats();
    return res.json({ stats });
  } catch (error) {
    return next(error);
  }
};
