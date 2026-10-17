export type MarkKind = "photo" | "quote" | "bible" | "identity"

export function KindMark({ kind }: { kind: MarkKind }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="shrink-0">
      <MarkShape kind={kind} />
    </svg>
  )
}

function MarkShape({ kind }: { kind: MarkKind }) {
  switch (kind) {
    case "photo":
      return <rect x="2" y="3" width="12" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
    case "quote":
      return (
        <path
          d="M3 5.5h10M3 8.5h8M3 11.5h5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
      )
    case "bible":
      return (
        <path
          d="M2.5 3.5h5.2c.7 1.2.7 7.8 0 9H2.5V3.5zM13.5 3.5H8.3c-.7 1.2-.7 7.8 0 9h5.2V3.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      )
    case "identity":
      return <circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}
