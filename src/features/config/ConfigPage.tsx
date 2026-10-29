import { Search } from "lucide-react"
import { type ReactNode, useEffect, useId, useMemo, useState } from "react"
import { findTool, tools } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Monogram } from "@/ui/Logo"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { AppPreferences } from "../settings/AppPreferences"
import { settingsMessages } from "../settings/messages"
import { useTools } from "../tools/store"
import { ToolIcon } from "../tools/ToolIcon"
import { CategoriesEditor, CategoriesPlaceholder } from "./CategoriesEditor"
import { Choice, Choices } from "./Choices"
import { JsonActions, JsonTab } from "./JsonTab"
import { SettingsList, SettingsPlaceholder } from "./SettingsList"
import { isCategory, sharedCandidates } from "./scope"
import {
  isDefaultsView,
  isDirty,
  readLast,
  remember,
  type Shape,
  sourceOf,
  type Tab,
  type Target,
  useConfig,
} from "./store"

const configurable = tools.filter((t) => t.settings !== null)
const DEFAULTS = "\u0000defaults"
// First visit, before any list was seen: the messengers report 16 settings, the shared view 5 categories and 4 more.
const TOOL_SHAPE: Shape = { rows: 16, categories: 0, file: true }
const SHARED_SHAPE: Shape = { rows: 4, categories: 5, file: false }

type Switch = { kind: "tool"; id: string } | { kind: "shared" } | { kind: "target"; target: Target }

export function ConfigPage() {
  const sm = useMessages(settingsMessages)
  const st = useConfig()
  const installs = useTools((s) => s.installs)
  const [pending, setPending] = useState<Switch | null>(null)
  const dirty = isDirty(st)
  const latest = useTools((s) => s.latest)
  const shared = st.view === "shared"
  const tool = shared ? null : (configurable.find((t) => t.id === st.tool) ?? null)
  const src = sourceOf(st.tool)
  const candidates = sharedCandidates(installs, latest)

  const detected = Object.keys(installs).length > 0
  useEffect(() => {
    if (!detected) return
    const { installs: all, latest: newest } = useTools.getState()
    const installed = Object.entries(all)
      .filter(([, copies]) => copies.length > 0)
      .map(([id]) => id)
    useConfig.getState().start(installed, sharedCandidates(all, newest))
  }, [detected])

  const go = (s: Switch) =>
    s.kind === "tool"
      ? st.chooseTool(s.id)
      : s.kind === "shared"
        ? st.chooseShared(candidates)
        : st.chooseTarget(s.target)
  const request = (s: Switch) => (dirty ? setPending(s) : go(s))

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div>
        <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{sm.title}</h1>
        <p className="mt-3 max-w-[70ch] text-[0.95rem] text-ink-soft">{sm.intro}</p>
      </div>

      <AppPreferences />

      <div className="flex flex-col gap-4 border-t border-line pt-[1.5rem]">
        <div>
          <h2 className="text-[1.05rem] font-semibold">{sm.tools}</h2>
          <p className="mt-1 max-w-[70ch] text-[0.95rem] text-ink-soft">
            {sm.toolsIntro(<code className="font-mono">config set</code>)}
          </p>
        </div>
        <Choices label={sm.tool}>
          <Choice
            group="tool"
            checked={shared}
            disabled={candidates.length === 0}
            onSelect={() => request({ kind: "shared" })}
            title={candidates.length === 0 ? "Install Telegram, MAX or WhatsApp to change shared settings" : undefined}
          >
            <Monogram className="size-4" />
            WireCat (shared)
          </Choice>
          <span aria-hidden className="mx-1 h-5 w-px bg-line-strong" />
          {configurable.map((t) => {
            const missing = installs[t.id]?.length === 0
            return (
              <Choice
                key={t.id}
                group="tool"
                checked={!shared && st.tool === t.id}
                disabled={missing}
                onSelect={() => request({ kind: "tool", id: t.id })}
                title={missing ? `${t.name} is not installed` : undefined}
              >
                <ToolIcon id={t.id} className="size-4" />
                {t.name}
              </Choice>
            )
          })}
        </Choices>

        {tool && src?.perProfile && (
          <ProfilePicker
            toolName={tool.name}
            defaults={src.defaults}
            onSelect={(target) => request({ kind: "target", target })}
          />
        )}
        <ScopeLine />
      </div>

      {st.settings?.notice && <Banner tone="warn">{st.settings.notice}</Banner>}
      {st.error && (
        <ErrorNotice action={<ReportThis what="Reading settings" tool={st.tool} error={st.error} />}>
          {st.error}
        </ErrorNotice>
      )}

      {(tool || shared) && (st.target || st.profiles === undefined) && !st.error && (
        <Panel label={shared ? "Shared WireCat settings" : `${tool?.name} settings`} dirty={dirty} />
      )}

      <Dialog
        open={pending !== null}
        title="Discard unsaved JSON changes?"
        onClose={() => setPending(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setPending(null)} autoFocus>
              Keep editing
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const s = pending
                setPending(null)
                if (s) go(s)
              }}
            >
              Discard changes
            </Button>
          </>
        }
      >
        The JSON tab has changes that are not saved. Switching drops them; nothing is written to the file.
      </Dialog>
    </div>
  )
}

function ProfilePicker(props: { toolName: string; defaults: boolean; onSelect: (t: Target) => void }) {
  const { toolName, defaults, onSelect } = props
  const profiles = useConfig((s) => s.profiles)
  const error = useConfig((s) => s.profilesError)
  const toolId = useConfig((s) => s.tool)
  const target = useConfig((s) => s.target)
  const current = target === null ? null : (target.profile ?? DEFAULTS)

  if (profiles === undefined) {
    return (
      <Choices label="Profile">
        <Skeleton className="h-8 w-[5.5rem] rounded-[0.35rem]" label="Reading profiles" />
        <Skeleton className="h-8 w-[4.5rem] rounded-[0.35rem]" />
        {defaults && (
          <Choice group="profile" checked={false} disabled onSelect={() => undefined}>
            Defaults (all profiles)
          </Choice>
        )}
      </Choices>
    )
  }
  if (profiles !== null && profiles.length === 0 && !defaults) {
    return (
      <p className="text-[0.95rem] text-ink-soft">
        {error ? `${error}. ` : `There are no ${toolName} profiles yet. `}
        Set one up in Tools, under {toolName}, then come back here.
        {error && <ReportThis what={`Listing ${toolName} profiles`} tool={toolId} error={error} />}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <Choices label="Profile">
        {(profiles ?? []).map((p) => (
          <Choice
            key={p.name}
            group="profile"
            checked={current === p.name}
            onSelect={() => onSelect({ profile: p.name })}
          >
            <span className="font-mono">{p.name}</span>
          </Choice>
        ))}
        {defaults && (
          <Choice group="profile" checked={current === DEFAULTS} onSelect={() => onSelect({ profile: null })}>
            Defaults (all profiles)
          </Choice>
        )}
      </Choices>
      {profiles?.length === 0 && (
        <p className="text-[0.9rem] text-ink-dim">
          {error ?? `No ${toolName} profiles yet: set one up in Tools to change a profile's own settings.`}
        </p>
      )}
      {current === null && <p className="text-[0.9rem] text-ink-dim">Choose a profile to see its settings.</p>}
    </div>
  )
}

/** One line under the pickers saying what the panel below changes. */
function ScopeLine() {
  const view = useConfig((s) => s.view)
  const id = useConfig((s) => s.tool)
  const target = useConfig((s) => s.target)
  const installs = useTools((s) => s.installs)
  const profiles = useConfig((s) => s.profiles)
  const tool = id ? findTool(id) : undefined
  const src = sourceOf(id)
  let text: ReactNode = null
  if (view === "shared" && !tool) {
    text = (
      <>
        Settings every WireCat tool reads, not tied to one tool or profile: a change here applies to all of them.{" "}
        <Skeleton chars={22} />
      </>
    )
  } else if (view === "shared") {
    const version = id ? installs[id]?.[0]?.version : null
    text = (
      <>
        Settings every WireCat tool reads, not tied to one tool or profile: a change here applies to all of them.
        {tool && (
          <>
            {" "}
            Read through{" "}
            <span className="font-mono">
              {tool.bin}
              {version ? ` ${version}` : ""}
            </span>
            .
          </>
        )}
      </>
    )
  } else if (tool && src && !src.perProfile) {
    text = `${tool.name} keeps one settings file for every profile.`
  } else if (tool && target?.profile) {
    text = (
      <>
        Only {tool.name} profile <span className="font-mono">{target.profile}</span>. Settings shared by every tool are
        under WireCat (shared).
      </>
    )
  } else if (tool && target) {
    text = `What every ${tool.name} profile gets unless it sets its own. Settings shared by every tool are under WireCat (shared).`
  } else if (tool && profiles === undefined) {
    text = <Skeleton chars={96} />
  }
  return text && <p className="max-w-[80ch] text-[0.95rem] text-ink-soft">{text}</p>
}

function Panel({ label, dirty }: { label: string; dirty: boolean }) {
  const st = useConfig()
  const src = sourceOf(st.tool)
  const tabsId = useId()
  const shared = st.view === "shared"
  const all = st.settings?.rows ?? []
  const categories = shared ? all.filter(isCategory) : []
  const others = useMemo(
    () => (st.settings?.rows ?? []).filter((r) => !isCategory(r) && r.key !== "task_categories"),
    [st.settings],
  )
  const rows = useMemo(() => {
    const q = st.query.trim().toLowerCase()
    return q ? others.filter((r) => r.key.toLowerCase().includes(q)) : others
  }, [others, st.query])

  const shapeKey = shared ? "shared" : (st.tool ?? "")
  const loaded = st.settings
  const waiting = loaded === null
  // biome-ignore lint/correctness/useExhaustiveDependencies: read again only when a new placeholder is about to show
  const shape = useMemo(
    () => readLast().shapes?.[shapeKey] ?? (shared ? SHARED_SHAPE : TOOL_SHAPE),
    [shapeKey, shared, waiting],
  )
  useEffect(() => {
    if (!loaded) return
    const next = { rows: others.length, categories: categories.length, file: Boolean(loaded.configFile) }
    remember((l) => ({ ...l, shapes: { ...l.shapes, [shapeKey]: next } }))
  }, [loaded, others, categories.length, shapeKey])

  const where = shared
    ? "every tool and profile"
    : isDefaultsView(src, st.target)
      ? "the defaults every profile gets"
      : st.target?.profile
        ? `profile ${st.target.profile}`
        : "every profile"

  const tabs: { id: Tab; label: string }[] = [
    { id: "settings", label: "Settings" },
    { id: "json", label: "JSON" },
  ]

  return (
    <section
      aria-label={`${label} for ${where}`}
      className="overflow-hidden rounded-[0.2rem] border border-line-strong bg-app"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-line border-b px-[1.3rem]">
        <div role="tablist" aria-label="View" className="flex gap-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              id={`${tabsId}-${t.id}`}
              type="button"
              role="tab"
              aria-selected={st.tab === t.id}
              aria-controls={`${tabsId}-${t.id}-panel`}
              onClick={() => st.setTab(t.id)}
              className={cx(
                "relative h-[2.9rem] text-[0.95rem] transition-colors duration-150",
                st.tab === t.id ? "font-semibold text-ink" : "text-ink-soft hover:text-ink",
              )}
            >
              {t.label}
              {t.id === "json" && dirty && (
                <span className="ml-1.5 text-brand">
                  ●<span className="sr-only"> unsaved</span>
                </span>
              )}
              <span
                aria-hidden
                className={cx(
                  "absolute inset-x-0 bottom-0 h-[2px] rounded-t-full bg-brand transition-transform duration-150",
                  st.tab === t.id ? "scale-x-100" : "scale-x-0",
                )}
              />
            </button>
          ))}
        </div>
        {st.tab === "settings" ? (
          <label className="relative flex items-center py-2">
            <span className="sr-only">Search settings</span>
            <Search className="pointer-events-none absolute left-2.5 size-3.5 text-ink-dim" aria-hidden />
            <input
              type="search"
              value={st.query}
              onChange={(e) => st.setQuery(e.target.value)}
              placeholder="Search settings"
              className="h-8 w-[15rem] rounded-[0.35rem] border border-line-strong bg-app pr-2.5 pl-8 text-[0.95rem] text-ink placeholder:text-ink-dim focus-visible:border-brand"
            />
          </label>
        ) : (
          <JsonActions dirty={dirty} />
        )}
      </div>

      <div id={`${tabsId}-${st.tab}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${st.tab}`}>
        {st.settings === null && st.tab === "settings" ? (
          shared ? (
            <>
              <CategoriesPlaceholder count={shape.categories} />
              {shape.rows > 0 && <OthersHeading />}
              <SettingsPlaceholder count={shape.rows} />
            </>
          ) : (
            <SettingsPlaceholder count={shape.rows} label="Reading settings" />
          )
        ) : st.tab === "settings" ? (
          <>
            {dirty && (
              <p className="border-line border-b bg-warn/10 px-[1.3rem] py-2.5 text-[0.95rem]">
                The JSON tab has unsaved changes. Save or revert them there before changing settings here.
              </p>
            )}
            {shared && (
              <CategoriesEditor
                rows={categories}
                unreadable={all.find((r) => r.key === "task_categories")?.from ?? null}
                query={st.query}
                disabled={dirty}
              />
            )}
            {shared && rows.length > 0 && <OthersHeading />}
            {(!shared || rows.length > 0) && <SettingsList rows={rows} disabled={dirty} />}
          </>
        ) : (
          <JsonTab />
        )}
      </div>
      {(st.settings ? st.settings.configFile : shape.file) && (
        <p className="border-line border-t px-[1.3rem] py-2.5 text-[0.9rem] text-ink-dim">
          File: <span className="selectable font-mono">{st.settings?.configFile ?? <Skeleton chars={28} />}</span>
        </p>
      )}
    </section>
  )
}

function OthersHeading() {
  return (
    <h3 className="border-line border-b px-[1.3rem] pt-4 pb-2.5 text-[1.08rem] font-semibold leading-tight">
      Other shared settings
    </h3>
  )
}

function Banner({ tone, children }: { tone: "warn" | "bad"; children: ReactNode }) {
  return (
    <p
      role={tone === "bad" ? "alert" : "status"}
      className={cx(
        "rounded-[0.2rem] border px-4 py-3 text-[0.95rem]",
        tone === "bad" ? "border-bad/40 bg-bad/10" : "border-warn/40 bg-warn/10",
      )}
    >
      {children}
    </p>
  )
}
