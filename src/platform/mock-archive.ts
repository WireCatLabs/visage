import type { Breakdown, FileFacts, Group, StoreCheck, StoreInfo, Table, TableList } from "./archive-schemas"
import { delay } from "./mock-delay"

// A fictional archive. `?store=plain` answers like today's tools, without the breakdown, the file facts or the
// table list. `?backup=fresh|none` changes the last backup; `?check=issues` makes the health check find problems.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)

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
    speaks: plain ? 29 : 33,
    searchReady: true,
    breakdown: plain ? null : BREAKDOWN,
    facts: plain ? null : facts(),
  }
}

const DAY = 86_400_000

function facts(): FileFacts {
  const backup = params.get("backup")
  const start = Date.UTC(2026, 8, 19, 9, 30)
  return {
    journalMode: "wal",
    pageSize: 4096,
    pageCount: 354_000,
    freePages: 1_870,
    migrations: Array.from({ length: 33 }, (_, i) => ({
      version: i + 1,
      minCompatible: 1,
      appliedAt: new Date(start + i * 1.1 * DAY).toISOString(),
    })),
    backup:
      backup === "none"
        ? null
        : {
            at: new Date(Date.now() - (backup === "fresh" ? 1 : 9) * DAY).toISOString(),
            file: "wirecat-backup.db.zst",
            checked: "quick_check ok",
          },
  }
}

export const DATA: [string, number][] = [
  ["accounts", 9],
  ["chats", 1611],
  ["chat_members", 22_480],
  ["messages", 15_594],
  ["message_revisions", 812],
  ["message_reactions", 3_904],
  ["message_links", 2_210],
  ["attachments", 10_475],
  ["identities", 6_120],
  ["identity_links", 1_302],
  ["persons", 980],
  ["emails", 5_230],
  ["email_threads", 2_960],
  ["email_recipients", 14_870],
  ["documents", 742],
  ["document_revisions", 1_904],
  ["meetings", 64],
  ["meeting_transcripts", 51],
  ["meeting_transcript_rows", 38_210],
  ["events", 0],
  ["notes", 128],
  ["tasks", 46],
  ["tags", 12],
  ["taggings", 310],
  ["chunks", 41_200],
  ["embeddings", 41_200],
  ["conversations", 3_890],
  ["mentions", 9_430],
  ["search_terms", 88_400],
  ["sync_ranges", 2_340],
]

const INDEXES = ["messages_fts", "chats_fts", "identities_fts", "message_words", "message_stems", "email_words"]
const PARTS = ["data", "idx", "docsize", "config"]

const bytesFor = (name: string, rows: number) => 4096 * (1 + Math.round(rows * (0.06 + (name.length % 7) / 40)))

const TABLES: Table[] = [
  ...DATA.map(([name, rows]) => ({ name, kind: "data", rows, bytes: bytesFor(name, rows) })),
  { name: "schema_migrations", kind: "internal", rows: 33, bytes: 4096 },
  { name: "store_settings", kind: "internal", rows: 4, bytes: 4096 },
  { name: "sqlite_sequence", kind: "internal", rows: 18, bytes: 4096 },
  ...INDEXES.flatMap((index, i) => [
    { name: index, kind: "search_index", rows: null, bytes: null },
    ...PARTS.map((part) => ({
      name: `${index}_${part}`,
      kind: "search_index_part",
      rows: null,
      bytes: part === "data" ? 4096 * (9_000 + i * 4_100) : part === "config" ? 4096 : 4096 * (60 + i * 22),
    })),
  ]),
]

export async function storeTablesMock(answeredBy: string | null, sizes: boolean): Promise<TableList | null> {
  await delay(sizes ? 2400 : 500)
  if (!answeredBy) return null
  if (params.get("store") === "plain") return { answeredBy, available: false, measured: false, tables: [] }
  return {
    answeredBy,
    available: true,
    measured: sizes,
    tables: TABLES.map((t) => ({ ...t, bytes: sizes ? t.bytes : null })),
  }
}

export async function storeCheckMock(answeredBy: string | null): Promise<StoreCheck | null> {
  await delay(3200)
  if (!answeredBy) return null
  const bin = answeredBy
  const issues = params.get("check") === "issues"
  return {
    answeredBy,
    bin,
    ok: !issues,
    problem: null,
    schema: issues ? 31 : 33,
    minCompatible: 1,
    speaks: 33,
    writable: true,
    checks: { schema: !issues, integrity: true, foreign_keys: true, search_indexes: !issues, disk: true },
    integrity: [],
    foreignKeyViolations: 0,
    brokenIndexes: issues ? ["message_words"] : [],
    diskFree: 48_000_000_000,
    diskNeeded: 1_454_200_000,
    chatsBehind: issues ? 12 : 0,
    orphanPointers: issues ? 3 : 0,
    fixes: issues ? [`${bin} store migrate`] : [],
  }
}
