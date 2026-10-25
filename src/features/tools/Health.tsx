import { AlertTriangle, CheckCircle2, FolderOpen, RefreshCw, Stethoscope, Terminal, XCircle } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { type CatalogTool, doctorNeedsProfile, isValidProfile, setupCommand, usesProfiles } from "@/domain/catalog"
import { type ConfigPlace, type Finding, summarize } from "@/domain/doctor"
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

  return (
    <section aria-label={`${tool.name} accounts and health`} className="flex min-w-0 flex-col gap-3">
      <h4 className="text-[0.85rem] font-medium text-ink-dim">{usesProfiles(tool) ? "Profiles" : "Health"}</h4>

      {!usesProfiles(tool) || !doctorNeedsProfile(tool) ? (
        <div>
          <Button
            size="sm"
            onClick={() => run(null)}
            disabled={running}
            icon={<Stethoscope className="size-4" aria-hidden />}
          >
            {running ? "Checking…" : "Check health"}
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

      {checkError && (
        <ErrorNotice inline action={<ReportThis what={`Checking ${tool.name}`} tool={tool.id} error={checkError} />}>
          {checkError}
        </ErrorNotice>
      )}
      {check && <Result check={check} toolId={tool.id} />}
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
  if (error) {
    return (
      <ErrorNotice inline action={<ReportThis what={`Listing ${tool.name} profiles`} tool={tool.id} error={error} />}>
        Could not list profiles: {error}
      </ErrorNotice>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {profiles === undefined ? (
        <ul className="divide-y divide-line overflow-hidden rounded-[0.45rem] border border-line bg-app">
          {[0, 1].map((n) => (
            <li key={n} className="flex h-8 box-content items-center px-3 py-2">
              <Skeleton className="h-4 w-28" label={n === 0 ? "Loading profiles" : ""} />
            </li>
          ))}
        </ul>
      ) : profiles && profiles.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-[0.45rem] border border-line bg-app">
          {profiles.map((p) => (
            <li key={p.name} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
              {p.signedIn === true && <Pill tone="brand">signed in</Pill>}
              {p.signedIn === false && <Pill>not signed in</Pill>}
              {onCheck && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => onCheck(p.name)}>
                  {busy && activeProfile === p.name ? "Checking…" : "Check"}
                </Button>
              )}
              {tool.setup && p.signedIn !== true && (
                <Button size="sm" variant="ghost" onClick={() => platform.openSetup(tool.id, p.name)}>
                  {p.signedIn === false ? "Sign in" : "Set up"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.9rem] text-ink-soft">
          {tool.setup ? "No profile yet. Name one to sign in to your account." : "No account yet."}
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
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[0.35rem] bg-brand-soft/60 px-3 py-2">
      <p role="status" className="min-w-0 flex-1 text-[0.9rem] text-ink">
        Finish signing in in the terminal window, then press Check sign-in.
      </p>
      <Button
        size="sm"
        variant="secondary"
        onClick={onCheck}
        disabled={checking}
        icon={<RefreshCw className={cx("size-4", checking && "animate-spin")} aria-hidden />}
      >
        {checking ? "Checking…" : "Check sign-in"}
      </Button>
    </div>
  )
}

/** For a tool whose CLI has no interactive sign-in yet: the command to run, which the app never runs itself. */
export function ManualSetup(props: { tool: CatalogTool; onCheck: () => void; checking: boolean }) {
  const { tool, onCheck, checking } = props
  const signIn = tool.signIn
  if (!signIn?.command) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[0.85rem] leading-snug text-ink-soft">
        Add an account from a terminal; this has no sign-in window yet.{" "}
        {signIn.guide && (
          <a
            href={signIn.guide}
            onClick={(e) => {
              e.preventDefault()
              if (signIn.guide) platform.openUrl(signIn.guide)
            }}
            className="font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
          >
            How to set it up
          </a>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <CopyField value={signIn.command} label={`Copy the command that adds a ${tool.name} account`} />
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCheck}
          disabled={checking}
          icon={<RefreshCw className={cx("size-4", checking && "animate-spin")} aria-hidden />}
        >
          {checking ? "Checking…" : "Check again"}
        </Button>
      </div>
    </div>
  )
}

export function NewProfile(props: { tool: CatalogTool; onCheck: () => void; checking: boolean; label?: string }) {
  const { tool, onCheck, checking, label = "Name for this account" } = props
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

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) open()
      }}
    >
      <label className="text-[0.85rem] font-medium text-ink" htmlFor={id}>
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
        <Button size="sm" type="submit" disabled={!valid} icon={<Terminal className="size-4" aria-hidden />}>
          Open terminal to sign in
        </Button>
      </div>
      {name !== "" && !valid ? (
        <p id={`${id}-hint`} className="text-[0.85rem] text-bad">
          Use letters, digits, dots, dashes or underscores.
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-[0.85rem] leading-snug text-ink-soft">
          Any short name, such as personal or work: one name per account. The terminal window runs{" "}
          <code className="font-mono whitespace-nowrap text-ink">{setupCommand(tool, valid ? name : "<name>")}</code>.
        </p>
      )}
      {opened && <FinishInTerminal onCheck={onCheck} checking={checking} />}
      {error && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[0.85rem] text-ink-soft">No terminal could be opened. Run this yourself:</p>
            <ReportThis what="Opening a terminal to sign in" tool={tool.id} command={command} error={error} />
          </div>
          {command && <CopyField value={command} label="Copy the setup command" />}
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
  [f.text, f.config?.file, f.config?.profile, f.config?.key, f.config?.line].filter(Boolean).join("|")

function where({ file, profile, key, line, column }: ConfigPlace) {
  const at = file && line !== undefined ? `${file}:${line}${column !== undefined ? `:${column}` : ""}` : file
  return [at, profile && `profile ${profile}`, key && `key ${key}`].filter(Boolean).join(" · ")
}

function ConfigProblems({ findings, toolId }: { findings: Finding[]; toolId: string }) {
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
    <section aria-label="Configuration problems" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h5 className="text-[0.85rem] font-medium text-ink-dim">Configuration problems</h5>
        <Button size="sm" variant="ghost" onClick={open} icon={<FolderOpen className="size-4" aria-hidden />}>
          Open settings folder
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
                <span>{f.text}</span>
                {at && <code className="selectable font-mono text-[0.8rem] break-all text-ink-soft">{at}</code>}
                {f.fix && <CopyField value={f.fix} label="Copy the fix command" />}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Result({ check, toolId }: { check: Check; toolId: string }) {
  if (check.state === "running") return <Skeleton className="h-16 w-full" label="Running the check" />
  const { result } = check
  const findings = summarize(result.report, result.exitCode)
  const config = findings.filter((f) => f.config)
  const other = findings.filter((f) => !f.config)
  return (
    <div className="flex flex-col gap-2 rounded-[0.45rem] border border-line bg-app p-3" aria-live="polite">
      {config.length > 0 && <ConfigProblems findings={config} toolId={toolId} />}
      {other.length > 0 && (
        <ul className={cx("flex flex-col gap-1.5", config.length > 0 && "border-line border-t pt-2.5")}>
          {other.map((f) => (
            <li key={findingKey(f)} className="flex items-start gap-2 text-[0.9rem]">
              {findingIcon(f)}
              <span>
                {f.text}
                {f.fix && (
                  <>
                    {" "}
                    <span className="text-ink-dim">Fix:</span>{" "}
                    <code className="selectable font-mono text-[0.85rem]">{f.fix}</code>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Disclosure summary="Technical details">
        <dl className="mb-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.8rem] text-ink-soft">
          <dt>Command</dt>
          <dd className="selectable font-mono text-ink">{result.command}</dd>
          <dt>Exit code</dt>
          <dd className="font-mono text-ink">{result.exitCode ?? "none"}</dd>
          <dt>Took</dt>
          <dd className="font-mono text-ink">{(result.durationMs / 1000).toFixed(1)} s</dd>
        </dl>
        <pre className="selectable max-h-56 overflow-auto rounded-[0.35rem] bg-app-2 p-2.5 font-mono text-[0.75rem] leading-relaxed text-ink-soft">
          {JSON.stringify(result.report, null, 2) ?? result.stderr}
        </pre>
        <p className="mt-1.5 text-[0.75rem] text-ink-dim">Account names, numbers, addresses and tokens are hidden.</p>
      </Disclosure>
    </div>
  )
}
