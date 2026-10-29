import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { StoreInfo, TableList } from "@/platform/archive-schemas"
import { platform } from "@/platform/bridge"
import type { StorageArea } from "@/platform/schemas"
import { useStorage } from "./store"

beforeEach(() => useStorage.setState(useStorage.getInitialState(), true))
afterEach(() => vi.restoreAllMocks())

it("keeps the last folders, facts and tables on screen while it asks again", async () => {
  const areas: StorageArea[] = [{ id: "tg", folders: [], usedBy: ["tg"] }]
  const info = { answeredBy: "tg" } as StoreInfo
  const tables = { answeredBy: "tg", available: true, measured: false, tables: [] } as TableList
  useStorage.setState({ areas, info, tables })
  let answer: (a: StorageArea[]) => void = () => undefined
  vi.spyOn(platform, "storage").mockReturnValue(new Promise((r) => (answer = r)))
  vi.spyOn(platform, "storeInfo").mockReturnValue(new Promise(() => undefined))
  vi.spyOn(platform, "storeTables").mockReturnValue(new Promise(() => undefined))

  void useStorage.getState().refresh()
  expect(useStorage.getState()).toMatchObject({ revalidating: true, areas, info, tables })

  const fresh: StorageArea[] = [{ id: "tg", folders: [], usedBy: [] }]
  answer(fresh)
  await vi.waitFor(() => expect(useStorage.getState().areas).toEqual(fresh))
  expect(useStorage.getState().info).toBe(info)
})
