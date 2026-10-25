import { AlignLeft, Check, LoaderCircle, Search, Undo2, X } from "lucide-react"
import { type ReactNode, useId, useMemo, useState } from "react"
import { tools } from "@/domain/catalog"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { Skeleton } from "@/ui/Skeleton"
import { useTools } from "../tools/store"
import { ToolIcon } from "../tools/ToolIcon"
import { lineOf } from "./diff"
import { JsonEditor } from "./JsonEditor"
import { SettingsList } from "./SettingsList"
import { documentText, isDefaultsView, isDirty, type Step, sourceOf, type Tab, type Target, useConfig } from "./store"

const configurable = tools.filter((t) => t.settings !== null)
const DEFAULTS = "\u0000defaults"

type Switch = { kind: "tool"; id: string } | { kind: "target"; target: Target }

export function ConfigPage() {
  const st = useConfig()
  const installs = useTools((s) => s.installs)
  const [pending, setPending] = useState<Switch | null>(null)
  const dirty = isDirty(st)
  const tool = configurable.find((t) => t.id === st.tool) ?? null
  const src = sourceOf(st.tool)

  const go = (s: Switch) => (s.kind === "tool" ? st.chooseTool(s.id) : st.chooseTarget(s.target))
  const request = (s: Switch) => (dirty ? setPending(s) : go(s))

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div>
        <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">Config</h1>
        <p className="mt-3 max-w-[70ch] text-[0.95rem] text-ink-soft">
          Each tool's settings, read from the tool and saved through its own{" "}
          <code className="font-mono">config set</code>, so every value is checked by the tool before it is written.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Choices label="Tool">
          {configurable.map((t) => {
            const missing = installs[t.id]?.length === 0
            return (
              <Choice
                key={t.id}
                group="tool"
                checked={st.tool === t.id}
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
        {tool && src && !src.perProfile && (
          <p className="text-[0.95rem] text-ink-soft">{tool.name} keeps one settings file for every profile.</p>
        )}
      </div>

      {st.settings?.notice && <Banner tone="warn">{st.settings.notice}</Banner>}
      {st.error && (
        <Banner tone="bad">
          <span className="selectable">{st.error}</span>
        </Banner>
      )}

      {tool && st.target && !st.error && <Panel toolName={tool.name} dirty={dirty} />}

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
  const target = useConfig((s) => s.target)
  const current = target === null ? null : (target.profile ?? DEFAULTS)

  if (profiles === undefined) return <Skeleton className="h-8 w-[22rem]" label="Reading profiles" />
  if (profiles !== null && profiles.length === 0 && !defaults) {
    return (
      <p className="text-[0.95rem] text-ink-soft">
        {error ? `${error}. ` : `There are no ${toolName} profiles yet. `}
        Set one up in Tools, under {toolName}, then come back here.
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
        <p className="text-[0.85rem] text-ink-dim">
          {error ?? `No ${toolName} profiles yet: set one up in Tools to change a profile's own settings.`}
        </p>
      )}
      {current === null && <p className="text-[0.85rem] text-ink-dim">Choose a profile to see its settings.</p>}
    </div>
  )
}

function Panel({ toolName, dirty }: { toolName: string; dirty: boolean }) {
  const st = useConfig()
  const src = sourceOf(st.tool)
  const tabsId = useId()
  const rows = useMemo(() => {
    const q = st.query.trim().toLowerCase()
    const all = st.settings?.rows ?? []
    return q ? all.filter((r) => r.key.toLowerCase().includes(q)) : all
  }, [st.settings, st.query])

  const where = isDefaultsView(src, st.target)
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
      aria-label={`${toolName} settings for ${where}`}
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
        {st.settings === null ? (
          <div className="flex flex-col gap-3 px-[1.3rem] py-5">
            <Skeleton className="h-8 w-full" label="Reading settings" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : st.tab === "settings" ? (
          <>
            {dirty && (
              <p className="border-line border-b bg-warn/10 px-[1.3rem] py-2.5 text-[0.95rem]">
                The JSON tab has unsaved changes. Save or revert them there before changing settings here.
              </p>
            )}
            <SettingsList rows={rows} disabled={dirty} />
          </>
        ) : (
          <JsonTab />
        )}
      </div>
      {st.settings?.configFile && (
        <p className="border-line border-t px-[1.3rem] py-2.5 text-[0.85rem] text-ink-dim">
          File: <span className="selectable font-mono">{st.settings.configFile}</span>
        </p>
      )}
    </section>
  )
}

function JsonActions({ dirty }: { dirty: boolean }) {
  const st = useConfig()
  return (
    <div className="flex items-center gap-2 py-2">
      <Button
        size="sm"
        variant="ghost"
        onClick={st.formatDraft}
        disabled={st.draft === null || st.jsonError !== null || st.saving}
        icon={<AlignLeft className="size-3.5" aria-hidden />}
      >
        Format
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={st.revert}
        disabled={st.draft === null || st.saving}
        icon={<Undo2 className="size-3.5" aria-hidden />}
      >
        Revert
      </Button>
      <Button
        size="sm"
        variant="primary"
        onClick={st.saveDraft}
        disabled={!dirty || st.saving || st.jsonError !== null}
      >
        {st.saving ? "Saving…" : "Save"}
      </Button>
    </div>
  )
}

function JsonTab() {
  const st = useConfig()
  const text = st.draft ?? documentText(st.settings)
  const marks = useMemo(() => {
    const m = new Map<number, string>()
    if (st.jsonError) m.set(st.jsonError.line, st.jsonError.message)
    for (const p of st.problems) {
      const line = lineOf(text, p.key)
      if (line) m.set(line, p.message)
    }
    return m
  }, [st.jsonError, st.problems, text])

  return (
    <div>
      <JsonEditor
        label="Settings as JSON"
        value={text}
        onChange={st.edit}
        onSave={() => {
          if (!st.saving) st.saveDraft()
        }}
        marks={marks}
        readOnly={st.saving}
      />
      <div aria-live="polite" className="border-line border-t empty:hidden">
        {st.jsonError && (
          <Message tone="bad" where={`Line ${st.jsonError.line}`}>
            {st.jsonError.message}
          </Message>
        )}
        {st.problems.map((p) => (
          <Message key={p.key} tone="bad" where={p.key}>
            {p.message}
          </Message>
        ))}
        {st.steps.length > 0 && <Progress steps={st.steps} />}
      </div>
      <p className="border-line border-t px-[1.3rem] py-2.5 text-[0.85rem] text-ink-dim">
        Saving runs one <span className="font-mono">config set</span> or <span className="font-mono">config unset</span>{" "}
        per changed setting and stops at the first one the tool refuses. Masked values (•••) and locked settings cannot
        be changed here.
      </p>
    </div>
  )
}

function Message({ tone, where, children }: { tone: "bad"; where: string; children: ReactNode }) {
  return (
    <p
      role={tone === "bad" ? "alert" : undefined}
      className="selectable flex gap-3 px-[1.3rem] py-2 text-[0.95rem] text-bad"
    >
      <span className="shrink-0 font-mono">{where}</span>
      <span className="min-w-0">{children}</span>
    </p>
  )
}

const STEP_LABEL: Record<Step["state"], string> = {
  waiting: "Waiting",
  running: "Saving",
  done: "Saved",
  failed: "Refused",
  skipped: "Not tried",
}

function Progress({ steps }: { steps: Step[] }) {
  return (
    <ol aria-label="Save progress" className="flex flex-col gap-1 px-[1.3rem] py-3">
      {steps.map((s) => (
        <li key={`${s.op.kind}-${s.op.key}`} className="flex min-w-0 items-center gap-2.5 text-[0.85rem]">
          <StepIcon state={s.state} />
          <span className="w-[4.6rem] shrink-0 text-ink-soft">{STEP_LABEL[s.state]}</span>
          <span className="selectable truncate font-mono text-ink">
            {s.op.kind === "set" ? `set ${s.op.key} ${s.op.value}` : `unset ${s.op.key}`}
            {s.op.defaults && " --defaults"}
          </span>
        </li>
      ))}
    </ol>
  )
}

function StepIcon({ state }: { state: Step["state"] }) {
  if (state === "done") return <Check className="size-4 shrink-0 text-ok" aria-hidden />
  if (state === "failed") return <X className="size-4 shrink-0 text-bad" aria-hidden />
  if (state === "running") return <LoaderCircle className="size-4 shrink-0 animate-spin text-brand" aria-hidden />
  return <span aria-hidden className="mx-[0.3rem] size-[0.4rem] shrink-0 rounded-full bg-idle" />
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

function Choices({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2 border-0 p-0">
      <legend className="float-left mr-2 w-[4.2rem] text-[0.85rem] font-medium text-ink-dim">{label}</legend>
      {children}
    </fieldset>
  )
}

function Choice(props: {
  group: string
  checked: boolean
  disabled?: boolean
  title?: string | undefined
  onSelect: () => void
  children: ReactNode
}) {
  const { group, checked, disabled, title, onSelect, children } = props
  return (
    <label title={title} className={cx("relative", disabled && "opacity-45")}>
      <input
        type="radio"
        name={`config-${group}`}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span
        className={cx(
          "inline-flex h-8 cursor-pointer items-center gap-2 rounded-[0.35rem] border px-3 text-[0.95rem] transition-colors duration-150",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
          checked
            ? "border-brand bg-brand-soft font-medium text-ink"
            : "border-line-strong bg-app text-ink-soft hover:border-ink-dim/60 hover:text-ink",
        )}
      >
        {children}
      </span>
    </label>
  )
}
