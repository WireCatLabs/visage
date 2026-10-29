import { messagesOf } from "@/i18n"
import { type ConfigText, configMessages } from "./messages"

type Fixed = { [K in keyof ConfigText["reasons"]]: ConfigText["reasons"][K] extends string ? K : never }

/** Why something was refused, kept as a code so a language switch also changes what is already on screen. */
export type Reason =
  | { code: "tool"; text: string }
  | { code: "notJson"; near: string }
  | { code: "exists"; name: string }
  | { code: Fixed[keyof Fixed] }

/** What a tool (or Rust) printed: shown as it was printed. */
export const told = (text: string): Reason => ({ code: "tool", text })

export function reasonText(m: ConfigText, r: Reason): string {
  if (r.code === "tool") return r.text
  if (r.code === "notJson") return m.reasons.notJson(r.near)
  if (r.code === "exists") return m.reasons.exists(r.name)
  return m.reasons[r.code]
}

/** The team's bug reports stay in English. */
export const reportText = (r: Reason) => reasonText(messagesOf(configMessages, "en"), r)
