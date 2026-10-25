import { Monitor, Moon, Sun } from "lucide-react"
import { cx } from "@/ui/cx"
import { Logo } from "@/ui/Logo"
import { Pill } from "@/ui/Pill"
import { Segmented } from "@/ui/Segmented"
import { sections } from "./sections"
import { type ThemeChoice, useTheme } from "./theme"

const themeOptions = [
  { value: "light", label: "Light theme", icon: <Sun className="size-4" aria-hidden /> },
  { value: "system", label: "Match the system", icon: <Monitor className="size-4" aria-hidden /> },
  { value: "dark", label: "Dark theme", icon: <Moon className="size-4" aria-hidden /> },
] as const satisfies readonly { value: ThemeChoice; label: string; icon: React.ReactNode }[]

export function Sidebar({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  const theme = useTheme()
  return (
    <aside
      className="flex w-[12rem] shrink-0 xl:w-[13.5rem] flex-col border-line border-r bg-wall"
      data-tauri-drag-region
    >
      <div className="flex h-[7rem] items-center px-[1.5rem] pb-[0.6rem]" data-tauri-drag-region>
        <Logo className="flex h-[2.3rem] items-center gap-[0.75rem] [&>svg:last-child]:h-[40%]" />
      </div>
      <nav aria-label="Sections" className="flex flex-col gap-[0.3rem]">
        {sections.map((s) => {
          const ready = Boolean(s.page)
          const current = s.id === active
          return (
            <button
              key={s.id}
              type="button"
              disabled={!ready}
              aria-current={current ? "page" : undefined}
              onClick={() => onSelect(s.id)}
              className={cx(
                "relative flex h-[2.6rem] items-center gap-[0.8rem] px-[1.5rem] text-left text-[1rem] transition-colors",
                current ? "font-semibold text-ink" : "text-ink-soft hover:text-ink",
                !ready && "cursor-default text-ink-dim/80 hover:text-ink-dim/80",
              )}
            >
              <span
                aria-hidden
                className={cx(
                  "absolute inset-y-0 left-0 w-[4px] rounded-r-full bg-brand transition-transform duration-200",
                  current ? "scale-y-100" : "scale-y-0",
                )}
              />
              <s.icon
                className={cx("size-[1.2rem] shrink-0", current ? "text-brand" : "text-current")}
                strokeWidth={1.6}
                aria-hidden
              />
              <span className="flex-1">{s.label}</span>
              {!ready && <Pill>Soon</Pill>}
            </button>
          )
        })}
      </nav>
      <div className="mt-auto flex items-center justify-between px-[1.4rem] pb-[1.6rem]">
        <span className="text-[0.95rem] text-ink-dim">{__APP_VERSION__}</span>
        <Segmented label="Theme" value={theme.choice} options={themeOptions} onChange={theme.set} />
      </div>
    </aside>
  )
}
