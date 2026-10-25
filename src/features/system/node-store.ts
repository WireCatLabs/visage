import { create } from "zustand"
import { platform } from "@/platform/bridge"
import type { NodeEvent, NodeOffer, NodePath } from "@/platform/schemas"
import { useSystem } from "./store"

export type NodeStep = Extract<NodeEvent, { event: "step" }>["step"]
type Failure = Extract<NodeEvent, { event: "failed" }>

type NodeState = {
  offer: NodeOffer | null
  offerError: string | null
  running: boolean
  step: NodeStep | null
  received: number
  total: number | null
  failure: Failure | null
  path: NodePath | null
  busy: boolean
  error: string | null
  loadOffer(): Promise<void>
  setup(): Promise<void>
  cancel(): Promise<void>
  loadPath(): Promise<void>
  setPath(add: boolean): Promise<void>
  remove(): Promise<boolean>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useNode = create<NodeState>((set, get) => ({
  offer: null,
  offerError: null,
  running: false,
  step: null,
  received: 0,
  total: null,
  failure: null,
  path: null,
  busy: false,
  error: null,
  async loadOffer() {
    if (get().offer) return
    try {
      set({ offer: await platform.nodeOffer(), offerError: null })
    } catch (e) {
      set({ offerError: message(e) })
    }
  },
  async setup() {
    if (get().running) return
    set({ running: true, step: "check", received: 0, total: null, failure: null })
    await platform.setupNode((e) => {
      if (e.event === "step") set({ step: e.step })
      else if (e.event === "progress") set({ received: e.received, total: e.total })
      else if (e.event === "failed") set({ failure: e, running: false })
      else set({ running: false, step: null })
    })
    // The search path changed, so Node, npm and every tool are looked up again.
    if (!get().failure) await useSystem.getState().refresh()
  },
  async cancel() {
    await platform.cancelNodeSetup()
  },
  async loadPath() {
    try {
      set({ path: await platform.nodePath(), error: null })
    } catch (e) {
      set({ error: message(e) })
    }
  },
  async setPath(add) {
    set({ busy: true, error: null })
    try {
      set({ path: await platform.setNodePath(add) })
    } catch (e) {
      set({ error: message(e) })
    } finally {
      set({ busy: false })
    }
  },
  async remove() {
    set({ busy: true, error: null })
    try {
      await platform.removeNode()
      set({ path: null, offer: null })
      await useSystem.getState().refresh()
      return true
    } catch (e) {
      set({ error: message(e) })
      return false
    } finally {
      set({ busy: false })
    }
  },
}))
