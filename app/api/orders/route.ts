import { executePurchase } from "@/lib/commerce/engine";
import { findOrder, orderCount, saveOrder } from "@/lib/commerce/store";
import type { PurchaseCommand } from "@/lib/commerce/types";

export async function GET(request: Request) {
  const idempotencyKey = new URL(request.url).searchParams.get("idempotencyKey");
  if (!idempotencyKey) return Response.json({ storedOrders: orderCount(), mode: "process-local" });
  const order = findOrder(idempotencyKey);
  return order
    ? Response.json(order)
    : Response.json({ error: "Order not found" }, { status: 404 });
}

export async function POST(request: Request) {
  try {
    const command = await request.json() as PurchaseCommand;
    const existing = findOrder(command.idempotencyKey);

    if (existing) {
      return Response.json({
        ...existing,
        replayed: true,
        audit: [
          ...existing.audit,
          {
            step: "idempotency.replayed" as const,
            detail: `Duplicate request blocked; original order ${existing.order.id} returned`,
            at: new Date().toISOString(),
          },
        ],
      }, {
        headers: { "X-Idempotent-Replay": "true" },
      });
    }

    const result = saveOrder(executePurchase(command));
    return Response.json(result, {
      status: 201,
      headers: { "X-Idempotent-Replay": "false" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid purchase request";
    return Response.json({ error: message }, { status: 400 });
  }
}
