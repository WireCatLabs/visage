import type { ReactNode } from "react"
import type { ArchiveWords, Counted, Dimension, TotalKey } from "@/domain/archive"
import type { DatabaseWords } from "@/domain/database"
import type { EntryKey } from "@/domain/files"
import { formatDate, formatNumber, type Lang, type Messages, plural } from "@/i18n"
import type { StorageFolder } from "@/platform/schemas"

type FolderKind = StorageFolder["kind"]

const day = (at: number | string, lang: Lang) =>
  formatDate(at, { day: "numeric", month: "short", year: "numeric" }, lang)

const duration = (ms: number, s: string, min: string) => {
  const t = Math.round(ms / 1000)
  if (t < 60) return `${t} ${s}`
  return `${Math.floor(t / 60)} ${min} ${String(t % 60).padStart(2, "0")} ${s}`
}

const capital = (word: string) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`

const withCheck = (text: string, checked: string | null) => (checked ? `${text}, ${checked}` : text)

/** The same shape in every language, only the words differ: "25 Oct 2026, 9 days ago, quick_check ok". */
const backupLine = (lang: Lang, when: (days: number) => string) => (at: number, days: number, checked: string | null) =>
  withCheck(`${day(at, lang)}, ${when(days)}`, checked)

/** "4 messages": the words for each counted thing, in the language's plural forms. */
const counter = (lang: Lang, words: Record<Counted, [string, ...string[]]>) => (what: Counted, n: number) => {
  const [one, few, many] = words[what]
  return plural(lang, n, {
    one: `# ${one}`,
    few: `# ${few ?? one}`,
    many: `# ${many ?? few ?? one}`,
    other: `# ${few ?? one}`,
  })
}

const enCount: Record<Counted, [string, string]> = {
  accounts: ["account", "accounts"],
  chats: ["chat", "chats"],
  messages: ["message", "messages"],
  emails: ["email", "emails"],
  documents: ["document", "documents"],
  meetings: ["meeting", "meetings"],
}

const enOwner: Record<string, string> = {
  message: "messages",
  email: "emails",
  document: "documents",
  meeting: "meetings",
}

const enWhen = (days: number) =>
  days <= 0 ? "today" : days === 1 ? "yesterday" : plural("en", days, { one: "# day ago", other: "# days ago" })

const en = {
  title: "Storage",
  checking: "Checking…",
  intro:
    "What WireCat tools keep on this computer: settings, sessions, shared storage and caches. Uninstalling a tool keeps its data; once no installed tool uses it, you can delete it here. Sign-in tokens in your system keyring are not touched.",
  deleteAll: "Delete all leftover data",
  areasLabel: "Data on this computer",
  shared: "Shared storage",
  folderKind: { config: "Settings", state: "Data", cache: "Cache" } as Record<FolderKind, string>,
  nothingStored: "Nothing stored",
  usedBy: (names: string) => `Used by ${names}`,
  usedByKept: (names: string) => `Used by ${names}. Uninstalling keeps this data`,
  leftBehind: "Left behind after uninstalling",
  openFolder: (kind: FolderKind, path: string) =>
    `Open ${{ config: "settings", state: "data", cache: "cache" }[kind]} folder ${path}`,
  openInFiles: "Open in file manager",
  showInFiles: "Show in file manager",
  deleting: "Deleting…",
  delete: "Delete",
  measuringFolders: "Measuring folders",
  whatIsHere: (n: number) => `What is in here (${n})`,
  keeps: (name: string) => `What ${name} keeps`,
  credentials: "Credentials",
  notDescribed: "Not described",
  openEntry: (name: string) => `Open ${name} in the file manager`,
  entry: {
    sessions: "Sign-in sessions. Credentials: size only, never opened.",
    profiles: "Sign-in state for each profile. Credentials: size only, never opened.",
    googleClient: "Google sign-in app credentials. Size only, never opened.",
    config: "Settings, the ones the Config page shows",
    configCopy: "An older copy of the settings, kept before a change",
    runs: "Run logs, the ones the Logs page shows",
    backfill: "History sync jobs and how far each got",
    sends: "A journal of every send attempt, never the text",
    accounts: "Which account each profile is, for reading offline",
    pace: "How fast each profile may ask the messenger",
    flood: "Holds the messenger placed on sending, per profile",
    serve: "Background server logs and locks",
    bots: "Registered bots and their send journals",
    updateCheck: "When the tool last looked for a new version",
    store: "Shared storage: messages, mail, documents, meetings",
    storeLog: "Part of the database beside it (write log)",
    backups: "Backup copies of the database",
    models: "Search models, downloaded once",
    driveStore: "Drive's own older store, from before shared storage",
    maxCache: "An older per-profile message cache, from before shared storage",
    folders: "Which note folders memo reads and how far it got",
    mailTrash: "Mail moved to the trash, kept so it can be undone",
    domainAges: "How old each mail sender's domain is, remembered",
    auto: "When memo last synced on its own",
    importLock: "A lock left by an import",
  } as Record<EntryKey, string>,
  confirmAll: "Delete all leftover WireCat data?",
  confirmOne: (name: string) => `Delete ${name} data?`,
  keepIt: "Keep it",
  deleteSize: (size: string) => `Delete ${size}`,
  deletedForGood: "These folders are deleted for good. Messages, sessions and settings in them cannot be recovered.",

  inStorage: "In storage",
  countedBy: (command: ReactNode, at: ReactNode | null): ReactNode => (
    <>
      Counted by {command}
      {at !== null && <> at {at}</>}
    </>
  ),
  schema: (n: number) => `schema ${n}`,
  readError: (error: string) => `Could not read storage: ${error}`,
  noTool:
    "Install a WireCat tool to see what is in storage: the installed tool that reads the newest schema counts it for the app.",
  notCreated: "Storage is not created yet. It appears after the first sync.",
  didNotOpen: (problem: string) => `Storage is there but did not open: ${problem}`,
  total: {
    messages: "Messages",
    chats: "Chats",
    emails: "Emails",
    documents: "Documents",
    meetings: "Meetings",
    attachments: "Attachments",
    accounts: "Accounts",
  } as Record<TotalKey, string>,
  breakDownBy: "Break down by",
  dimension: {
    provider: "Source",
    chatKind: "Chat type",
    account: "Account",
    year: "Year",
    attachment: "Files",
  } as Record<Dimension, string>,
  byDimension: {
    provider: "By source",
    chatKind: "By chat type",
    account: "By account",
    year: "By year",
    attachment: "By files",
  } as Record<Dimension, string>,
  nothingToBreak: "Nothing to break down yet.",
  group: "Group",
  share: "Share",
  unitHeader: {
    provider: "Items",
    chatKind: "Messages",
    account: "Items",
    year: "Messages",
    attachment: "Files",
  } as Record<Dimension, string>,
  /** The word after a count, without the number. */
  unit: (dim: Dimension, n: number) =>
    dim === "provider" || dim === "account"
      ? plural("en", n, { one: "item", other: "items" })
      : dim === "attachment"
        ? plural("en", n, { one: "file", other: "files" })
        : plural("en", n, { one: "message", other: "messages" }),
  breakdownsLater: (tool: string) =>
    `Breakdowns by source, chat type, account and year arrive with the next update of ${tool}.`,
  readingStorage: "Reading storage",
  archiveWords: {
    count: counter("en", enCount),
    via: (command) => `via ${command}`,
    providers: { notes: "Notes", chat: "Chat" },
    chatKinds: {
      dialog: "One-to-one",
      group: "Groups",
      channel: "Channels",
      saved: "Saved messages",
      unknown: "Unknown kind",
    },
    attachment: (kind, owner) => `${capital(kind)} in ${enOwner[owner] ?? owner}`,
  } as ArchiveWords,

  storageFile: "Storage file",
  fact: {
    file: "File",
    size: "Size",
    journal: "Journal mode",
    schema: "Schema",
    unused: "Unused space",
    backup: "Last backup",
    health: "Health",
  },
  sizeWal: (file: ReactNode, wal: ReactNode): ReactNode => (
    <>
      {file} and {wal} not yet written into it (the write-ahead log)
    </>
  ),
  unusedSpace: (size: ReactNode, free: number, total: number): ReactNode => (
    <>
      {size} in {plural("en", free, { one: "# free page", other: "# free pages" })} of {formatNumber(total, "en")}; a
      clean-up (VACUUM) would give it back
    </>
  ),
  migrations: (n: number) => `Migration history (${n})`,
  migrationsLabel: "Migration history",
  version: "Version",
  applied: "Applied",
  readableFrom: "Readable by tools from",
  factsLater: (tool: string) =>
    `Journal mode, unused space, migration history and the last backup arrive with the next update of ${tool}.`,
  checkHealth: "Check health",
  readingPages: (time: ReactNode): ReactNode => <>Reading every page of the file… {time}</>,
  checkFailed: (error: string) => `The check did not finish: ${error}`,
  notChecked: "Not checked yet. The check reads the whole file, a minute or two when storage is large.",
  noProblems: "No problems found",
  problems: (n: number) => plural("en", n, { one: "# problem found", other: "# problems found" }),
  checkedIn: (time: string) => `checked in ${time}`,
  copyCommand: "Copy the command",
  duration: (ms: number) => duration(ms, "s", "min"),
  databaseWords: {
    noBackup: "No backup recorded beside the storage file",
    backup: backupLine("en", enWhen),
    backupStale: (at, days, checked) =>
      `${backupLine("en", enWhen)(at, days, checked)}. The backup job has not finished since`,
    schemaBehind: (speaks) => `newer tools use ${speaks}; storage moves to it the next time one writes`,
    schemaAhead: "newer than some installed tools know; update them on the Tools page",
    didNotOpen: (problem) => `Storage did not open: ${problem}`,
    schemaOld: (schema, bin, speaks) =>
      `Storage is at schema ${schema}; ${bin} speaks ${speaks}. Back it up, then bring it up to date.`,
    schemaTooNew: (schema, needs, bin, speaks) =>
      `Storage is at schema ${schema} and needs a tool that speaks at least ${needs ?? "—"}; ${bin} speaks ${speaks}.`,
    damaged: (details) => `SQLite found damage in the file: ${details}. Restore a backup.`,
    danglingRows: (n) =>
      plural("en", n, {
        one: "# row points at a row that is not there.",
        other: "# rows point at a row that is not there.",
      }),
    brokenIndexes: (n, names) =>
      plural("en", n, {
        one: `# search index is damaged: ${names}. Search may miss messages until it is rebuilt.`,
        other: `# search indexes are damaged: ${names}. Search may miss messages until they are rebuilt.`,
      }),
    lowDisk: (free, needed) => `Only ${free} free on the disk; a backup or a clean-up needs about ${needed}.`,
    toolSuggests: "The tool suggests:",
    chatsBehind: (n) =>
      plural("en", n, {
        one: "# chat has newer messages than storage holds.",
        other: "# chats have newer messages than storage holds.",
      }),
    orphans: (n) =>
      plural("en", n, {
        one: "# tag or link points at something deleted.",
        other: "# tags and links point at something deleted.",
      }),
  } as DatabaseWords,

  tables: "Tables",
  column: { name: "Table", kind: "Kind", rows: "Rows", bytes: "Size" },
  tableKind: {
    data: "Data",
    internal: "Internal",
    search_index: "Search index",
    search_index_part: "Search index part",
  } as Record<string, string>,
  listLater: (tool: string) => `The table list arrives with the next update of ${tool}.`,
  listError: (error: string) => `Could not list the tables: ${error}`,
  findTable: "Find a table",
  noMatch: (query: string) => `No table name contains “${query}”.`,
  searchTables: (n: number) => `Search index tables (${n})`,
  searchTablesLabel: "Search index tables",
  searchNote:
    "Built from the data above so search is fast; rebuilding them loses nothing. Their rows are not counted, which would read every index in full.",
  measure: "Measure sizes",
  measureAgain: "Measure again",
  measuring: "Measuring…",
  measureHint: "Reads the whole file: seconds, or a few minutes when storage is large",
  measuredIn: (time: ReactNode): ReactNode => <>Measured in {time}</>,
  countingRows: "Counting rows",
}

const ruCount: Record<Counted, [string, string, string]> = {
  accounts: ["аккаунт", "аккаунта", "аккаунтов"],
  chats: ["чат", "чата", "чатов"],
  messages: ["сообщение", "сообщения", "сообщений"],
  emails: ["письмо", "письма", "писем"],
  documents: ["документ", "документа", "документов"],
  meetings: ["встреча", "встречи", "встреч"],
}

const ruForms = (n: number, [one, few, many]: [string, string, string]) =>
  plural("ru", n, { one, few, many, other: few })

const ruAttachment: Record<string, string> = {
  photo: "Фото",
  video: "Видео",
  document: "Документы",
  voice: "Голосовые",
  audio: "Аудио",
  sticker: "Стикеры",
}

const ruOwner: Record<string, string> = {
  message: "сообщениях",
  email: "письмах",
  document: "документах",
  meeting: "встречах",
}

const ruWhen = (days: number) =>
  days <= 0 ? "сегодня" : days === 1 ? "вчера" : ruForms(days, ["# день назад", "# дня назад", "# дней назад"])

const ru: typeof en = {
  title: "Хранилище",
  checking: "Проверяем…",
  intro:
    "Что инструменты WireCat хранят на этом компьютере: настройки, сеансы, общее хранилище и кеш. После удаления инструмента его данные остаются; когда их не использует ни один установленный инструмент, их можно удалить здесь. Токены входа в системном хранилище ключей не затрагиваются.",
  deleteAll: "Удалить все оставшиеся данные",
  areasLabel: "Данные на этом компьютере",
  shared: "Общее хранилище",
  folderKind: { config: "Настройки", state: "Данные", cache: "Кеш" },
  nothingStored: "Ничего не хранится",
  usedBy: (names) => `Используется в ${names}`,
  usedByKept: (names) => `Используется в ${names}. После удаления инструмента эти данные останутся`,
  leftBehind: "Осталось после удаления инструмента",
  openFolder: (kind, path) => `Открыть папку ${{ config: "настроек", state: "данных", cache: "кеша" }[kind]} ${path}`,
  openInFiles: "Открыть в файловом менеджере",
  showInFiles: "Показать в файловом менеджере",
  deleting: "Удаляем…",
  delete: "Удалить",
  measuringFolders: "Измеряем папки",
  whatIsHere: (n) => `Что здесь лежит (${n})`,
  keeps: (name) => `Что хранит ${name}`,
  credentials: "Учётные данные",
  notDescribed: "Без описания",
  openEntry: (name) => `Открыть ${name} в файловом менеджере`,
  entry: {
    sessions: "Сеансы входа. Учётные данные: показываем только размер, файл не открываем.",
    profiles: "Состояние входа каждого профиля. Учётные данные: показываем только размер, файлы не открываем.",
    googleClient: "Учётные данные приложения для входа в Google. Только размер, файл не открываем.",
    config: "Настройки, те, что показывает страница настроек",
    configCopy: "Прежняя копия настроек, сохранённая перед изменением",
    runs: "Журналы запусков, те, что показывает страница «Журнал»",
    backfill: "Задания синхронизации истории и докуда дошло каждое",
    sends: "Журнал всех попыток отправки, без текста сообщений",
    accounts: "Какой аккаунт у каждого профиля, чтобы читать без сети",
    pace: "Как часто каждый профиль может обращаться к мессенджеру",
    flood: "Запреты на отправку, которые мессенджер наложил на профили",
    serve: "Журналы и блокировки фонового сервера",
    bots: "Зарегистрированные боты и журналы их отправок",
    updateCheck: "Когда инструмент последний раз проверял новую версию",
    store: "Общее хранилище: сообщения, почта, документы, встречи",
    storeLog: "Часть базы данных рядом (журнал записи)",
    backups: "Резервные копии базы данных",
    models: "Модели для поиска, скачиваются один раз",
    driveStore: "Старое собственное хранилище Drive, из времён до общего хранилища",
    maxCache: "Старый кеш сообщений отдельного профиля, из времён до общего хранилища",
    folders: "Какие папки заметок читает memo и докуда дошёл",
    mailTrash: "Письма, перенесённые в корзину; хранятся, чтобы перенос можно было отменить",
    domainAges: "Запомненный возраст домена каждого отправителя писем",
    auto: "Когда memo последний раз синхронизировался сам",
    importLock: "Блокировка, оставшаяся после импорта",
  },
  confirmAll: "Удалить все оставшиеся данные WireCat?",
  confirmOne: (name) => `Удалить данные ${name}?`,
  keepIt: "Оставить",
  deleteSize: (size) => `Удалить ${size}`,
  deletedForGood: "Эти папки удаляются навсегда. Сообщения, сеансы и настройки в них восстановить не получится.",

  inStorage: "В хранилище",
  countedBy: (command, at) => (
    <>
      Посчитано командой {command}
      {at !== null && <> в {at}</>}
    </>
  ),
  schema: (n) => `схема ${n}`,
  readError: (error) => `Не удалось прочитать хранилище: ${error}`,
  noTool:
    "Установите инструмент WireCat, чтобы увидеть, что лежит в хранилище: его посчитает тот установленный инструмент, который знает самую новую схему.",
  notCreated: "Хранилище ещё не создано. Оно появится после первой синхронизации.",
  didNotOpen: (problem) => `Хранилище есть, но не открылось: ${problem}`,
  total: {
    messages: "Сообщения",
    chats: "Чаты",
    emails: "Письма",
    documents: "Документы",
    meetings: "Встречи",
    attachments: "Вложения",
    accounts: "Аккаунты",
  },
  breakDownBy: "Разбивка:",
  dimension: {
    provider: "Источник",
    chatKind: "Тип чата",
    account: "Аккаунт",
    year: "Год",
    attachment: "Файлы",
  },
  byDimension: {
    provider: "По источникам",
    chatKind: "По типам чатов",
    account: "По аккаунтам",
    year: "По годам",
    attachment: "По файлам",
  },
  nothingToBreak: "Пока нечего разбивать.",
  group: "Группа",
  share: "Доля",
  unitHeader: {
    provider: "Записи",
    chatKind: "Сообщения",
    account: "Записи",
    year: "Сообщения",
    attachment: "Файлы",
  },
  unit: (dim, n) =>
    dim === "provider" || dim === "account"
      ? ruForms(n, ["запись", "записи", "записей"])
      : dim === "attachment"
        ? ruForms(n, ["файл", "файла", "файлов"])
        : ruForms(n, ["сообщение", "сообщения", "сообщений"]),
  breakdownsLater: (tool) =>
    `Разбивка по источникам, типам чатов, аккаунтам и годам появится со следующим обновлением ${tool}.`,
  readingStorage: "Читаем хранилище",
  archiveWords: {
    count: counter("ru", ruCount),
    via: (command) => `через ${command}`,
    providers: { notes: "Заметки", chat: "Чат" },
    chatKinds: {
      dialog: "Личные",
      group: "Группы",
      channel: "Каналы",
      saved: "Избранное",
      unknown: "Неизвестный тип",
    },
    attachment: (kind, owner) => `${ruAttachment[kind] ?? capital(kind)} в ${ruOwner[owner] ?? owner}`,
  },

  storageFile: "Файл хранилища",
  fact: {
    file: "Файл",
    size: "Размер",
    journal: "Режим журнала",
    schema: "Схема",
    unused: "Свободное место",
    backup: "Последняя копия",
    health: "Состояние",
  },
  sizeWal: (file, wal) => (
    <>
      {file} и ещё {wal}, пока не перенесённые в него (журнал упреждающей записи)
    </>
  ),
  unusedSpace: (size, free, total) => (
    <>
      {size} в {ruForms(free, ["# свободной странице", "# свободных страницах", "# свободных страницах"])} из{" "}
      {formatNumber(total, "ru")}; очистка (VACUUM) вернёт это место
    </>
  ),
  migrations: (n) => `История миграций (${n})`,
  migrationsLabel: "История миграций",
  version: "Версия",
  applied: "Применена",
  readableFrom: "Читают инструменты начиная с",
  factsLater: (tool) =>
    `Режим журнала, свободное место, история миграций и последняя резервная копия появятся со следующим обновлением ${tool}.`,
  checkHealth: "Проверить состояние",
  readingPages: (time) => <>Читаем каждую страницу файла… {time}</>,
  checkFailed: (error) => `Проверка не завершилась: ${error}`,
  notChecked: "Ещё не проверялось. Проверка читает весь файл: минуту-две, если хранилище большое.",
  noProblems: "Проблем не найдено",
  problems: (n) => ruForms(n, ["Найдена # проблема", "Найдено # проблемы", "Найдено # проблем"]),
  checkedIn: (time) => `проверено за ${time}`,
  copyCommand: "Скопировать команду",
  duration: (ms) => duration(ms, "с", "мин"),
  databaseWords: {
    noBackup: "Рядом с файлом хранилища нет записи о резервной копии",
    backup: backupLine("ru", ruWhen),
    backupStale: (at, days, checked) =>
      `${backupLine("ru", ruWhen)(at, days, checked)}. С тех пор задание резервного копирования не завершалось`,
    schemaBehind: (speaks) =>
      `новые инструменты используют схему ${speaks}; хранилище перейдёт на неё, когда один из них что-нибудь запишет`,
    schemaAhead: "новее, чем знают некоторые установленные инструменты; обновите их на странице «Инструменты»",
    didNotOpen: (problem) => `Хранилище не открылось: ${problem}`,
    schemaOld: (schema, bin, speaks) =>
      `Хранилище на схеме ${schema}, а ${bin} знает схему ${speaks}. Сделайте резервную копию, затем обновите хранилище.`,
    schemaTooNew: (schema, needs, bin, speaks) =>
      `Хранилище на схеме ${schema}, ему нужен инструмент, который знает хотя бы схему ${needs ?? "—"}; ${bin} знает ${speaks}.`,
    damaged: (details) => `SQLite нашёл повреждения в файле: ${details}. Восстановите резервную копию.`,
    danglingRows: (n) =>
      ruForms(n, [
        "# строка ссылается на строку, которой нет.",
        "# строки ссылаются на строки, которых нет.",
        "# строк ссылаются на строки, которых нет.",
      ]),
    brokenIndexes: (n, names) =>
      `Повреждены поисковые индексы (${n}): ${names}. Пока их не перестроят, поиск может пропускать сообщения.`,
    lowDisk: (free, needed) =>
      `На диске свободно только ${free}; для резервной копии или очистки нужно около ${needed}.`,
    toolSuggests: "Инструмент предлагает:",
    chatsBehind: (n) =>
      ruForms(n, [
        "В # чате есть сообщения новее, чем в хранилище.",
        "В # чатах есть сообщения новее, чем в хранилище.",
        "В # чатах есть сообщения новее, чем в хранилище.",
      ]),
    orphans: (n) =>
      ruForms(n, [
        "# тег или ссылка указывает на удалённое.",
        "# тега или ссылки указывают на удалённое.",
        "# тегов или ссылок указывают на удалённое.",
      ]),
  },

  tables: "Таблицы",
  column: { name: "Таблица", kind: "Тип", rows: "Строки", bytes: "Размер" },
  tableKind: {
    data: "Данные",
    internal: "Служебная",
    search_index: "Поисковый индекс",
    search_index_part: "Часть поискового индекса",
  },
  listLater: (tool) => `Список таблиц появится со следующим обновлением ${tool}.`,
  listError: (error) => `Не удалось получить список таблиц: ${error}`,
  findTable: "Найти таблицу",
  noMatch: (query) => `Нет таблиц, в названии которых есть «${query}».`,
  searchTables: (n) => `Таблицы поисковых индексов (${n})`,
  searchTablesLabel: "Таблицы поисковых индексов",
  searchNote:
    "Строятся из данных выше, чтобы поиск работал быстро; при перестройке ничего не теряется. Строки в них не считаются: для этого пришлось бы прочитать каждый индекс целиком.",
  measure: "Измерить размеры",
  measureAgain: "Измерить снова",
  measuring: "Измеряем…",
  measureHint: "Читает весь файл: несколько секунд или несколько минут, если хранилище большое",
  measuredIn: (time) => <>Измерено за {time}</>,
  countingRows: "Считаем строки",
}

const esCount: Record<Counted, [string, string]> = {
  accounts: ["cuenta", "cuentas"],
  chats: ["chat", "chats"],
  messages: ["mensaje", "mensajes"],
  emails: ["correo", "correos"],
  documents: ["documento", "documentos"],
  meetings: ["reunión", "reuniones"],
}

const esAttachment: Record<string, string> = {
  photo: "Fotos",
  video: "Vídeos",
  document: "Documentos",
  voice: "Notas de voz",
  audio: "Audio",
  sticker: "Stickers",
}

const esOwner: Record<string, string> = {
  message: "mensajes",
  email: "correos",
  document: "documentos",
  meeting: "reuniones",
}

const esWhen = (days: number) =>
  days <= 0 ? "hoy" : days === 1 ? "ayer" : plural("es", days, { one: "hace # día", other: "hace # días" })

const es: typeof en = {
  title: "Almacenamiento",
  checking: "Comprobando…",
  intro:
    "Lo que las herramientas de WireCat guardan en este ordenador: ajustes, sesiones, almacenamiento compartido y cachés. Al desinstalar una herramienta, sus datos se conservan; cuando ninguna herramienta instalada los usa, puedes borrarlos aquí. Los tokens de inicio de sesión del llavero del sistema no se tocan.",
  deleteAll: "Borrar todos los datos sobrantes",
  areasLabel: "Datos en este ordenador",
  shared: "Almacenamiento compartido",
  folderKind: { config: "Ajustes", state: "Datos", cache: "Caché" },
  nothingStored: "No hay nada guardado",
  usedBy: (names) => `En uso por ${names}`,
  usedByKept: (names) => `En uso por ${names}. Al desinstalar, estos datos se conservan`,
  leftBehind: "Quedó tras desinstalar",
  openFolder: (kind, path) =>
    `Abrir la carpeta de ${{ config: "ajustes", state: "datos", cache: "caché" }[kind]} ${path}`,
  openInFiles: "Abrir en el gestor de archivos",
  showInFiles: "Mostrar en el gestor de archivos",
  deleting: "Borrando…",
  delete: "Borrar",
  measuringFolders: "Midiendo carpetas",
  whatIsHere: (n) => `Qué hay aquí (${n})`,
  keeps: (name) => `Qué guarda ${name}`,
  credentials: "Credenciales",
  notDescribed: "Sin descripción",
  openEntry: (name) => `Abrir ${name} en el gestor de archivos`,
  entry: {
    sessions: "Sesiones iniciadas. Credenciales: solo el tamaño, nunca se abren.",
    profiles: "Estado de inicio de sesión de cada perfil. Credenciales: solo el tamaño, nunca se abre.",
    googleClient: "Credenciales de la app de inicio de sesión de Google. Solo el tamaño, nunca se abren.",
    config: "Los ajustes que muestra la página de ajustes",
    configCopy: "Una copia anterior de los ajustes, guardada antes de un cambio",
    runs: "Registros de ejecución, los que muestra la página Registros",
    backfill: "Tareas de sincronización del historial y hasta dónde llegó cada una",
    sends: "Un registro de cada intento de envío, nunca el texto",
    accounts: "Qué cuenta es cada perfil, para leer sin conexión",
    pace: "Con qué frecuencia puede cada perfil consultar al servicio de mensajería",
    flood: "Bloqueos de envío que impuso el servicio de mensajería, por perfil",
    serve: "Registros y bloqueos del servidor en segundo plano",
    bots: "Bots registrados y sus registros de envío",
    updateCheck: "Cuándo buscó la herramienta una versión nueva por última vez",
    store: "Almacenamiento compartido: mensajes, correo, documentos, reuniones",
    storeLog: "Parte de la base de datos de al lado (registro de escritura)",
    backups: "Copias de seguridad de la base de datos",
    models: "Modelos de búsqueda, descargados una vez",
    driveStore: "El almacén antiguo propio de Drive, de antes del almacenamiento compartido",
    maxCache: "Una caché antigua de mensajes por perfil, de antes del almacenamiento compartido",
    folders: "Qué carpetas de notas lee memo y hasta dónde llegó",
    mailTrash: "Correo movido a la papelera, guardado para poder deshacerlo",
    domainAges: "La antigüedad del dominio de cada remitente, recordada",
    auto: "Cuándo se sincronizó memo por su cuenta por última vez",
    importLock: "Un bloqueo que dejó una importación",
  },
  confirmAll: "¿Borrar todos los datos sobrantes de WireCat?",
  confirmOne: (name) => `¿Borrar los datos de ${name}?`,
  keepIt: "Conservarlos",
  deleteSize: (size) => `Borrar ${size}`,
  deletedForGood:
    "Estas carpetas se borran para siempre. Los mensajes, sesiones y ajustes que contienen no se pueden recuperar.",

  inStorage: "En el almacenamiento",
  countedBy: (command, at) => (
    <>
      Contado por {command}
      {at !== null && <> a las {at}</>}
    </>
  ),
  schema: (n) => `esquema ${n}`,
  readError: (error) => `No se pudo leer el almacenamiento: ${error}`,
  noTool:
    "Instala una herramienta de WireCat para ver qué hay en el almacenamiento: lo cuenta la herramienta instalada que lee el esquema más reciente.",
  notCreated: "El almacenamiento aún no existe. Aparece tras la primera sincronización.",
  didNotOpen: (problem) => `El almacenamiento existe, pero no se abrió: ${problem}`,
  total: {
    messages: "Mensajes",
    chats: "Chats",
    emails: "Correos",
    documents: "Documentos",
    meetings: "Reuniones",
    attachments: "Adjuntos",
    accounts: "Cuentas",
  },
  breakDownBy: "Desglosar por",
  dimension: {
    provider: "Origen",
    chatKind: "Tipo de chat",
    account: "Cuenta",
    year: "Año",
    attachment: "Archivos",
  },
  byDimension: {
    provider: "Por origen",
    chatKind: "Por tipo de chat",
    account: "Por cuenta",
    year: "Por año",
    attachment: "Por archivos",
  },
  nothingToBreak: "Aún no hay nada que desglosar.",
  group: "Grupo",
  share: "Proporción",
  unitHeader: {
    provider: "Elementos",
    chatKind: "Mensajes",
    account: "Elementos",
    year: "Mensajes",
    attachment: "Archivos",
  },
  unit: (dim, n) =>
    dim === "provider" || dim === "account"
      ? plural("es", n, { one: "elemento", other: "elementos" })
      : dim === "attachment"
        ? plural("es", n, { one: "archivo", other: "archivos" })
        : plural("es", n, { one: "mensaje", other: "mensajes" }),
  breakdownsLater: (tool) =>
    `Los desgloses por origen, tipo de chat, cuenta y año llegan con la próxima actualización de ${tool}.`,
  readingStorage: "Leyendo el almacenamiento",
  archiveWords: {
    count: counter("es", esCount),
    via: (command) => `vía ${command}`,
    providers: { notes: "Notas", chat: "Chat" },
    chatKinds: {
      dialog: "Individuales",
      group: "Grupos",
      channel: "Canales",
      saved: "Mensajes guardados",
      unknown: "Tipo desconocido",
    },
    attachment: (kind, owner) => `${esAttachment[kind] ?? capital(kind)} en ${esOwner[owner] ?? owner}`,
  },

  storageFile: "Archivo del almacenamiento",
  fact: {
    file: "Archivo",
    size: "Tamaño",
    journal: "Modo de journal",
    schema: "Esquema",
    unused: "Espacio sin usar",
    backup: "Última copia",
    health: "Estado",
  },
  sizeWal: (file, wal) => (
    <>
      {file} y {wal} aún sin escribir en él (el registro de escritura anticipada)
    </>
  ),
  unusedSpace: (size, free, total) => (
    <>
      {size} en {plural("es", free, { one: "# página libre", other: "# páginas libres" })} de{" "}
      {formatNumber(total, "es")}; una limpieza (VACUUM) lo recuperaría
    </>
  ),
  migrations: (n) => `Historial de migraciones (${n})`,
  migrationsLabel: "Historial de migraciones",
  version: "Versión",
  applied: "Aplicada",
  readableFrom: "Legible por herramientas desde",
  factsLater: (tool) =>
    `El modo de journal, el espacio sin usar, el historial de migraciones y la última copia llegan con la próxima actualización de ${tool}.`,
  checkHealth: "Comprobar estado",
  readingPages: (time) => <>Leyendo cada página del archivo… {time}</>,
  checkFailed: (error) => `La comprobación no terminó: ${error}`,
  notChecked:
    "Aún no se ha comprobado. La comprobación lee todo el archivo: un minuto o dos si el almacenamiento es grande.",
  noProblems: "No se encontraron problemas",
  problems: (n) => plural("es", n, { one: "Se encontró # problema", other: "Se encontraron # problemas" }),
  checkedIn: (time) => `comprobado en ${time}`,
  copyCommand: "Copiar el comando",
  duration: (ms) => duration(ms, "s", "min"),
  databaseWords: {
    noBackup: "No hay ninguna copia registrada junto al archivo del almacenamiento",
    backup: backupLine("es", esWhen),
    backupStale: (at, days, checked) =>
      `${backupLine("es", esWhen)(at, days, checked)}. La tarea de copia no ha terminado desde entonces`,
    schemaBehind: (speaks) =>
      `las herramientas nuevas usan el ${speaks}; el almacenamiento pasará a él la próxima vez que una escriba`,
    schemaAhead: "más nuevo de lo que conocen algunas herramientas instaladas; actualízalas en la página Herramientas",
    didNotOpen: (problem) => `El almacenamiento no se abrió: ${problem}`,
    schemaOld: (schema, bin, speaks) =>
      `El almacenamiento está en el esquema ${schema}; ${bin} usa el ${speaks}. Haz una copia y luego actualízalo.`,
    schemaTooNew: (schema, needs, bin, speaks) =>
      `El almacenamiento está en el esquema ${schema} y necesita una herramienta que use al menos el ${needs ?? "—"}; ${bin} usa el ${speaks}.`,
    damaged: (details) => `SQLite encontró daños en el archivo: ${details}. Restaura una copia de seguridad.`,
    danglingRows: (n) =>
      plural("es", n, {
        one: "# fila apunta a una fila que no existe.",
        other: "# filas apuntan a filas que no existen.",
      }),
    brokenIndexes: (n, names) =>
      plural("es", n, {
        one: `Hay # índice de búsqueda dañado: ${names}. La búsqueda puede omitir mensajes hasta que se reconstruya.`,
        other: `Hay # índices de búsqueda dañados: ${names}. La búsqueda puede omitir mensajes hasta que se reconstruyan.`,
      }),
    lowDisk: (free, needed) =>
      `Solo quedan ${free} libres en el disco; una copia o una limpieza necesita unos ${needed}.`,
    toolSuggests: "La herramienta sugiere:",
    chatsBehind: (n) =>
      plural("es", n, {
        one: "# chat tiene mensajes más nuevos que los del almacenamiento.",
        other: "# chats tienen mensajes más nuevos que los del almacenamiento.",
      }),
    orphans: (n) =>
      plural("es", n, {
        one: "# etiqueta o enlace apunta a algo borrado.",
        other: "# etiquetas y enlaces apuntan a algo borrado.",
      }),
  },

  tables: "Tablas",
  column: { name: "Tabla", kind: "Tipo", rows: "Filas", bytes: "Tamaño" },
  tableKind: {
    data: "Datos",
    internal: "Interna",
    search_index: "Índice de búsqueda",
    search_index_part: "Parte de índice de búsqueda",
  },
  listLater: (tool) => `La lista de tablas llega con la próxima actualización de ${tool}.`,
  listError: (error) => `No se pudieron listar las tablas: ${error}`,
  findTable: "Buscar una tabla",
  noMatch: (query) => `Ningún nombre de tabla contiene «${query}».`,
  searchTables: (n) => `Tablas de índices de búsqueda (${n})`,
  searchTablesLabel: "Tablas de índices de búsqueda",
  searchNote:
    "Se construyen a partir de los datos de arriba para que la búsqueda sea rápida; reconstruirlas no pierde nada. Sus filas no se cuentan, porque habría que leer cada índice entero.",
  measure: "Medir tamaños",
  measureAgain: "Medir de nuevo",
  measuring: "Midiendo…",
  measureHint: "Lee todo el archivo: unos segundos, o unos minutos si el almacenamiento es grande",
  measuredIn: (time) => <>Medido en {time}</>,
  countingRows: "Contando filas",
}

export const storageMessages: Messages<typeof en> = { en, ru, es }
