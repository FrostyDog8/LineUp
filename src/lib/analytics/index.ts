/**
 * Analytics stub — no-ops unless NEXT_PUBLIC_GA_ID is set.
 * Google Analytics ships post-MVP; product events can be named now.
 */

const gaId = process.env.NEXT_PUBLIC_GA_ID?.trim() ?? "";

export const analyticsEnabled = gaId.length > 0;

export type AnalyticsEvent =
  | { name: "login_started"; props?: { delivery?: string } }
  | { name: "login_verified"; props?: Record<string, never> }
  | { name: "dashboard_viewed"; props?: Record<string, never> }
  | { name: "activity_create_clicked"; props?: Record<string, never> }
  | { name: "activity_join_clicked"; props?: Record<string, never> }
  | { name: string; props?: Record<string, unknown> };

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function track(event: AnalyticsEvent) {
  if (!analyticsEnabled || typeof window === "undefined") {
    return;
  }
  window.gtag?.("event", event.name, event.props ?? {});
}

export function getGaId() {
  return gaId || null;
}
