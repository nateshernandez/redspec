import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { mergeSection } from "@redspec/method"

export type Written = { path: string; action: "created" | "updated" | "kept" }

export class Writer {
  written: Written[] = []
  constructor(readonly root: string) {}

  /** Write only if the file does not exist. */
  create(rel: string, content: string): void {
    const abs = join(this.root, rel)
    if (existsSync(abs)) {
      this.written.push({ path: rel, action: "kept" })
      return
    }
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
    this.written.push({ path: rel, action: "created" })
  }

  /** Overwrite; these are generated files that carry a "generated" header. */
  write(rel: string, content: string): void {
    const abs = join(this.root, rel)
    const existed = existsSync(abs)
    if (existed && readFileSync(abs, "utf8") === content) {
      this.written.push({ path: rel, action: "kept" })
      return
    }
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
    this.written.push({ path: rel, action: existed ? "updated" : "created" })
  }

  /** Replace or append a marked section, leaving the rest of the file alone. */
  section(rel: string, content: string): void {
    const abs = join(this.root, rel)
    const existing = existsSync(abs) ? readFileSync(abs, "utf8") : null
    const next = mergeSection(existing, content)
    if (existing === next) {
      this.written.push({ path: rel, action: "kept" })
      return
    }
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, next)
    this.written.push({ path: rel, action: existing ? "updated" : "created" })
  }

  append(rel: string, content: string): void {
    const abs = join(this.root, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, (existsSync(abs) ? readFileSync(abs, "utf8") : "") + content)
    this.written.push({ path: rel, action: "updated" })
  }

  read(rel: string): string | null {
    const abs = join(this.root, rel)
    return existsSync(abs) ? readFileSync(abs, "utf8") : null
  }
}
