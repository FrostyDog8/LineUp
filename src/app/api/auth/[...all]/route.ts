import { authConfigured, getAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

async function stubIfUnconfigured(request: Request) {
  if (authConfigured) {
    return null;
  }
  return Response.json(
    {
      ok: false,
      stubbed: true,
      message:
        "Better Auth is scaffolded but BETTER_AUTH_SECRET / DATABASE_URL are not fully configured.",
      path: new URL(request.url).pathname,
    },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const stub = await stubIfUnconfigured(request);
  if (stub) return stub;
  const handlers = toNextJsHandler(getAuth());
  return handlers.GET(request);
}

export async function POST(request: Request) {
  const stub = await stubIfUnconfigured(request);
  if (stub) return stub;
  const handlers = toNextJsHandler(getAuth());
  return handlers.POST(request);
}
