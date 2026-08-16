import { openai } from "@ai-sdk/openai";
import { Output, ToolLoopAgent } from "ai";
import { z } from "zod";

const shoppingRequestSchema = z.object({
  isPurchaseRequest: z.boolean(),
  summary: z.string().min(1).max(240),
  acknowledgment: z.string().min(1).max(240),
  item: z.string().nullable(),
  quantity: z.number().int().positive().nullable(),
  deliveryLocation: z.string().nullable(),
  budgetSgd: z.number().nonnegative().nullable(),
  constraints: z.array(z.string()).max(10),
});

function createDoneAgent() {
  const modelId = process.env.DONE_OPENAI_MODEL || "gpt-5.6-luna";
  return {
    modelId,
    agent: new ToolLoopAgent({
      id: "done-imessage-commerce-agent",
      model: openai(modelId),
      output: Output.object({ schema: shoppingRequestSchema }),
      instructions: [
        "You are DONE: Don't buy products. Buy outcomes.",
        "You interpret short iMessage requests for an autonomous commerce demo in Singapore.",
        "Extract the requested outcome, item, quantity, delivery location, budget, and important constraints.",
        "budgetSgd must be the customer's explicit spending ceiling; never replace it with the host safety maximum.",
        "The acknowledgment must be natural, decisive, and at most two short sentences.",
        "Do not ask a follow-up question when the user already supplied an item, destination, and budget.",
        "Never claim that you searched merchants, charged money, placed an order, or completed delivery.",
        "Never invent a price, merchant, address, payment, or transaction.",
        "The host application owns approval, payment, and fulfillment; you only interpret and acknowledge.",
      ].join("\n"),
    }),
  };
}

export async function understandShoppingRequest({ text, approvalLimitSgd }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set for the DONE language engine.");
  }

  const { agent, modelId } = createDoneAgent();
  const result = await agent.generate({
    prompt: [
      `Hard safety ceiling: S$${approvalLimitSgd.toFixed(2)}. Extract the customer's stated budget exactly; do not substitute this ceiling.`,
      "Interpret this incoming iMessage:",
      text,
    ].join("\n"),
  });

  return { ...result.output, modelId };
}
