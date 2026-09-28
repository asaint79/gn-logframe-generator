// The structured logframe data model, plus pure functions to create and update it.
// This is the single source of truth the chat (claude.js) writes to and the
// preview table (render.js) reads from.

export const INDICATOR_FIELDS = [
  "objective",
  "indicator",
  "definition",
  "unit",
  "baseline",
  "target",
  "meansOfVerification",
  "frequency",
];

export function createEmptyState() {
  return {
    sector: null,
    rationale: "",
    crossCuttingIssue: "",
    outcomes: [],
  };
}

function createEmptyIndicatorRow() {
  const row = { gcfIndicatorId: null };
  for (const f of INDICATOR_FIELDS) row[f] = "";
  return row;
}

function createEmptyOutcome() {
  return { ...createEmptyIndicatorRow(), outputs: [] };
}

function createEmptyOutput() {
  return { ...createEmptyIndicatorRow(), activities: [] };
}

function applyFields(target, fields) {
  if (!fields) return;
  for (const [key, value] of Object.entries(fields)) {
    if (key in target || INDICATOR_FIELDS.includes(key) || key === "gcfIndicatorId" || key === "text") {
      target[key] = value;
    }
  }
}

/**
 * Applies one structured update (as produced by Claude's `update_logframe` tool call)
 * to a logframe state. Returns { state, error } — state is a new object on success,
 * the original state is returned unchanged alongside an error string on failure so the
 * caller can report it back to Claude as a tool_result error instead of crashing.
 */
export function applyUpdate(state, update) {
  const next = structuredClone(state);
  const { operation, outcomeIndex, outputIndex, activityIndex, fields } = update;

  try {
    switch (operation) {
      case "set_meta": {
        applyFields(next, fields);
        break;
      }
      case "add_outcome": {
        const outcome = createEmptyOutcome();
        applyFields(outcome, fields);
        next.outcomes.push(outcome);
        break;
      }
      case "update_outcome": {
        const outcome = requireOutcome(next, outcomeIndex);
        applyFields(outcome, fields);
        break;
      }
      case "remove_outcome": {
        requireOutcome(next, outcomeIndex);
        next.outcomes.splice(outcomeIndex, 1);
        break;
      }
      case "add_output": {
        const outcome = requireOutcome(next, outcomeIndex);
        const output = createEmptyOutput();
        applyFields(output, fields);
        outcome.outputs.push(output);
        break;
      }
      case "update_output": {
        const output = requireOutput(next, outcomeIndex, outputIndex);
        applyFields(output, fields);
        break;
      }
      case "remove_output": {
        const outcome = requireOutcome(next, outcomeIndex);
        requireOutput(next, outcomeIndex, outputIndex);
        outcome.outputs.splice(outputIndex, 1);
        break;
      }
      case "add_activity": {
        const output = requireOutput(next, outcomeIndex, outputIndex);
        output.activities.push({ text: fields?.text ?? "" });
        break;
      }
      case "update_activity": {
        const activity = requireActivity(next, outcomeIndex, outputIndex, activityIndex);
        if (fields?.text !== undefined) activity.text = fields.text;
        break;
      }
      case "remove_activity": {
        const output = requireOutput(next, outcomeIndex, outputIndex);
        requireActivity(next, outcomeIndex, outputIndex, activityIndex);
        output.activities.splice(activityIndex, 1);
        break;
      }
      default:
        return { state, error: `Unknown operation "${operation}".` };
    }
  } catch (err) {
    return { state, error: err.message };
  }

  return { state: next, error: null };
}

function requireOutcome(state, outcomeIndex) {
  const outcome = state.outcomes[outcomeIndex];
  if (!outcome) throw new Error(`No outcome at index ${outcomeIndex}. There are ${state.outcomes.length} outcome(s).`);
  return outcome;
}

function requireOutput(state, outcomeIndex, outputIndex) {
  const outcome = requireOutcome(state, outcomeIndex);
  const output = outcome.outputs[outputIndex];
  if (!output) throw new Error(`No output at index ${outputIndex} under outcome ${outcomeIndex}. That outcome has ${outcome.outputs.length} output(s).`);
  return output;
}

function requireActivity(state, outcomeIndex, outputIndex, activityIndex) {
  const output = requireOutput(state, outcomeIndex, outputIndex);
  const activity = output.activities[activityIndex];
  if (!activity) throw new Error(`No activity at index ${activityIndex} under outcome ${outcomeIndex}/output ${outputIndex}.`);
  return activity;
}
