import type { ReactNode } from "react"

export function LibraryScreen({
  title,
  lede,
  list,
  form,
}: {
  title: string
  lede: string
  list: ReactNode
  form: ReactNode
}) {
  return (
    <div className="grid min-h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="px-6 py-8 lg:px-10">
        <h1 className="text-3xl">{title}</h1>
        <p className="mt-2 max-w-xl text-bark/70">{lede}</p>
        <div className="mt-8">{list}</div>
      </section>
      <aside className="border-t border-line bg-white/50 px-6 py-8 lg:border-t-0 lg:border-l">{form}</aside>
    </div>
  )
}
