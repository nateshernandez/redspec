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

/**
 * The kind of moment a row is, for the five-way colouring the board reads at a
 * glance. Twelve hues is not a scale anybody can hold; five is, and the
 * question a reviewer scans a lane for -- "where does this go wrong, and where
 * is it just waiting?" -- is answered at this grain rather than at the row's.
 */
export type ChecklistFamily = "settled" | "transient" | "error" | "blocked" | "done"

/** Ordered for display, and the source of the row labels the board draws. */
export const CHECKLIST_ROWS: {
  row: ChecklistRow
  label: string
  asks: string
  family: ChecklistFamily
}[] = [
  { row: "empty", label: "Empty", asks: "no data yet, first run", family: "settled" },
  {
    row: "loading",
    label: "Loading",
    asks: "initial load, and refresh while populated",
    family: "transient",
  },
  {
    row: "partial",
    label: "Partial",
    asks: "some data present, some still arriving or failed",
    family: "settled",
  },
  { row: "populated", label: "Populated", asks: "the typical case", family: "settled" },
  {
    row: "overflowing",
    label: "Overflowing",
    asks: "long strings, many rows, values that break layout",
    family: "settled",
  },
  {
    row: "recoverableError",
    label: "Recoverable error",
    asks: "the user can retry or fix input",
    family: "error",
  },
  {
    row: "terminalError",
    label: "Terminal error",
    asks: "the user cannot proceed",
    family: "error",
  },
  {
    row: "permissionDenied",
    label: "Permission-denied",
    asks: "the actor may look but not act",
    family: "blocked",
  },
  {
    row: "stale",
    label: "Stale or offline",
    asks: "the data on screen is known to be out of date",
    family: "blocked",
  },
  {
    row: "inFlight",
    label: "In-flight",
    asks: "mid-submit, optimistic, awaiting confirmation",
    family: "transient",
  },
  {
    row: "terminalSuccess",
    label: "Terminal success",
    asks: "the flow is finished and the surface says so",
    family: "done",
  },
  {
    row: "conflict",
    label: "Conflict",
    asks: "someone else changed it underneath",
    family: "error",
  },
]

export const rowLabel = (row: ChecklistRow): string =>
  CHECKLIST_ROWS.find((r) => r.row === row)?.label ?? row

/**
 * The row as a situation rather than as a category: "someone else changed it
 * underneath" instead of "Conflict". People judge a concrete case well and
 * enumerate an abstract taxonomy badly, so this is the wording to put in front
 * of whoever is answering the row -- on the board, and in the interview.
 */
export const rowAsks = (row: ChecklistRow): string | undefined =>
  CHECKLIST_ROWS.find((r) => r.row === row)?.asks

/** The row's family, for the board's colouring and the minimap's. */
export const rowFamily = (row: ChecklistRow): ChecklistFamily =>
  CHECKLIST_ROWS.find((r) => r.row === row)?.family ?? "settled"
