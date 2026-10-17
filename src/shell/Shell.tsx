import { NavLink, Outlet } from "react-router"

const libraries = [
  { to: "/quotes", label: "Citas" },
  { to: "/bible", label: "Textos bíblicos" },
  { to: "/identities", label: "Identidad" },
  { to: "/photos", label: "Fotos" },
]

export function Shell() {
  return (
    <div className="flex min-h-full flex-col bg-foam text-bark md:flex-row">
      <aside className="flex shrink-0 flex-col bg-bark text-mat md:min-h-screen md:w-56">
        <div className="px-5 pt-6 pb-4">
          <p className="text-3xl text-white">Fagus</p>
        </div>
        <nav className="flex gap-1 overflow-auto px-3 pb-4 md:flex-col">
          <RailLink to="/" end>
            Proyectos
          </RailLink>
          <p className="hidden px-3 pt-5 pb-1 text-sm text-mat/60 md:block">Bibliotecas</p>
          {libraries.map((link) => (
            <RailLink key={link.to} to={link.to}>
              {link.label}
            </RailLink>
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

function RailLink({ to, end = false, children }: { to: string; end?: boolean; children: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `px-3 py-2 text-sm whitespace-nowrap ${isActive ? "bg-white/10 text-white" : "text-mat hover:bg-white/5"}`
      }
    >
      {children}
    </NavLink>
  )
}
