import { isAuthDevBypassEnabled } from "@/lib/auth";

export async function GET() {
  return Response.json({
    devBypass: isAuthDevBypassEnabled(),
  });
}
