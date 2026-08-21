/**
 * Shape of GET /v1/admin/analytics.
 *
 * Mirrors `potatopay-backend/src/routes/admin-analytics.ts`. Kept as a plain
 * declaration rather than generated, because the two move together rarely and
 * a wrong field here shows up immediately as `undefined` on screen.
 */

export const SECTIONS = [
  { id: "revenue", label: "Revenue" },
  { id: "payments", label: "Payment health" },
  { id: "creators", label: "Creators" },
  { id: "supporters", label: "Supporters" },
  { id: "plans", label: "Plans" },
  { id: "media", label: "Media" },
  { id: "overlay", label: "Overlay" },
  { id: "compliance", label: "Compliance" },
  { id: "payouts", label: "Payouts" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export type SeriesPoint = {
  day: string;
  grossPaise: number;
  capturedTips: number;
  createdTips: number;
  failedTips: number;
  activeCreators: number;
  activeSupporters: number;
  newCreators: number;
  planRevenuePaise: number;
  mediaRequested: number;
  payoutsPaidPaise: number;
};

export type Analytics = {
  meta: { range: number; generatedAt: string; days: string[]; cached: boolean; cacheTtlSeconds: number };
  headline: {
    grossPaise: number;
    grossDelta: number | null;
    capturedTips: number;
    capturedTipsDelta: number | null;
    averageTipPaise: number;
    averageTipDelta: number | null;
    planRevenuePaise: number;
    planRevenueDelta: number | null;
  };
  series: SeriesPoint[];
  revenue: {
    grossPaise: number;
    previousGrossPaise: number;
    planRevenuePaise: number;
    totalHandledPaise: number;
    largestTipPaise: number;
    averageTipPaise: number;
    tierMix: { blue: number; green: number; red: number };
    tierSharePercent: { blue: number; green: number; red: number };
    bestDay: { day: string; grossPaise: number } | null;
  };
  payments: {
    attempted: number;
    captured: number;
    failed: number;
    abandoned: number;
    captureRatePercent: number;
    failureRatePercent: number;
    abandonRatePercent: number;
    averageCheckoutSeconds: number;
  };
  creators: {
    total: number;
    publicPages: number;
    activatedEver: number;
    activationRatePercent: number;
    newInWindow: number;
    newDelta: number | null;
    earningInWindow: number;
    peakActiveInDay: number;
    top10SharePercent: number;
    leaderboard: Array<{
      rank: number;
      username: string;
      displayName: string;
      plan: string;
      tipCount: number;
      amountPaise: number;
      sharePercent: number;
    }>;
  };
  supporters: {
    unique: number;
    returning: number;
    newInWindow: number;
    repeatInWindow: number;
    repeatRatePercent: number;
    returningRatePercent: number;
    averagePerSupporterPaise: number;
    topSupporterPaise: number;
    anonymousTips: number;
    anonymousSharePercent: number;
    tipsWithMessage: number;
    messageSharePercent: number;
  };
  plans: {
    starter: number;
    pro: number;
    lapsed: number;
    neverPaid: number;
    paying: number;
    paidSharePercent: number;
    expiring7d: number;
    expiring30d: number;
    ordersInWindow: number;
    activationsInWindow: number;
    checkoutCompletionPercent: number;
    revenuePaise: number;
    revenueDelta: number | null;
  };
  media: {
    requested: number;
    approved: number;
    rejected: number;
    pendingNow: number;
    approvalRatePercent: number;
    averageReviewMinutes: number;
    requestedDelta: number | null;
  };
  overlay: {
    configured: number;
    alertsOn: number;
    soundOn: number;
    leaderboardOn: number;
    qrOn: number;
    themes: Array<{ theme: string; creators: number }>;
  };
  compliance: {
    kyc: ReviewQueue;
    bank: ReviewQueue;
  };
  payouts: {
    paidInWindow: number;
    paidPaise: number;
    failedInWindow: number;
    openCount: number;
    openPaise: number;
    failedTotal: number;
    unsettledPaise: number;
    averageSettlementHours: number;
    paidDelta: number | null;
  };
};

type ReviewQueue = {
  pending: number;
  approved: number;
  rejected: number;
  needsResubmission: number;
  oldestPendingHours: number;
  averageReviewHours: number;
};
