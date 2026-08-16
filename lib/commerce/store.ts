import type { OrderResult } from "./types";

type DoneGlobal = typeof globalThis & {
  __doneOrderStore?: Map<string, OrderResult>;
};

const doneGlobal = globalThis as DoneGlobal;
const orderStore = doneGlobal.__doneOrderStore ?? new Map<string, OrderResult>();
doneGlobal.__doneOrderStore = orderStore;

export function findOrder(idempotencyKey: string) {
  return orderStore.get(idempotencyKey);
}

export function saveOrder(result: OrderResult) {
  orderStore.set(result.idempotencyKey, result);
  return result;
}

export function orderCount() {
  return orderStore.size;
}
