import { apiForm } from "../api"
import type { Photo } from "../domain/models"
import { imageForm, prepareImage } from "../media"

export async function uploadPhotos(
  files: File[],
  groupId: string | null,
  onProgress: (done: number, total: number) => void,
): Promise<string[]> {
  const failures: string[] = []
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    if (!file) continue
    onProgress(index + 1, files.length)
    try {
      const prepared = await prepareImage(file)
      const name = file.name.replace(/\.[^.]+$/, "")
      await apiForm<Photo>("/api/photos", "POST", imageForm(prepared, name, groupId))
    } catch {
      failures.push(file.name)
    }
  }
  return failures
}
