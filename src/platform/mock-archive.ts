import type { Breakdown, Group, StoreInfo } from "./archive-schemas"

// A fictional archive. `?store=plain` answers like today's tools, without the breakdown.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

const g = (provider: string, key: string | null, counts: Partial<Omit<Group, "provider" | "key">>): Group => ({
  provider,
  key,
  accounts: 0,
  chats: 0,
  messages: 0,
  emails: 0,
  documents: 0,
  meetings: 0,
  ...counts,
})

const BREAKDOWN: Breakdown = {
  providers: [
    g("telegram", null, { accounts: 2, chats: 1210, messages: 9840 }),
    g("whatsapp", null, { accounts: 1, chats: 312, messages: 4120 }),
    g("max", null, { accounts: 1, chats: 88, messages: 1630 }),
    g("email", null, { accounts: 2, emails: 5230 }),
    g("google-drive", null, { accounts: 1, documents: 742 }),
    g("zoom", null, { accounts: 1, meetings: 64 }),
    g("chat", null, { accounts: 1, chats: 1, messages: 4 }),
  ],
  chatKinds: [
    g("telegram", "dialog", { chats: 840, messages: 5120 }),
    g("telegram", "group", { chats: 290, messages: 3910 }),
    g("telegram", "channel", { chats: 80, messages: 810 }),
    g("whatsapp", "dialog", { chats: 270, messages: 2980 }),
    g("whatsapp", "group", { chats: 42, messages: 1140 }),
    g("max", "dialog", { chats: 88, messages: 1630 }),
    g("chat", "dialog", { chats: 1, messages: 4 }),
  ],
  accounts: [
    g("telegram", "personal", { chats: 1020, messages: 8900 }),
    g("telegram", "work", { chats: 190, messages: 940 }),
    g("whatsapp", "personal", { chats: 312, messages: 4120 }),
    g("max", "personal", { chats: 88, messages: 1630 }),
    g("email", "personal", { emails: 4100 }),
    g("email", "•••", { emails: 1130 }),
    g("google-drive", "personal", { documents: 742 }),
    g("zoom", "work", { meetings: 64 }),
    g("chat", "local", { chats: 1, messages: 4 }),
  ],
  years: [
    g("telegram", "2023", { messages: 1200 }),
    g("telegram", "2024", { messages: 3800 }),
    g("telegram", "2025", { messages: 3900 }),
    g("telegram", "2026", { messages: 940 }),
    g("whatsapp", "2025", { messages: 2600 }),
    g("whatsapp", "2026", { messages: 1520 }),
    g("max", "2026", { messages: 1630 }),
    g("chat", "2026", { messages: 4 }),
  ],
  attachmentKinds: [
    { owner: "message", kind: "photo", count: 6210, bytes: 2_140_000_000 },
    { owner: "message", kind: "document", count: 820, bytes: 610_000_000 },
    { owner: "message", kind: "voice", count: 1340, bytes: 96_000_000 },
    { owner: "email", kind: "document", count: 2105, bytes: 380_000_000 },
  ],
}

export async function storeInfoMock(answeredBy: string | null): Promise<StoreInfo | null> {
  await delay(350)
  if (!answeredBy) return null
  const plain = params.get("store") === "plain"
  return {
    answeredBy,
    path: "~/.local/share/WireCat/wirecat.db",
    exists: true,
    problem: null,
    fileBytes: 1_450_000_000,
    walBytes: 4_200_000,
    schema: plain ? 29 : 33,
    writable: true,
    rows: plain
      ? { accounts: 9, chats: 1611, messages: 15594, attachments: 10475, identities: 6120 }
      : {
          accounts: 9,
          chats: 1611,
          messages: 15594,
          emails: 5230,
          documents: 742,
          meetings: 64,
          events: 0,
          attachments: 10475,
          identities: 6120,
        },
    searchReady: true,
    breakdown: plain ? null : BREAKDOWN,
  }
}
