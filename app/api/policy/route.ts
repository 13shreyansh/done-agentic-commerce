import { BEST_POLICY, BEST_POLICY_MARKDOWN } from "@/lib/commerce/policy";

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format");
  if (format === "md") {
    return new Response(BEST_POLICY_MARKDOWN, {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }
  return Response.json(BEST_POLICY);
}
