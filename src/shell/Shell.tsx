import { NavLink, Outlet } from "react-router"

const links = [
  { to: "/", label: "Proyectos", end: true },
  { to: "/quotes", label: "Citas", end: false },
  { to: "/bible", label: "Textos bíblicos", end: false },
  { to: "/identities", label: "Identidad", end: false },
  { to: "/photos", label: "Fotos", end: false },
]

export function Shell() {
  return (
    <div className="flex min-h-full flex-col bg-foam text-bark md:flex-row">
      <aside className="flex shrink-0 flex-col bg-bark text-mat md:min-h-screen md:w-56">
        <div className="px-5 pt-6 pb-4">
          <p className="text-sm text-mat/70">Estudio local</p>
          <p className="text-3xl text-white">Fagus</p>
        </div>
        <nav className="flex gap-1 overflow-auto px-3 pb-4 md:flex-col">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `px-3 py-2 text-sm whitespace-nowrap ${isActive ? "bg-white/10 text-white" : "text-mat hover:bg-white/5"}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto hidden px-5 py-6 text-sm text-mat/60 md:block">
          Los datos se quedan en este ordenador.
        </p>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
