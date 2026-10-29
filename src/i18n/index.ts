import { useEffect } from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export const LANGS = ["en", "ru", "es"] as const
export type Lang = (typeof LANGS)[number]
export type LangChoice = Lang | "system"

/** Each language by its own name, so a reader who cannot read the current one still finds theirs. */
export const ENDONYMS: Record<Lang, string> = { en: "English", ru: "Русский", es: "Español" }

type LanguageState = { choice: LangChoice; set(choice: LangChoice): void }

export const useLanguage = create<LanguageState>()(
  persist((set) => ({ choice: "system", set: (choice) => set({ choice }) }), {
    name: "wirecat.language",
    storage: createJSONStorage(() => localStorage),
  }),
)

/** Russian or Spanish in any region when the system asks for it first; anything else is English. */
export function systemLang(preferred: readonly string[] = globalThis.navigator?.languages ?? []): Lang {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0]
    if (base === "ru" || base === "es") return base
    if (base === "en") return "en"
  }
  return "en"
}

export const resolveLang = (choice: LangChoice): Lang => (choice === "system" ? systemLang() : choice)
export const currentLang = () => resolveLang(useLanguage.getState().choice)
export const useLang = () => resolveLang(useLanguage((s) => s.choice))

/** Keeps `<html lang>` in step, so the webview hyphenates and reads the text in its language. */
export function useApplyLang() {
  const lang = useLang()
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
}

/**
 * A feature's messages: English is the source, Russian and Spanish must have every key with the same slots. A value
 * is a string, or a function for a message with slots, so each language orders its words its own way.
 */
export type Messages<T> = { en: T; ru: T; es: T }

export const useMessages = <T>(messages: Messages<T>): T => messages[useLang()]

/** For code outside React. A component that calls it must also read `useLang()`, or a switch will not reach it. */
export const messagesOf = <T>(messages: Messages<T>, lang: Lang = currentLang()): T => messages[lang]

type PluralForms = { one?: string; few?: string; many?: string; other: string }

const rules = new Map<Lang, Intl.PluralRules>()

/**
 * `plural("ru", 3, { one: "# запуск", few: "# запуска", many: "# запусков", other: "# запуска" })` → "3 запуска".
 * `#` is the number written for that language; a form the language does not use falls back to `other`.
 */
export function plural(lang: Lang, n: number, forms: PluralForms): string {
  let rule = rules.get(lang)
  if (!rule) {
    rule = new Intl.PluralRules(lang)
    rules.set(lang, rule)
  }
  const form = forms[rule.select(n) as keyof PluralForms] ?? forms.other
  return form.replaceAll("#", formatNumber(n, lang))
}

export const formatNumber = (n: number, lang: Lang = currentLang()) => n.toLocaleString(lang)

export const formatList = (items: readonly string[], lang: Lang = currentLang()) =>
  new Intl.ListFormat(lang, { type: "conjunction" }).format(items)

export const formatDate = (at: Date | number | string, options: Intl.DateTimeFormatOptions, lang = currentLang()) =>
  new Date(at).toLocaleString(lang, options)

export const formatRelative = (value: number, unit: Intl.RelativeTimeFormatUnit, lang: Lang = currentLang()) =>
  new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(value, unit)
