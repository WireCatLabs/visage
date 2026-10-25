import { Eye, EyeOff, TriangleAlert } from "lucide-react"
import { useId, useState } from "react"
import { cx } from "@/ui/cx"
import { passwordProblem, strength } from "./backup-password"

const BAR = ["bg-bad", "bg-bad", "bg-warn", "bg-ok"] as const

type Props = {
  password: string
  repeat: string
  onPassword: (value: string) => void
  onRepeat: (value: string) => void
  disabled: boolean
}

export function BackupPassword({ password, repeat, onPassword, onRepeat, disabled }: Props) {
  const id = useId()
  const [shown, setShown] = useState(false)
  const problem = passwordProblem(password, repeat)
  const loud =
    problem === "The two passwords differ." || (password.length > 0 && problem?.startsWith("A password cannot"))
  const hint = strength(password)
  const field =
    "selectable h-9 w-full rounded-[0.35rem] border border-line-strong bg-app px-2 pr-9 font-mono text-[0.95rem] text-ink"

  return (
    <div className="flex flex-col gap-2">
      <div className="grid max-w-[40rem] grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-pw`} className="block text-[0.9rem] text-ink">
            Password
          </label>
          <div className="relative mt-1">
            <input
              id={`${id}-pw`}
              type={shown ? "text" : "password"}
              autoComplete="new-password"
              spellCheck={false}
              value={password}
              disabled={disabled}
              onChange={(e) => onPassword(e.target.value)}
              aria-describedby={`${id}-strength ${id}-problem`}
              className={field}
            />
            <button
              type="button"
              onClick={() => setShown((s) => !s)}
              aria-pressed={shown}
              aria-label="Show password"
              title={shown ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 grid w-9 place-items-center rounded-r-[0.35rem] text-ink-dim hover:text-ink"
            >
              {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
          <div id={`${id}-strength`} className="mt-1.5 flex items-center gap-2 text-[0.8rem] text-ink-soft">
            <span aria-hidden className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={cx(
                    "h-1 w-6 rounded-full",
                    password.length > 0 && hint.level >= n ? BAR[hint.level] : "bg-app-3",
                  )}
                />
              ))}
            </span>
            <span>{password.length > 0 ? `Strength: ${hint.label}` : "Longer is stronger."}</span>
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-again`} className="block text-[0.9rem] text-ink">
            Repeat password
          </label>
          <input
            id={`${id}-again`}
            type={shown ? "text" : "password"}
            autoComplete="new-password"
            spellCheck={false}
            value={repeat}
            disabled={disabled}
            onChange={(e) => onRepeat(e.target.value)}
            aria-invalid={loud ? true : undefined}
            aria-describedby={`${id}-problem`}
            className={cx(field, "mt-1 pr-2", loud && "border-bad")}
          />
          <p
            id={`${id}-problem`}
            role={loud ? "alert" : undefined}
            className={cx("mt-1.5 min-h-[1.2rem] text-[0.8rem]", loud ? "text-bad" : "text-ink-soft")}
          >
            {problem ?? "The passwords match."}
          </p>
        </div>
      </div>
      <p className="flex max-w-[40rem] items-start gap-2 rounded-[0.3rem] border border-warn/50 bg-warn/10 px-3 py-2 text-[0.85rem] text-warn-ink">
        <TriangleAlert className="mt-[0.15rem] size-4 shrink-0" aria-hidden />
        If you lose it, the backup cannot be opened. WireCat does not keep it.
      </p>
    </div>
  )
}
