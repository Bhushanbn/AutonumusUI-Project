import type { FunctionDeclaration } from "@google/genai";

// FinishTest tool declaration for the Gemini model. This tool is used to end a test scenario with a final verdict, including status, reasoning, and evidence steps.
export const finishTestDeclaration: FunctionDeclaration = {
  name: "finishTest",

  description:
    "End the current scenario with a final verdict. Must be your last action. " +
    "Only call this with status 'pass' if a browser_snapshot you actually took " +
    "confirms the Acceptance Criterion's specific checkpoint — never from assumption.",

  parametersJsonSchema: {
    type: "object",

    properties: {
      status: {
        type: "string",
        enum: ["pass", "fail"],
      },

      reasoning: {
        type: "string",
        description:
          "Grounded in what you actually observed in your last snapshot, " +
          "tied to the specific AC checkpoint.",
      },

      evidenceSteps: {
        type: "array",
        items: {
          type: "number",
        },
        description:
          "Step/turn numbers whose tool results support this verdict.",
      },
    },

    required: ["status", "reasoning", "evidenceSteps"],
    additionalProperties: false,
  },
};

export interface FinishTestArgs {
  status: "pass" | "fail";
  reasoning: string;
  evidenceSteps: number[];
}