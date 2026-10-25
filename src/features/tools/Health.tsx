import { AlertTriangle, CheckCircle2, Stethoscope, Terminal, XCircle } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { type CatalogTool, doctorNeedsProfile, isValidProfile, setupCommand, usesProfiles } from "@/domain/catalog"
import { type Finding, summarize } from "@/domain/doctor"
import { platform } from "@/platform/bridge"
import type { Diagnosis, Profile } from "@/platform/schemas"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { Disclosure } from "@/ui/Disclosure"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"

type Check = { profile: string | null; state: "running" } | { profile: string | null; state: "done"; result: Diagnosis }

export function Health({ tool }: { tool: CatalogTool }) {
  const [profiles, setProfiles] = useState<Profile[] | null | undefined>(undefined)
  const [profilesError, setProfilesError] = useState<string | null>(null)
  const [check, setCheck] = useState<Check | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    platform.listProfiles(tool.id).then(
      (p) => live && setProfiles(p),
      (e) => live && setProfilesError(String(e)),
    )
    return () => {
      live = false
    }
  }, [tool.id])

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
        />
      )}

      {checkError && <p className="text-[0.9rem] text-bad">{checkError}</p>}
      {check && <Result check={check} />}
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
}) {
  const { tool, profiles, error, busy, activeProfile, onCheck } = props
  if (error) return <p className="text-[0.9rem] text-bad">Could not list profiles: {error}</p>
  if (profiles === undefined) return <Skeleton className="h-10 w-full" label="Loading profiles" />
  return (
    <div className="flex flex-col gap-2">
      {profiles && profiles.length > 0 ? (
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
              {tool.setup && (
                <Button size="sm" variant="ghost" onClick={() => platform.openSetup(tool.id, p.name)}>
                  {p.signedIn === false ? "Sign in" : "Set up"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.9rem] text-ink-soft">No profile yet. Name one to connect your account.</p>
      )}
      {tool.setup && <NewProfile tool={tool} />}
    </div>
  )
}

function NewProfile({ tool }: { tool: CatalogTool }) {
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const valid = isValidProfile(name)
  const command = setupCommand(tool, valid ? name : null)

  const open = async () => {
    try {
      await platform.openSetup(tool.id, name)
      setError(null)
    } catch (e) {
      setError(String(e))
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
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`profile-${tool.id}`}>
          New profile name
        </label>
        <input
          id={`profile-${tool.id}`}
          value={name}
          onChange={(e) => setName(e.target.value.trim())}
          placeholder="New profile, e.g. personal"
          spellCheck={false}
          autoComplete="off"
          aria-invalid={name !== "" && !valid}
          className="h-8 min-w-0 flex-1 rounded-[0.35rem] border border-line-strong bg-app px-2.5 font-mono text-[0.875rem] text-ink placeholder:font-sans placeholder:text-ink-dim aria-[invalid=true]:border-bad"
        />
        <Button size="sm" type="submit" disabled={!valid} icon={<Terminal className="size-4" aria-hidden />}>
          Connect in terminal
        </Button>
      </div>
      {name !== "" && !valid && (
        <p className="text-[0.85rem] text-bad">Use letters, digits, dots, dashes or underscores.</p>
      )}
      {error && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[0.85rem] text-ink-soft">No terminal could be opened. Run this yourself:</p>
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

function Result({ check }: { check: Check }) {
  if (check.state === "running") return <Skeleton className="h-16 w-full" label="Running the check" />
  const { result } = check
  const findings = summarize(result.report, result.exitCode)
  return (
    <div className="flex flex-col gap-2 rounded-[0.45rem] border border-line bg-app p-3" aria-live="polite">
      <ul className="flex flex-col gap-1.5">
        {findings.map((f) => (
          <li key={f.text} className="flex items-start gap-2 text-[0.9rem]">
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
