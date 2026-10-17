import { Route, Routes } from "react-router"
import { EditorPage } from "./editor/EditorPage"
import { PrintPage } from "./export/PrintPage"
import { BiblePage } from "./library/BiblePage"
import { IdentitiesPage } from "./library/IdentitiesPage"
import { PhotosPage } from "./library/PhotosPage"
import { QuotesPage } from "./library/QuotesPage"
import { ProjectPage } from "./projects/ProjectPage"
import { ProjectsPage } from "./projects/ProjectsPage"
import { Shell } from "./shell/Shell"

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectPage />} />
        <Route path="projects/:projectId/print" element={<PrintPage />} />
        <Route path="quotes" element={<QuotesPage />} />
        <Route path="bible" element={<BiblePage />} />
        <Route path="identities" element={<IdentitiesPage />} />
        <Route path="photos" element={<PhotosPage />} />
      </Route>
      <Route path="projects/:projectId/designs/:designId" element={<EditorPage />} />
    </Routes>
  )
}
