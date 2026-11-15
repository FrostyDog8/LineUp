/**
 * Provider-agnostic auth delivery adapter.
 * Swap SMS OTP ↔ WhatsApp magic link without rewriting sessions.
 *
 * Env: AUTH_DELIVERY=sms|whatsapp (documented for cost spike; optional in M1).
 */

export type AuthDeliveryKind = "sms" | "whatsapp";

export type SendOtpInput = {
  phone: string; // E.164
  code: string;
};

export type SendMagicLinkInput = {
  phone: string;
  url: string;
};

export interface AuthDelivery {
  kind: AuthDeliveryKind;
  sendOtp(input: SendOtpInput): Promise<{ ok: boolean; stubbed?: boolean }>;
  sendMagicLink(
    input: SendMagicLinkInput,
  ): Promise<{ ok: boolean; stubbed?: boolean }>;
}

function missingCredentials(provider: string) {
  console.warn(
    `[auth-delivery] ${provider} credentials missing — challenge not sent (stub).`,
  );
}

/** Twilio Verify–shaped stub. No-ops unless TWILIO_* env is present later. */
export const twilioSmsDelivery: AuthDelivery = {
  kind: "sms",
  async sendOtp({ phone }) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!accountSid || !authToken || !verifySid) {
      missingCredentials("Twilio Verify");
      return { ok: true, stubbed: true };
    }
    // Real Twilio Verify call lands in M1 exit after cost spike.
    void phone;
    return { ok: true, stubbed: true };
  },
  async sendMagicLink() {
    return { ok: false, stubbed: true };
  },
};

/** WhatsApp Cloud API magic-link stub (auth delivery only — not the group bot). */
export const whatsappMagicLinkDelivery: AuthDelivery = {
  kind: "whatsapp",
  async sendOtp() {
    return { ok: false, stubbed: true };
  },
  async sendMagicLink({ phone, url }) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) {
      missingCredentials("WhatsApp Cloud API");
      return { ok: true, stubbed: true };
    }
    void phone;
    void url;
    return { ok: true, stubbed: true };
  },
};

export function getAuthDelivery(): AuthDelivery {
  const mode = (process.env.AUTH_DELIVERY ?? "sms").toLowerCase();
  return mode === "whatsapp" ? whatsappMagicLinkDelivery : twilioSmsDelivery;
}
