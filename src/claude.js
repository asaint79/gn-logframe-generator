import { CLAUDE_MODEL, ANTHROPIC_VERSION } from "./constants.js";

const API_URL = "https://api.anthropic.com/v1/messages";

export const UPDATE_LOGFRAME_TOOL = {
  name: "update_logframe",
  description:
    "Add or edit part of the structured logframe (sector metadata, an Outcome, an Output, or an Activity). " +
    "Call this as soon as you have gathered enough information for a field, rather than waiting until " +
    "the whole conversation is finished. Indices are 0-based and refer to the current state of the logframe.",
  input_schema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: [
          "set_meta",
          "add_outcome",
          "update_outcome",
          "remove_outcome",
          "add_output",
          "update_output",
          "remove_output",
          "add_activity",
          "update_activity",
          "remove_activity",
        ],
        description: "Which part of the logframe to change.",
      },
      outcomeIndex: { type: "integer", description: "0-based index of the Outcome. Required for every operation except set_meta/add_outcome." },
      outputIndex: { type: "integer", description: "0-based index of the Output within its Outcome. Required for output/activity operations except add_output." },
      activityIndex: { type: "integer", description: "0-based index of the Activity within its Output. Required for update_activity/remove_activity." },
      fields: {
        type: "object",
        description:
          "Fields to set. For set_meta: rationale, crossCuttingIssue. For outcome/output ops: objective, indicator, " +
          "definition, unit, baseline, target, meansOfVerification, frequency, gcfIndicatorId (number, only for outcomes, " +
          "or null for a custom indicator not in the Good Change Framework pool). For activity ops: text.",
        properties: {
          rationale: { type: "string" },
          crossCuttingIssue: { type: "string" },
          objective: { type: "string" },
          indicator: { type: "string" },
          definition: { type: "string" },
          unit: { type: "string" },
          baseline: { type: "string" },
          target: { type: "string" },
          meansOfVerification: { type: "string" },
          frequency: { type: "string" },
          gcfIndicatorId: { type: ["integer", "null"] },
          text: { type: "string" },
        },
      },
    },
    required: ["operation"],
  },
};

export function buildSystemPrompt(sector, gcfIndicators, currentStateJson) {
  const indicatorPool = gcfIndicators
    .map((i) => `- [id ${i.id}] (${i.outputOrOutcome ?? "?"}) ${i.indicator}${i.definition ? ` — ${i.definition}` : ""}`)
    .join("\n");

  return `You are an assistant that helps Good Neighbors International (GN) field staff build the \
"Log Frame + M&E Framework" section of a GN Project Proposal Form (PPF), for the ${sector} sector.

The user will start from either (a) a specific activity/project idea, or (b) a specific donor \
requirement (e.g. a call-for-proposals outcome or requirement). Read their first message and \
silently decide which one it is:
- If it's an activity idea, this is usually an Output- or Activity-level idea: infer upward what \
  Outcome it would contribute to.
- If it's a donor requirement, this is usually already Outcome-level (or close to it): decompose \
  downward into Outputs and Activities.
Do not ask the user which mode this is — figure it out yourself and ask whatever follow-up \
questions are actually needed to fill in the structure below. Keep questions short and concrete, \
one or two at a time, not a long questionnaire.

Target structure (matches GN's actual PPF sector sheet exactly — do not add a Goal/Impact row or \
an Assumptions column, GN's template doesn't have them):
- One or more Outcomes. Each Outcome needs: Objective (the outcome statement), Indicator, \
  Definition, Unit, Baseline, Target, Means of Verification, Frequency of Data Collection.
- Each Outcome has one or more Outputs, each needing the same fields as an Outcome.
- Each Output has one or more Activities (short text only, e.g. "1.1.1 Train 20 teachers on...").

Outcome indicators MUST first be checked against GN's own Good Change Framework indicator pool for \
this sector, listed below. If one fits (even approximately), use it verbatim and pass its numeric \
id as gcfIndicatorId. Only propose a custom outcome indicator, with gcfIndicatorId set to null, if \
nothing in the pool fits — and say so to the user. Output and Activity indicators are always \
project-specific (not in this pool) — make sure they are SMART (Specific, Measurable, Achievable, \
Relevant, Time-bound).

Good Change Framework indicator pool for ${sector}:
${indicatorPool || "(no indicators found for this sector)"}

Call the update_logframe tool as soon as you have enough information for a field — don't wait \
until the end of the conversation. After each Outcome's Outputs are complete, ask the user if they \
want to add another Outcome; keep going until they say they're done, then give a short plain-text \
summary of what's been captured.

Respond only in English, including all logframe content, even if the user writes in another \
language.

Current state of the logframe (JSON, for your reference — call update_logframe to change it):
${currentStateJson}`;
}

/**
 * Sends one user message to Claude and drives the tool-use loop to completion.
 *
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.systemPrompt
 * @param {Array} opts.messages - Anthropic-format message history (mutated copy is returned, not the input array).
 * @param {(input: object) => string} opts.onToolCall - Applies one update_logframe call; returns a short
 *        text result to send back to Claude as the tool_result (e.g. "ok" or an error description).
 * @returns {Promise<{ messages: Array, assistantText: string }>}
 */
export async function runTurn({ apiKey, systemPrompt, messages, onToolCall }) {
  let working = messages.slice();

  // Safety valve: a runaway tool-call loop should never hang the tab forever.
  for (let step = 0; step < 12; step++) {
    const response = await callMessagesApi({ apiKey, systemPrompt, messages: working });
    working.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) {
      const assistantText = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { messages: working, assistantText };
    }

    const toolResults = toolUses.map((block) => {
      let content;
      try {
        content = onToolCall(block.input);
      } catch (err) {
        content = `Error: ${err.message}`;
      }
      return { type: "tool_result", tool_use_id: block.id, content: String(content) };
    });
    working.push({ role: "user", content: toolResults });
  }

  throw new Error("The conversation made too many tool calls in a row without responding — stopped to avoid a runaway loop.");
}

async function callMessagesApi({ apiKey, systemPrompt, messages }) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      tools: [UPDATE_LOGFRAME_TOOL],
      messages,
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error?.message ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(`Claude API error (${res.status}): ${detail}`);
  }

  return res.json();
}

export async function loadGcfIndicators(sector) {
  const res = await fetch("data/gcf_indicators.json");
  if (!res.ok) throw new Error("Could not load data/gcf_indicators.json");
  const all = await res.json();
  return all.filter((i) => i.sector === sector);
}
