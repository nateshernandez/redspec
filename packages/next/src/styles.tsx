// The spec routes carry their own stylesheet rather than asking the host app to
// wire one up.
//
// A CSS `import` in the package would leave the board at the mercy of the app's
// bundler and its cascade order -- and the failure is silent: React Flow lays
// every node out in the text flow and the page looks like a spilled word list.
// tsup loads both files as text (see tsup.config.ts), so the bytes travel
// inside the module and the page emits them itself.

import flowCss from "@xyflow/react/dist/style.css"
import boardCss from "./board/board.css"

/** React Flow first: everything in board.css is meant to win over it. */
export const specStyles = `${flowCss}\n${boardCss}`

/**
 * `href` + `precedence` are what let React hoist this into <head> and emit it
 * once no matter how many times it is rendered.
 */
export function SpecStyles() {
  return (
    <style
      href="redspec-board"
      precedence="redspec"
      dangerouslySetInnerHTML={{ __html: specStyles }}
    />
  )
}
