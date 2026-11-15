"use client";

import Script from "next/script";
import { analyticsEnabled, getGaId } from "@/lib/analytics";

/** Loads GA only when NEXT_PUBLIC_GA_ID is set; otherwise renders nothing. */
export function AnalyticsProvider() {
  const gaId = getGaId();
  if (!analyticsEnabled || !gaId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
