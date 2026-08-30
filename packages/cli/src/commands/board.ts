import { spawn } from "node:child_process"
import pc from "picocolors"
import { loadContext, packageManager, runScript } from "../context"

/** Start the app's dev server and say where the board is. */
export async function board(root: string, feature?: string): Promise<number> {
  const ctx = await loadContext(root)
  if (ctx.config.framework === "none") {
    console.error(
      pc.red(
        'No framework adapter configured, so there is no spec route to open. Set framework: "next" in spec.config.ts.'
      )
    )
    return 1
  }
  const url = `http://localhost:3000${ctx.config.route}${feature ? `/${feature}` : ""}`
  console.log(pc.dim(`$ ${runScript(packageManager(root), "dev")}`))
  console.log(`${pc.bold("Board:")} ${url}`)
  const child = spawn(runScript(packageManager(root), "dev"), {
    shell: true,
    stdio: "inherit",
    cwd: root,
  })
  return await new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 0)))
}
