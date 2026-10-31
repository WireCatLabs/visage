// Design prototype for the Memory page plan (docs/dev/plans/2026-10-31-memory-page.md). Made-up data, no platform
// calls. `?memory=<state>` picks what it shows: waiting (default), correct, forget, kept, empty, missing, old, loading,
// error.
import { Brain, ExternalLink, FileText, MessageSquareQuote, Pencil, RefreshCw, Trash2, Video } from "lucide-react"
import { type ReactNode, useId, useState } from "react"
import { ToolIcon } from "@/features/tools/ToolIcon"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Pill } from "@/ui/Pill"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"

type Status = "proposed" | "confirmed" | "stale" | "superseded" | "accepted" | "reversed"
type Source = { kind: "tg" | "note" | "meeting" | "email"; who: string; at: string; text: string }
type Entry = {
  id: string
  type: "memory" | "fact"
  kind: string
  scope: "work" | "personal"
  text: string
  about: string
  by: string
  byAgent: boolean
  at: string
  day: string
  status: Status
  sources: Source[]
}

const ENTRIES: Entry[] = [
  {
    id: "memory:41",
    type: "memory",
    kind: "Preference",
    scope: "work",
    text: "Kai Sample prefers calls on Friday afternoons and asks for the agenda the evening before.",
    about: "Kai Sample",
    by: "claude-code",
    byAgent: true,
    at: "06:02",
    day: "Today",
    status: "proposed",
    sources: [
      {
        kind: "tg",
        who: "Kai Sample",
        at: "27 Oct 18:40",
        text: "Friday after 3 works best for me, send the points the night before?",
      },
      { kind: "tg", who: "Kai Sample", at: "13 Oct 09:12", text: "Can we move it to Friday? Mondays are packed." },
      { kind: "meeting", who: "Harbour weekly", at: "24 Oct 15:00", text: "…as Kai said, Fridays, and the agenda first." },
    ],
  },
  {
    id: "fact:17",
    type: "fact",
    kind: "Decision",
    scope: "work",
    text: "Harbour launch moves to 2 March; the pilot with two clinics stays in February.",
    about: "Project Harbour",
    by: "hermes",
    byAgent: true,
    at: "05:47",
    day: "Today",
    status: "proposed",
    sources: [],
  },
  {
    id: "memory:40",
    type: "memory",
    kind: "Summary",
    scope: "personal",
    text: "Ana Ruiz is moving to Valencia in December and is looking for a flat near the old town.",
    about: "Ana Ruiz",
    by: "claude-code",
    byAgent: true,
    at: "21:15",
    day: "Yesterday",
    status: "proposed",
    sources: [],
  },
  {
    id: "memory:38",
    type: "memory",
    kind: "Preference",
    scope: "personal",
    text: "You want reminders in the morning, never after 21:00.",
    about: "You",
    by: "You",
    byAgent: false,
    at: "11:30",
    day: "28 Oct",
    status: "confirmed",
    sources: [],
  },
  {
    id: "fact:12",
    type: "fact",
    kind: "Promise",
    scope: "work",
    text: "You promised Kai the pricing table by 4 November.",
    about: "Kai Sample",
    by: "claude-code",
    byAgent: true,
    at: "10:05",
    day: "28 Oct",
    status: "accepted",
    sources: [],
  },
  {
    id: "memory:31",
    type: "memory",
    kind: "Preference",
    scope: "work",
    text: "Kai Sample prefers Monday morning calls.",
    about: "Kai Sample",
    by: "claude-code",
    byAgent: true,
    at: "16:20",
    day: "12 Oct",
    status: "stale",
    sources: [],
  },
]

const tone: Record<Status, LampTone> = {
  proposed: "warn",
  confirmed: "ok",
  accepted: "ok",
  stale: "idle",
  superseded: "idle",
  reversed: "idle",
}
const said: Record<Status, string> = {
  proposed: "Waits for you",
  confirmed: "Confirmed",
  accepted: "Accepted",
  stale: "No longer holds",
  superseded: "Replaced",
  reversed: "Reversed",
}

type Filter = "waiting" | "kept" | "past" | "all"
const inFilter = (f: Filter, s: Status) =>
  f === "all" ||
  (f === "waiting" && s === "proposed") ||
  (f === "kept" && (s === "confirmed" || s === "accepted")) ||
  (f === "past" && (s === "stale" || s === "superseded" || s === "reversed"))

function stateParam(): string {
  return new URLSearchParams(window.location.search).get("memory") ?? "waiting"
}

export function MemoryPage() {
  const state = stateParam()
  const [filter, setFilter] = useState<Filter>(state === "kept" ? "kept" : "waiting")
  const [open, setOpen] = useState<string | null>(state === "kept" ? null : "memory:41")
  const [about, setAbout] = useState("everyone")
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [forget, setForget] = useState(state === "forget")
  const correcting = state === "correct"

  const status = (e: Entry): Status => (confirmed.has(e.id) ? (e.type === "fact" ? "accepted" : "confirmed") : e.status)
  // A row confirmed under "Waiting" stays where it is, green, until the filter changes (rule 9).
  const shown = ENTRIES.filter((e) => inFilter(filter, e.status) || confirmed.has(e.id))
  const days = [...new Set(shown.map((e) => e.day))]
  const count = (f: Filter) => ENTRIES.filter((e) => inFilter(f, e.status)).length

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">Memory</h1>
          <p className="mt-3 max-w-[72ch] text-[0.95rem] text-ink-soft">
            What your AI agents concluded about you and the people you talk to, and what they noted as said, decided or
            promised. Each entry shows the messages and notes it rests on. Nothing an agent writes counts until you
            confirm it.{" "}
            <a className="inline-flex items-baseline gap-[0.2rem] font-medium text-brand hover:text-brand-hover" href="#x">
              How memory works
              <ExternalLink className="size-[0.8rem] self-center" aria-hidden />
            </a>
          </p>
        </div>
        {state !== "missing" && (
          <Button variant="ghost" size="sm" icon={<RefreshCw className="size-4" aria-hidden />}>
            Read again
          </Button>
        )}
      </div>

      {state === "missing" ? (
        <Notice>
          <p>
            Memory is kept by <b className="font-semibold text-ink">Memo</b>, which is not installed. Install it on the
            Tools page; your agents can then save what they learn, and you review it here.
          </p>
          <Button size="sm">Go to Tools</Button>
        </Notice>
      ) : state === "old" ? (
        <Notice>
          <p>
            Memo <span className="font-mono">0.124.0</span> can list memories but cannot correct or forget one. Update
            Memo to <span className="font-mono">0.125.0</span> or newer to use this page.
          </p>
          <Button variant="primary" size="sm">
            Update Memo
          </Button>
        </Notice>
      ) : state === "error" ? (
        <ErrorNotice detail="memo memories list: the store is locked by another sync (store.busy)">
          Could not read memory. Another Memo sync holds the store; try again in a minute.
        </ErrorNotice>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-[0.7rem]">
            <Tabs value={filter} onChange={setFilter} count={count} />
            <Picker label="About">
              {(id) => (
                <Select
                  id={id}
                  value={about}
                  onChange={(v) => v && setAbout(v)}
                  options={[
                    { value: "everyone", label: "Everyone" },
                    { value: "me", label: "You" },
                    { value: "kai", label: "Kai Sample" },
                    { value: "ana", label: "Ana Ruiz" },
                    { value: "hrb", label: "Project Harbour" },
                  ]}
                  className="min-w-[11rem]"
                />
              )}
            </Picker>
            <Picker label="Written by">
              {(id) => (
                <Select
                  id={id}
                  value="anyone"
                  onChange={() => {}}
                  options={[
                    { value: "anyone", label: "Anyone" },
                    { value: "you", label: "You" },
                    { value: "claude-code", label: "claude-code" },
                    { value: "hermes", label: "hermes" },
                  ]}
                  className="min-w-[10rem]"
                />
              )}
            </Picker>
          </div>

          {state === "loading" ? (
            <div className="rounded-[0.2rem] border border-line-strong bg-app">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex h-[4.5rem] items-center gap-[0.9rem] border-line px-[1.3rem] not-first:border-t">
                  <Skeleton className="size-[1.4rem] rounded-full" />
                  <Skeleton className="h-[1rem] w-[60%]" />
                </div>
              ))}
            </div>
          ) : state === "empty" ? (
            <div className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.4rem] text-[0.95rem] text-ink-soft">
              <p className="font-medium text-ink">No memories yet.</p>
              <p className="mt-1 max-w-[70ch]">
                An agent connected to Memo saves what it learns here, for example "Kai prefers Friday calls", with the
                messages that show it. Ask your agent to remember something, or connect one on the Agents page.
              </p>
            </div>
          ) : (
            <div className="rounded-[0.2rem] border border-line-strong bg-app">
              {days.map((day) => (
                <section key={day} aria-label={day}>
                  <h2 className="border-line px-[1.3rem] pt-[0.9rem] pb-[0.3rem] text-[0.9rem] font-medium text-ink-dim [section+section>&]:border-t">
                    {day}
                  </h2>
                  {shown
                    .filter((e) => e.day === day)
                    .map((e) => (
                      <Row
                        key={e.id}
                        e={e}
                        status={status(e)}
                        open={open === e.id}
                        onToggle={() => setOpen(open === e.id ? null : e.id)}
                        onConfirm={() => setConfirmed(new Set([...confirmed, e.id]))}
                        onForget={() => setForget(true)}
                        correcting={correcting && e.id === "memory:41"}
                      />
                    ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog
        open={forget}
        title="Forget this memory?"
        onClose={() => setForget(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setForget(false)}>
              Keep it
            </Button>
            <Button variant="danger" icon={<Trash2 className="size-4" aria-hidden />}>
              Forget
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-[0.95rem] text-ink-soft">
          <p>Memo erases this from its store and its search. Agents stop finding it.</p>
          <ul className="flex flex-col gap-1 rounded-[0.45rem] border border-line bg-app-2 px-4 py-3">
            <li className="text-ink">
              The memory <span className="font-mono text-[0.85rem]">memory:41</span>: "Kai Sample prefers calls on Friday
              afternoons…"
            </li>
            <li>Its 3 links to the messages and the meeting it rests on</li>
            <li>Its entry in Memo's search</li>
          </ul>
          <p>
            The messages, notes and meetings themselves stay. Backups made before today still hold it. To keep a record
            that it was wrong, use Correct instead.
          </p>
        </div>
      </Dialog>
    </div>
  )
}

function Row(props: {
  e: Entry
  status: Status
  open: boolean
  onToggle: () => void
  onConfirm: () => void
  onForget: () => void
  correcting: boolean
}) {
  const { e, status, open, onToggle, onConfirm } = props
  const panel = useId()
  const Icon = e.type === "memory" ? Brain : MessageSquareQuote
  return (
    <div className="border-line border-t">
      <div className="group grid min-h-[4.5rem] grid-cols-[auto_auto_minmax(0,1fr)_auto_7.6rem] items-center gap-[0.9rem] px-[1.3rem] py-[0.8rem] xl:gap-[1.2rem]">
        <Lamp tone={tone[status]} label={said[status]} />
        <Icon className="size-[1.6rem] text-ink-soft" strokeWidth={1.6} aria-hidden />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          onClick={onToggle}
          className="min-w-0 cursor-pointer text-left"
        >
          <span className="line-clamp-2 text-[1rem] font-medium leading-snug group-hover:text-brand">{e.text}</span>
          <span className="mt-[0.2rem] flex flex-wrap items-center gap-x-[0.5rem] text-[0.9rem] text-ink-soft">
            <span>{e.kind}</span>
            <span aria-hidden>·</span>
            <span>about {e.about}</span>
            <span aria-hidden>·</span>
            <span>
              by <span className={cx(e.byAgent && "font-mono text-[0.85rem]")}>{e.by}</span>
            </span>
            {e.scope === "work" ? null : <Pill>personal</Pill>}
          </span>
        </button>
        <span className="font-mono text-[0.95rem] tabular-nums text-ink-soft">{e.at}</span>
        <span className="flex justify-end">
          {status === "proposed" ? (
            <Button size="md" className="min-w-[7.6rem]" onClick={onConfirm}>
              Confirm
            </Button>
          ) : (
            <span className={cx("text-[0.9rem]", status === "confirmed" || status === "accepted" ? "text-ink" : "text-ink-dim")}>
              {said[status]}
            </span>
          )}
        </span>
      </div>
      <Collapse open={open} id={panel}>
        <Details {...props} />
      </Collapse>
    </div>
  )
}

const sourceIcon = (k: Source["kind"]) =>
  k === "tg" ? (
    <ToolIcon id="tg" className="size-[1.1rem]" />
  ) : k === "meeting" ? (
    <Video className="size-[1.1rem]" aria-hidden />
  ) : (
    <FileText className="size-[1.1rem]" aria-hidden />
  )

function Details({ e, status, onForget, correcting }: Parameters<typeof Row>[0]) {
  return (
    <div className="grid gap-[1.6rem] border-line border-t bg-app-2/60 px-[1.3rem] py-[1.4rem] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-[0.6rem]">
        <h3 className="text-[0.9rem] font-medium text-ink-dim">What it rests on · {e.sources.length} sources</h3>
        <ul className="flex flex-col rounded-[0.45rem] border border-line bg-app">
          {e.sources.map((s) => (
            <li key={s.at} className="flex gap-[0.8rem] border-line px-[0.9rem] py-[0.7rem] not-first:border-t">
              <span className="mt-[0.15rem] text-ink-soft">{sourceIcon(s.kind)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-[0.9rem] font-medium">{s.who}</span>
                  <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{s.at}</span>
                </span>
                <span className="selectable mt-[0.1rem] block text-[0.95rem] text-ink-soft">"{s.text}"</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[0.9rem] text-ink-dim">
          Open a source in its chat or note with{" "}
          <a href="#x" className="font-medium text-brand hover:text-brand-hover">
            Search for Kai Sample
          </a>
          .
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-[1.1rem]">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-[0.45rem] text-[0.95rem]">
          <dt className="text-ink-dim">Written by</dt>
          <dd>
            <span className="font-mono text-[0.9rem]">{e.by}</span>{" "}
            <span className="text-ink-soft">through Memo's MCP server</span>
          </dd>
          <dt className="text-ink-dim">Saved</dt>
          <dd className="font-mono text-[0.9rem] tabular-nums">31 Oct 2026, {e.at}</dd>
          <dt className="text-ink-dim">Kind</dt>
          <dd>
            {e.kind}, {e.scope}
          </dd>
          <dt className="text-ink-dim">State</dt>
          <dd className="flex items-center gap-2">
            <Lamp tone={tone[status]} size="sm" />
            {status === "proposed" ? "Waits for you. Agents see it marked as unconfirmed." : said[status]}
          </dd>
        </dl>

        {correcting ? (
          <div className="flex flex-col gap-[0.5rem]">
            <label htmlFor="fix" className="text-[0.9rem] font-medium text-ink-dim">
              What is true instead
            </label>
            <textarea
              id="fix"
              rows={3}
              defaultValue="Kai Sample prefers calls on Friday mornings and asks for the agenda the evening before."
              className="selectable rounded-[0.35rem] border border-line-strong bg-app px-[0.625rem] py-[0.5rem] text-[0.95rem] text-ink outline-none focus:border-brand"
            />
            <p className="text-[0.9rem] text-ink-dim">
              Saved as yours, confirmed. The agent's version stays in the past entries as replaced.
            </p>
            <div className="flex gap-2">
              <Button size="sm">Save correction</Button>
              <Button size="sm" variant="ghost">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" icon={<Pencil className="size-4" aria-hidden />}>
              Correct
            </Button>
            {(status === "confirmed" || status === "accepted") && (
              <Button size="sm" variant="ghost">
                No longer true
              </Button>
            )}
            <Button size="sm" variant="danger" icon={<Trash2 className="size-4" aria-hidden />} onClick={onForget}>
              Forget…
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Tabs({ value, onChange, count }: { value: Filter; onChange: (f: Filter) => void; count: (f: Filter) => number }) {
  const name = useId()
  const items: [Filter, string][] = [
    ["waiting", "Waiting for you"],
    ["kept", "Kept"],
    ["past", "No longer hold"],
    ["all", "All"],
  ]
  return (
    <fieldset className="inline-flex h-[2.8rem] items-center rounded-[0.45rem] border-0 bg-app-3 p-[3px]">
      <legend className="sr-only">Show</legend>
      {items.map(([id, label]) => (
        <label key={id} className="relative h-full">
          <input
            type="radio"
            name={name}
            checked={id === value}
            onChange={() => onChange(id)}
            className="peer sr-only"
          />
          <span className="flex h-full cursor-pointer items-center gap-[0.45rem] rounded-[0.35rem] px-[0.8rem] text-[0.95rem] text-ink-soft transition-colors duration-150 hover:text-ink peer-checked:bg-app peer-checked:text-ink peer-checked:shadow-panel peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
            {id === "waiting" && <Lamp tone="warn" size="sm" />}
            {label}
            <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{count(id)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

function Picker({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <span className="flex items-center gap-[0.5rem]">
      <label htmlFor={id} className="text-[0.95rem] text-ink-soft">
        {label}
      </label>
      {children(id)}
    </span>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.1rem] text-[0.95rem] text-ink-soft">
      {children}
    </div>
  )
}
