export function RosterEmpty() {
  return <p>No one here but you</p>
}
export function RosterPopulated({ names }: { names: string[] }) {
  return (
    <ul>
      {names.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  )
}
