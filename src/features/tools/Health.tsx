import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  QrCode,
  RefreshCw,
  Stethoscope,
  Terminal,
  XCircle,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  type CatalogTool,
  doctorNeedsProfile,
  isValidProfile,
  setupCommand,
  signsInHere,
  syncNeedsProfile,
  usesProfiles,
} from "@/domain/catalog"
import { type ConfigPlace, type Finding, summarize } from "@/domain/doctor"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { Diagnosis, Profile } from "@/platform/schemas"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { useSignIn } from "../signin/store"
import { type ToolsText, toolsMessages } from "./messages"
import { SyncControl } from "./Sync"
import { toolText } from "./tool-text"

type Words = ToolsText["health"]

type Check = { profile: string | null; state: "running" } | { profile: string | null; state: "done"; result: Diagnosis }

export function Health({ tool }: { tool: CatalogTool }) {
  const { profiles, error: profilesError, loading: reloading, reload } = useProfiles(tool.id)
  const [check, setCheck] = useState<Check | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)

  const run = useCallback(
    async (profile: string | null) => {
      setCheck({ profile, state: "running" })
      setCheckError(null)
      try {
        setCheck({ profile, state: "done", result: await platform.diagnose(tool.id, profile) })
      } catch (e) {
        setCheck(null)
        setCheckError(String(e))
      }
    },
    [tool.id],
  )

  const running = check?.state === "running"
  const t = useMessages(toolsMessages)
  const m = t.health
  const note = toolText(t, tool).syncNote

  return (
    <section aria-label={m.section(tool.name)} className="flex min-w-0 flex-col gap-3">
      <h4 className="text-[1.02rem] font-semibold text-ink">{usesProfiles(tool) ? m.accounts : m.health}</h4>

      {!usesProfiles(tool) || !doctorNeedsProfile(tool) ? (
        <div>
          <Button
            size="sm"
            onClick={() => run(null)}
            disabled={running}
            icon={<Stethoscope className="size-4" aria-hidden />}
          >
            {running ? m.checking : m.checkHealth}
          </Button>
        </div>
      ) : null}

      {usesProfiles(tool) && (
        <ProfileList
          tool={tool}
          profiles={profiles}
          error={profilesError}
          busy={running}
          activeProfile={check?.profile ?? null}
          onCheck={doctorNeedsProfile(tool) ? run : undefined}
          onReload={reload}
          reloading={reloading}
        />
      )}

      {tool.sync && !syncNeedsProfile(tool) && tool.sync.run && <SyncControl tool={tool} profile={null} />}
      {note && <p className="text-[0.875rem] text-ink-soft">{note}</p>}

      {checkError && (
        <ErrorNotice inline action={<ReportThis what={`Checking ${tool.name}`} tool={tool.id} error={checkError} />}>
          {checkError}
        </ErrorNotice>
      )}
      {check && <Result check={check} toolId={tool.id} m={m} />}
    </section>
  )
}

function ProfileList(props: {
  tool: CatalogTool
  profiles: Profile[] | null | undefined
  error: string | null
  busy: boolean
  activeProfile: string | null
  onCheck: ((profile: string) => void) | undefined
  onReload: () => void
  reloading: boolean
}) {
  const { tool, profiles, error, busy, activeProfile, onCheck, onReload, reloading } = props
  const m = useMessages(toolsMessages).health
  if (error) {
    return (
      <ErrorNotice inline action={<ReportThis what={`Listing ${tool.name} profiles`} tool={tool.id} error={error} />}>
        {m.profilesFailed(error)}
      </ErrorNotice>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {profiles === undefined ? (
        <ul className="divide-y divide-line overflow-hidden rounded-[0.45rem] border border-line bg-app">
          {[0, 1].map((n) => (
            // A profile row with its sync line is taller, so the placeholder takes that height.
            <li
              key={n}
              className={cx(
                "flex box-content flex-col justify-center gap-[1.4rem] px-3 py-2",
                syncNeedsProfile(tool) ? "h-[4.625rem]" : "h-8",
              )}
            >
              <Skeleton className="h-4 w-28" label={n === 0 ? m.loadingProfiles : ""} />
              {syncNeedsProfile(tool) && <Skeleton className="h-4 w-44" />}
            </li>
          ))}
        </ul>
      ) : profiles && profiles.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-[0.45rem] border border-line bg-app">
          {profiles.map((p) => (
            <li key={p.name} className="flex flex-col gap-1.5 px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                {p.signedIn === true && <Pill tone="brand">{m.signedIn}</Pill>}
                {p.signedIn === false && <Pill>{m.notSignedIn}</Pill>}
                {onCheck && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => onCheck(p.name)}>
                    {busy && activeProfile === p.name ? m.checking : m.check}
                  </Button>
                )}
                {tool.setup && p.signedIn !== true && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      signsInHere(tool)
                        ? useSignIn.getState().start(tool.id, p.name, onReload)
                        : platform.openSetup(tool.id, p.name)
                    }
                  >
                    {p.signedIn === false ? m.signIn : m.setUp}
                  </Button>
                )}
              </div>
              {syncNeedsProfile(tool) && p.signedIn !== false && <SyncControl tool={tool} profile={p.name} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.95rem] font-medium text-ink">
          {tool.setup ? (signsInHere(tool) ? m.noAccountHere(tool.name) : m.noAccountTerminal(tool.name)) : m.noAccount}
        </p>
      )}
      {tool.setup && <NewProfile tool={tool} onCheck={onReload} checking={reloading} />}
      {!tool.setup && <ManualSetup tool={tool} onCheck={onReload} checking={reloading} />}
    </div>
  )
}

/** Re-reading is how the app learns that a sign-in finished: the terminal reports nothing back. */
export function useProfiles(id: string) {
  const [profiles, setProfiles] = useState<Profile[] | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const latest = useRef(0)

  const reload = useCallback(() => {
    const call = ++latest.current
    setLoading(true)
    platform
      .listProfiles(id)
      .then(
        (p) => {
          if (call !== latest.current) return
          setProfiles(p)
          setError(null)
        },
        (e) => call === latest.current && setError(String(e)),
      )
      .finally(() => call === latest.current && setLoading(false))
  }, [id])

  useEffect(() => {
    reload()
    return () => {
      latest.current++
    }
  }, [reload])

  return { profiles, error, loading, reload }
}

export function FinishInTerminal({ onCheck, checking }: { onCheck: () => void; checking: boolean }) {
  const m = useMessages(toolsMessages).health
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[0.35rem] bg-brand-soft/60 px-3 py-2">
      <p role="status" className="min-w-0 flex-1 text-[0.9rem] text-ink">
        {m.finishInTerminal}
      </p>
      <Button
        size="sm"
        variant="secondary"
        onClick={onCheck}
        disabled={checking}
        icon={<RefreshCw className={cx("size-4", checking && "animate-spin")} aria-hidden />}
      >
        {checking ? m.checking : m.checkSignIn}
      </Button>
    </div>
  )
}

/** For a tool whose CLI has no interactive sign-in yet: the command to run, which the app never runs itself. */
export function ManualSetup(props: { tool: CatalogTool; onCheck: () => void; checking: boolean }) {
  const { tool, onCheck, checking } = props
  const signIn = tool.signIn
  const m = useMessages(toolsMessages).health
  if (!signIn?.command) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[0.9rem] leading-snug text-ink-soft">
        {m.manual}{" "}
        {signIn.guide && (
          <a
            href={signIn.guide}
            onClick={(e) => {
              e.preventDefault()
              if (signIn.guide) platform.openUrl(signIn.guide)
            }}
            className="font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
          >
            {m.howToSetUp}
          </a>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <CopyField value={signIn.command} label={m.copyAddAccount(tool.name)} />
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCheck}
          disabled={checking}
          icon={<RefreshCw className={cx("size-4", checking && "animate-spin")} aria-hidden />}
        >
          {checking ? m.checking : m.checkAgain}
        </Button>
      </div>
    </div>
  )
}

export function NewProfile(props: { tool: CatalogTool; onCheck: () => void; checking: boolean; label?: string }) {
  const m = useMessages(toolsMessages).health
  const { tool, onCheck, checking, label = m.profileName } = props
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [opened, setOpened] = useState(false)
  const valid = isValidProfile(name)
  const command = setupCommand(tool, valid ? name : null)
  const id = `profile-${tool.id}`

  const open = async () => {
    try {
      await platform.openSetup(tool.id, name)
      setError(null)
      setOpened(true)
    } catch (e) {
      setError(String(e))
      setOpened(false)
    }
  }

  const here = signsInHere(tool)

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        if (here) useSignIn.getState().start(tool.id, name, onCheck)
        else open()
      }}
    >
      <label className="text-[0.9rem] font-medium text-ink" htmlFor={id}>
        {label}
        <span className="sr-only">, {tool.name}</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          value={name}
          onChange={(e) => {
            setName(e.target.value.trim())
            setOpened(false)
          }}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={name !== "" && !valid}
          aria-describedby={`${id}-hint`}
          className="h-8 min-w-[9rem] flex-1 rounded-[0.35rem] border border-line-strong bg-app px-2.5 font-mono text-[0.875rem] text-ink aria-[invalid=true]:border-bad"
        />
        {here && (
          <Button
            size="sm"
            variant="primary"
            type="submit"
            disabled={!valid}
            icon={<QrCode className="size-4" aria-hidden />}
          >
            {m.signInHere}
          </Button>
        )}
        <Button
          size="sm"
          variant={here ? "secondary" : "primary"}
          type={here ? "button" : "submit"}
          onClick={here ? open : undefined}
          disabled={!valid}
          icon={<Terminal className="size-4" aria-hidden />}
        >
          {here ? m.openTerminal : m.openTerminalToSignIn}
        </Button>
      </div>
      {name !== "" && !valid ? (
        <p id={`${id}-hint`} className="text-[0.9rem] text-bad">
          {m.nameInvalid}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-[0.9rem] leading-snug text-ink-soft">
          {(here ? m.nameHintHere : m.nameHintTerminal)(
            <code className="font-mono whitespace-nowrap text-ink">{setupCommand(tool, valid ? name : "<name>")}</code>,
          )}
        </p>
      )}
      {opened && <FinishInTerminal onCheck={onCheck} checking={checking} />}
      {error && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[0.9rem] text-ink-soft">{m.noTerminal}</p>
            <ReportThis what="Opening a terminal to sign in" tool={tool.id} command={command} error={error} />
          </div>
          {command && <CopyField value={command} label={m.copySetup} />}
        </div>
      )}
    </form>
  )
}

const findingIcon = (f: Finding) =>
  f.tone === "ok" ? (
    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
  ) : f.tone === "warn" ? (
    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
  ) : (
    <XCircle className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
  )

const findingKey = (f: Finding) =>
  [f.text ?? f.note, f.config?.file, f.config?.profile, f.config?.key, f.config?.line].filter(Boolean).join("|")

/** The tool's own words as it said them; the app's notes in the reader's language. */
function said(f: Finding, m: Words): string {
  if (f.text !== undefined) return f.text
  const code = f.exitCode === null || f.exitCode === undefined ? m.unknownCode : String(f.exitCode)
  if (f.note === "unreadable") return m.unreadable(code)
  if (f.note === "stopped") return m.stopped(code)
  return f.note ? m.note[f.note] : ""
}

function where({ file, profile, key, line, column }: ConfigPlace) {
  const at = file && line !== undefined ? `${file}:${line}${column !== undefined ? `:${column}` : ""}` : file
  return [at, profile && `profile ${profile}`, key && `key ${key}`].filter(Boolean).join(" · ")
}

function ConfigProblems({ findings, toolId, m }: { findings: Finding[]; toolId: string; m: Words }) {
  const [openError, setOpenError] = useState<string | null>(null)
  const open = async () => {
    try {
      await platform.openFolder(toolId, "config")
      setOpenError(null)
    } catch (e) {
      setOpenError(String(e))
    }
  }
  return (
    <section aria-label={m.configProblems} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h5 className="text-[0.9rem] font-medium text-ink-dim">{m.configProblems}</h5>
        <Button size="sm" variant="ghost" onClick={open} icon={<FolderOpen className="size-4" aria-hidden />}>
          {m.openSettingsFolder}
        </Button>
      </div>
      {openError && (
        <ErrorNotice inline action={<ReportThis what="Opening the settings folder" tool={toolId} error={openError} />}>
          {openError}
        </ErrorNotice>
      )}
      <ul className="flex flex-col gap-3">
        {findings.map((f) => {
          const at = f.config ? where(f.config) : ""
          return (
            <li key={findingKey(f)} className="flex items-start gap-2 text-[0.9rem]">
              {findingIcon(f)}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span>{said(f, m)}</span>
                {at && <code className="selectable font-mono text-[0.85rem] break-all text-ink-soft">{at}</code>}
                {f.fix && <CopyField value={f.fix} label={m.copyFix} />}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Result({ check, toolId, m }: { check: Check; toolId: string; m: Words }) {
  if (check.state === "running") return <Skeleton className="h-16 w-full" label={m.running} />
  const { result } = check
  const findings = summarize(result.report, result.exitCode)
  const config = findings.filter((f) => f.config)
  const other = findings.filter((f) => !f.config)
  return (
    <div className="flex flex-col gap-2 rounded-[0.45rem] border border-line bg-app p-3" aria-live="polite">
      {config.length > 0 && <ConfigProblems findings={config} toolId={toolId} m={m} />}
      {other.length > 0 && (
        <ul className={cx("flex flex-col gap-1.5", config.length > 0 && "border-line border-t pt-2.5")}>
          {other.map((f) => (
            <li key={findingKey(f)} className="flex items-start gap-2 text-[0.9rem]">
              {findingIcon(f)}
              <span>
                {said(f, m)}
                {f.fix && (
                  <>
                    {" "}
                    <span className="text-ink-dim">{m.fix}</span>{" "}
                    <code className="selectable font-mono text-[0.9rem]">{f.fix}</code>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Disclosure summary={m.technical}>
        <dl className="mb-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.85rem] text-ink-soft">
          <dt>{m.command}</dt>
          <dd className="selectable font-mono text-ink">{result.command}</dd>
          <dt>{m.exitCode}</dt>
          <dd className="font-mono text-ink">{result.exitCode ?? m.none}</dd>
          <dt>{m.took}</dt>
          <dd className="font-mono text-ink">{(result.durationMs / 1000).toFixed(1)} s</dd>
        </dl>
        <pre className="selectable max-h-56 overflow-auto rounded-[0.35rem] bg-app-2 p-2.5 font-mono text-[0.85rem] leading-relaxed text-ink-soft">
          {JSON.stringify(result.report, null, 2) ?? result.stderr}
        </pre>
        <p className="mt-1.5 text-[0.85rem] text-ink-dim">{m.hidden}</p>
      </Disclosure>
    </div>
  )
}
