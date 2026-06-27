import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const currentVersion = () => (
  process.env.VERCEL_GIT_COMMIT_SHA
  || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
  || process.env.VERCEL_URL
  || "local-development"
);

export function GET() {
  return NextResponse.json(
    { version: currentVersion() },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
