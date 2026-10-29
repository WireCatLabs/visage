import { ListChecks, Monitor, Moon, Sun } from "lucide-react"
import { useOnboarding } from "@/features/onboarding/store"
import { useMessages } from "@/i18n"
import { cx } from "@/ui/cx"
import { Logo } from "@/ui/Logo"
import { Pill } from "@/ui/Pill"
import { Segmented } from "@/ui/Segmented"
import { appMessages } from "./messages"
import { type Section, sections } from "./sections"
import { type ThemeChoice, useTheme } from "./theme"

export function Sidebar({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  const m = useMessages(appMessages)
  const themeOptions = [
    { value: "light", label: m.themeLight, icon: <Sun className="size-4" aria-hidden /> },
    { value: "system", label: m.themeSystem, icon: <Monitor className="size-4" aria-hidden /> },
    { value: "dark", label: m.themeDark, icon: <Moon className="size-4" aria-hidden /> },
  ] as const satisfies readonly { value: ThemeChoice; label: string; icon: React.ReactNode }[]
  const theme = useTheme()
  const postponed = useOnboarding((s) => s.status === "later")
  return (
    <aside
      className="flex w-[12rem] shrink-0 xl:w-[13.5rem] flex-col border-line border-r bg-wall"
      data-tauri-drag-region
    >
      <div className="flex h-[7rem] items-center px-[1.5rem] pb-[0.6rem]" data-tauri-drag-region>
        <Logo className="flex h-[2.3rem] items-center gap-[0.75rem] [&>svg:last-child]:h-[40%]" />
      </div>
      <nav aria-label={m.sectionsNav} className="flex flex-col gap-[0.3rem]">
        {sections
          .filter((s) => !s.group)
          .map((s) => (
            <NavItem key={s.id} section={s} active={active} onSelect={onSelect} />
          ))}
      </nav>
      <nav aria-label={m.systemNav} className="mt-auto flex flex-col gap-[0.3rem] pb-[0.8rem]">
        {sections
          .filter((s) => s.group === "system")
          .map((s) => (
            <NavItem key={s.id} section={s} active={active} onSelect={onSelect} />
          ))}
      </nav>
      {postponed && (
        <button
          type="button"
          onClick={() => useOnboarding.getState().reopen()}
          className="mx-[1rem] mb-[1rem] flex items-center gap-[0.7rem] rounded-[0.4rem] border border-line-strong bg-app px-[0.8rem] py-[0.6rem] text-left text-[0.95rem] text-ink hover:border-brand/50"
        >
          <ListChecks className="size-[1.1rem] shrink-0 text-brand" strokeWidth={1.8} aria-hidden />
          {m.finishSetup}
        </button>
      )}
      <div className="flex items-center justify-between border-line border-t px-[1.4rem] pt-[1rem] pb-[1.6rem]">
        <span className="text-[0.95rem] text-ink-dim">{__APP_VERSION__}</span>
        <Segmented label={m.theme} value={theme.choice} options={themeOptions} onChange={theme.set} />
      </div>
    </aside>
  )
}

function NavItem({
  section: s,
  active,
  onSelect,
}: {
  section: Section
  active: string
  onSelect: (id: string) => void
}) {
  const m = useMessages(appMessages)
  const ready = Boolean(s.page)
  const current = s.id === active
  return (
    <button
      type="button"
      data-tour={`nav-${s.id}`}
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
      <span className="flex-1">{m.nav[s.id]}</span>
      {!ready && <Pill>{m.soon}</Pill>}
    </button>
  )
}
