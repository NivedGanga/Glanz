function positiveInt(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid ${name}`);
  return value;
}
export const config = {
  freeItemCap: positiveInt("FREE_ITEM_CAP", 50),
  branchCap: positiveInt("FREE_BRANCH_CAP", 1),
  staffCap: positiveInt("FREE_STAFF_CAP", 1),
  dailyNotifications: positiveInt("DAILY_NOTIFICATION_CAP", 3),
  monthlyNotifications: positiveInt("MONTHLY_REQUEST_NOTIFICATION_CAP", 30),
  monthlyAnalyses: positiveInt("MONTHLY_AI_ANALYSIS_CAP", 20),
  limitedThreshold: positiveInt("LIMITED_STOCK_THRESHOLD", 2),
  recommendationShops: positiveInt("RECOMMENDATION_SHOPS", 5),
  ignoredAfterHours: positiveInt("IGNORED_AFTER_HOURS", 24),
  digestIntervalHours: positiveInt("DIGEST_INTERVAL_HOURS", 12),
  similarityThreshold: Number(process.env.SIMILARITY_THRESHOLD ?? 0.45),
  minRelevance: Number(process.env.MIN_RELEVANCE ?? 2)
};
export const freeEntitlements = () => ({
  items: config.freeItemCap, branches: config.branchCap, staff: config.staffCap,
  dailyNotifications: config.dailyNotifications, monthlyNotifications: config.monthlyNotifications,
  monthlyAnalyses: config.monthlyAnalyses
});
