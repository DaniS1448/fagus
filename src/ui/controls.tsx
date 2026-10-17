import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react"
import { Link } from "react-router"

const buttonStyles = {
  solid: "bg-ink text-paper hover:bg-ink/90",
  quiet: "bg-transparent text-bark hover:bg-bark/5",
  danger: "text-mark hover:bg-mark/10",
  paper: "bg-paper text-bark hover:bg-white",
} as const

export function Button({
  variant = "solid",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonStyles }) {
  return (
    <button
      type={type}
      className={`px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  )
}

export function ButtonLink({
  to,
  variant = "solid",
  children,
}: {
  to: string
  variant?: keyof typeof buttonStyles
  children: ReactNode
}) {
  return (
    <Link to={to} className={`inline-block px-3 py-2 text-sm ${buttonStyles[variant]}`}>
      {children}
    </Link>
  )
}

export function ConfirmButton({
  label,
  question,
  onConfirm,
  pending = false,
}: {
  label: string
  question: string
  onConfirm: () => void
  pending?: boolean
}) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        {label}
      </Button>
    )
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-sm">{question}</span>
      <Button variant="danger" disabled={pending} onClick={onConfirm}>
        {label}
      </Button>
      <Button variant="quiet" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </span>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      {children}
    </label>
  )
}

const controlClass = "border border-line bg-white px-3 py-2 text-sm outline-none"

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className ?? ""}`} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${controlClass} min-h-28 ${props.className ?? ""}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlClass} ${props.className ?? ""}`} />
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="text-sm text-mark">{children}</p>
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-md border border-dashed border-bark/20 bg-white/40 px-5 py-8">
      <h2 className="text-lg">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-bark/70">{children}</div>
    </div>
  )
}
