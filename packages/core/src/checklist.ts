// The twelve states any surface can be in. Every one is answered per surface,
// either by the state that shows it or by a written waiver.

export type ChecklistRow =
  | "empty"
  | "loading"
  | "partial"
  | "populated"
  | "overflowing"
  | "recoverableError"
  | "terminalError"
  | "permissionDenied"
  | "stale"
  | "inFlight"
  | "terminalSuccess"
  | "conflict"

/** Ordered for display, and the source of the row labels the board draws. */
export const CHECKLIST_ROWS: { row: ChecklistRow; label: string; asks: string }[] = [
  { row: "empty", label: "Empty", asks: "no data yet, first run" },
  { row: "loading", label: "Loading", asks: "initial load, and refresh while populated" },
  {
    row: "partial",
    label: "Partial",
    asks: "some data present, some still arriving or failed",
  },
  { row: "populated", label: "Populated", asks: "the typical case" },
  {
    row: "overflowing",
    label: "Overflowing",
    asks: "long strings, many rows, values that break layout",
  },
  {
    row: "recoverableError",
    label: "Recoverable error",
    asks: "the user can retry or fix input",
  },
  { row: "terminalError", label: "Terminal error", asks: "the user cannot proceed" },
  {
    row: "permissionDenied",
    label: "Permission-denied",
    asks: "the actor may look but not act",
  },
  {
    row: "stale",
    label: "Stale or offline",
    asks: "the data on screen is known to be out of date",
  },
  {
    row: "inFlight",
    label: "In-flight",
    asks: "mid-submit, optimistic, awaiting confirmation",
  },
  {
    row: "terminalSuccess",
    label: "Terminal success",
    asks: "the flow is finished and the surface says so",
  },
  { row: "conflict", label: "Conflict", asks: "someone else changed it underneath" },
]

export const rowLabel = (row: ChecklistRow): string =>
  CHECKLIST_ROWS.find((r) => r.row === row)?.label ?? row
