// Reading BRIEF.md: the one artifact kind that cannot go red, so the little
// structure it has is read strictly.

/** The `## <name>` sections of a Brief, keyed by heading text. */
export function briefSections(brief: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const re = /^##\s+(.+?)\s*$/gm
  const matches = [...brief.matchAll(re)]
  matches.forEach((m, i) => {
    const start = m.index! + m[0].length
    const end = matches[i + 1]?.index ?? brief.length
    sections[m[1]!.trim()] = brief.slice(start, end).trim()
  })
  return sections
}

/**
 * The actors a Brief names: one bolded bullet each under `## Actors`. Works
 * whether or not another section follows, which the earlier `\Z` version did
 * not -- JavaScript has no `\Z`, so it matched a literal Z.
 */
export function actorsInBrief(brief: string): string[] {
  const section = briefSections(brief)["Actors"]
  if (!section) return []
  return [...section.matchAll(/^\s*[-*]\s+\*\*(.+?)\*\*/gm)].map((m) => m[1]!.trim())
}

export const BRIEF_SECTIONS = [
  "Problem",
  "Actors",
  "What changes",
  "Non-goals",
  "Deliberate unknowns",
] as const

/** Which required sections a Brief is missing. */
export function missingBriefSections(brief: string): string[] {
  const present = new Set(Object.keys(briefSections(brief)))
  return BRIEF_SECTIONS.filter((s) => !present.has(s))
}
