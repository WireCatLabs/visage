import { type ReactNode, useId } from "react"

type Option<T extends string> = { value: T; label: string; icon: ReactNode }

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
}) {
  const name = useId()
  return (
    <fieldset className="inline-flex rounded-[0.45rem] border-0 bg-app-3 p-[3px]">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <label key={o.value} title={o.label} className="relative">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={o.value === value}
            onChange={() => onChange(o.value)}
            className="peer sr-only"
          />
          <span className="sr-only">{o.label}</span>
          <span
            aria-hidden
            className="grid size-7 cursor-pointer place-items-center rounded-[0.35rem] text-ink-dim transition-colors duration-150 hover:text-ink peer-checked:bg-app peer-checked:text-ink peer-checked:shadow-panel peer-focus-visible:outline-2 peer-focus-visible:outline-brand"
          >
            {o.icon}
          </span>
        </label>
      ))}
    </fieldset>
  )
}
