import { RotateCcw } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { DEFAULT_SCALE, MAX_SCALE, MIN_SCALE, SCALE_STEP, useScale } from "./scale"

/** WireCat's own preferences, above the tools' settings on the Settings page. */
export function AppPreferences() {
  return (
    <section aria-labelledby="app-preferences" className="flex flex-col gap-4">
      <h2 id="app-preferences" className="text-[1.05rem] font-semibold">
        WireCat
      </h2>
      <ScaleSetting />
    </section>
  )
}

function ScaleSetting() {
  const percent = useScale((s) => s.percent)
  const set = useScale((s) => s.set)
  const [shown, setShown] = useState(percent)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  const mod = platform.os === "macos" ? "⌘" : "Ctrl"

  useEffect(() => setShown(percent), [percent])

  // Every size is in rem, so the slider itself grows while it is dragged; applied on release (the native `change`,
  // which React's onChange is not), the thumb stays under the pointer.
  useEffect(() => {
    const el = input.current
    if (!el) return
    const commit = () => set(Number(el.value))
    el.addEventListener("change", commit)
    return () => el.removeEventListener("change", commit)
  }, [set])

  return (
    // Stacked at every size: side by side, a bigger size would wrap the slider below and move it from under the pointer.
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor={id} className="font-medium">
          Interface size
        </label>
        <p className="mt-1 max-w-[60ch] text-[0.9rem] text-ink-soft">
          Text and everything around it. {mod} + and {mod} − change it anywhere in the app, {mod} 0 resets it.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <input
          ref={input}
          id={id}
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={SCALE_STEP}
          value={shown}
          onChange={(e) => setShown(Number(e.target.value))}
          aria-valuetext={`${shown}%`}
          className="w-[14rem] accent-brand"
        />
        <output htmlFor={id} className="w-[3.2rem] text-right font-mono tabular-nums">
          {shown}%
        </output>
        <Button
          size="sm"
          variant="ghost"
          icon={<RotateCcw className="size-4" strokeWidth={1.8} aria-hidden />}
          disabled={percent === DEFAULT_SCALE}
          onClick={() => set(DEFAULT_SCALE)}
        >
          Reset to default
        </Button>
      </div>
    </div>
  )
}
