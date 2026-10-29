import type { ReactNode } from "react"
import type { RangeId } from "@/domain/runs"
import { formatList, type Messages, plural } from "@/i18n"

const ruCount = (n: number, one: string, few: string, many: string) =>
  plural("ru", n, { one: `# ${one}`, few: `# ${few}`, many: `# ${many}`, other: `# ${few}` })
const ruWord = (n: number, one: string, few: string, many: string) => plural("ru", n, { one, few, many, other: few })

const enDays = (n: number) => plural("en", n, { one: "# day", other: "# days" })
const ruDays = (n: number) => ruCount(n, "день", "дня", "дней")
const esDays = (n: number) => plural("es", n, { one: "# día", other: "# días" })

/** Who started a run, as the command line's caption names it; each piece is a button or a value already. */
type StartedBy = { agent: ReactNode; client: string | null; via: string | null; session: ReactNode | null }

const en = {
  title: "Logs",
  intro:
    "What each tool recorded about its own runs. A tool keeps every run: successful ones for 7 days, failed ones for 30. A tool set to keep failed runs only, or one older than that, lists mostly failures by design; it does not mean everything is broken.",
  howToSearch: "How to search logs",
  live: "Live",
  liveStop: "Stop reading the runs every 5 seconds",
  liveStart: "Read the runs again every 5 seconds",
  reading: "Reading…",
  readAgain: "Read again",
  noLogs:
    "No installed tool keeps run logs yet. Telegram, MAX and WhatsApp do: install one on the Tools page, and its failed runs will show up here.",
  facets: "Facets",
  nothingRecorded:
    "Nothing recorded. An empty log means none of these tools has run lately, or failed if it keeps failed runs only.",
  noMatch: "No run matches this search in the chosen time range.",
  clearSearch: "Clear the search",
  clear: "Clear",
  lookAtAll: "Look at all loaded runs",
  newRuns: (n: number) => plural("en", n, { one: "# new run", other: "# new runs" }),
  showingConversations: (shown: number, total: number) => `Showing ${shown} of ${total} conversations`,
  showMore: "Show more",
  showingRuns: (shown: number, total: number) => `Showing ${shown} of ${total}`,
  showNMore: (n: number) => `Show ${n} more`,

  sources: "Where the runs come from",
  loadOlder: "Load older",
  late: (seconds: number, shown: boolean) =>
    shown ? `did not answer in ${seconds} s, showing its last answer` : `did not answer in ${seconds} s`,
  keepsNoLogs: "keeps no run logs yet",
  notInstalled: "not installed",
  withNextUpdate: (tool: string) => `arrives with the next update of ${tool}`,
  couldNotBeRead: "could not be read",
  runCount: (n: number, more: boolean) => (more ? `${n}+ runs` : plural("en", n, { one: "# run", other: "# runs" })),
  readingOlder: (runs: string) => `${runs}, reading older…`,
  readingShort: "reading…",
  toolsRead: "Tools read",
  toolsDone: (done: number, total: number, reading: string[]) =>
    `${done} of ${total} tools done, reading ${formatList(reading, "en")}…`,
  loadingRuns: "Loading runs",

  matches: (n: number, count: ReactNode): ReactNode => (
    <>
      {count} {plural("en", n, { one: "run matches", other: "runs match" })}
    </>
  ),
  matchesInConversations: (n: number, count: ReactNode, groups: number): ReactNode => (
    <>
      {count} {plural("en", n, { one: "run matches", other: "runs match" })},{" "}
      {plural("en", groups, { one: "in # conversation", other: "in # conversations" })}
    </>
  ),
  matchesInGroups: (n: number, count: ReactNode, groups: number): ReactNode => (
    <>
      {count} {plural("en", n, { one: "run matches", other: "runs match" })},{" "}
      {plural("en", groups, { one: "in # group", other: "in # groups" })}
    </>
  ),
  over: (total: number, since: string | null, failed: number) =>
    `over the last ${plural("en", total, { one: "# kept run", other: "# kept runs" })}${since ? ` since ${since}` : ""}; ${failed} of them failed`,
  bareHidden: (n: number) =>
    plural("en", n, { one: "# run with no command hidden", other: "# runs with no command hidden" }),
  showThem: "Show them",
  stillReading: (tools: string[]) => `still reading ${formatList(tools, "en")}`,
  readingTools: (done: number, asked: number) => `Reading ${done} of ${asked} tools…`,
  updated: (ago: string) => `Updated ${ago}`,

  timeRange: "Time range",
  ranges: { "1h": "Last 1h", "24h": "Last 24h", "7d": "Last 7d", "30d": "Last 30d", all: "All" } as Record<
    RangeId,
    string
  >,
  groupBy: "Group by",
  nothing: "Nothing",

  fields: {
    tool: "Tool",
    status: "Status",
    cli_command: "Command",
    command: "Subcommand",
    error_code: "Error code",
    profile: "Profile",
    agent: "Agent",
    session_id: "Agent session",
    via: "Started through",
    client: "App",
    connection: "MCP connection",
    trace_id: "Trace",
    conversation: "Conversation",
    "error.class": "Error class",
    "error.http.status": "HTTP status",
    cli_version: "Version",
  } as Record<string, string>,
  fieldHint: "field",
  via: {
    cli: "Terminal",
    "mcp-stdio": "MCP on this computer",
    "mcp-http": "MCP over the internet",
    desktop: "WireCat Desktop",
  } as Record<string, string>,
  mcpApp: "MCP app",
  statuses: { success: "Succeeded", failed: "Failed", partial: "Partial", running: "Running" } as Record<
    string,
    string
  >,

  countsOver: (n: number) =>
    `Counts over ${plural("en", n, { one: "# run", other: "# runs" })} in range. Click to keep a value, Alt-click to hide it.`,
  stopGroupingBy: (label: string) => `Stop grouping by ${label}`,
  groupByField: (label: string) => `Group by ${label}`,
  stopGrouping: "Stop grouping",
  groupByThis: "Group by this field",
  noValues: "No values",
  showAll: (n: number) => `Show all ${n}`,
  showFewer: "Show fewer",
  withoutField: "Runs without this field",
  stopKeeping: (value: string) => `Stop keeping ${value}`,
  keepOnly: (value: string) => `Keep only ${value}`,
  showAgainValue: (value: string) => `Show ${value} again`,
  hideValue: (value: string) => `Hide ${value}`,
  showAgain: "Show again",
  hideThese: "Hide these runs",
  none: "none",
  noCommand: "(no command)",
  noCommandTyped: (typed: ReactNode): ReactNode => <>(no command {typed})</>,
  commandLabel: (command: string) => `${command} (no command)`,
  bareHint: "The tool was started without a known command — often a typo or a missing profile.",
  didNotKnow: (typed: string) => `It did not know "${typed}".`,

  share: "Share",
  runs: "Runs",
  failed: "Failed",
  latest: "Latest",
  showOnly: (value: string) => `Show only ${value}`,

  onlySession: (id: string) => `Only runs of session ${id}`,
  onlyStartedBy: (name: string) => `Only runs ${name} started`,
  notInConversation: "Not in a conversation",
  session: (id: string) => `session ${id}`,
  from: (when: string) => `from ${when}`,
  runsN: (n: number) => plural("en", n, { one: "# run", other: "# runs" }),
  failedN: (n: number) => `${n} failed`,
  conversationLabel: (title: string, session: string | null) => (session ? `${title}, session ${session}` : title),
  showRun: (command: string, when: string) => `Show run ${command} at ${when}`,
  hideRun: (command: string, when: string) => `Hide run ${command} at ${when}`,
  details: "Details",
  time: "Time",
  newestFirst: "Newest first",
  oldestFirst: "Oldest first",
  tool: "Tool",
  profile: "Profile",
  command: "Command",
  agent: "Agent",
  status: "Status",
  took: "Took",
  errorCode: "Error code",

  // What cli-core's log events mean (cli-core src/runs/log-events.ts), worded for the owner.
  events: {
    "provider.request": "A request went to the service",
    "provider.response": "The service answered the request, or it failed",
    "client.warning": "The tool noticed something unexpected and went on",
    "cache.answered": "Answered from what the tool already kept, without asking the service",
    "command.crashed": "The command failed on a bug in the tool",
    "send.recorded": "A message the tool sent, and how it ended",
    "job.start": "A background job started",
    "job.exit": "A background job ended",
    "schedule.start": "A scheduled run started",
    "schedule.exit": "A scheduled run ended",
    "agent.action": "One action an AI agent asked the tool for",
    "events.dropped": "The run had more steps than the tool keeps; it counted the rest without keeping them",
  } as Record<string, string>,
  succeededSummary: "The run succeeded, and for a success the tool keeps only this summary, not its steps.",
  stoppedBefore: (service: string) => `The tool stopped before contacting ${service}, so there are no steps to show.`,
  requestsNotLogged: (n: number, service: string) =>
    `The tool made ${plural("en", n, { one: "# request", other: "# requests" })} to ${service} but did not log them as steps.`,
  noStepsLogged: "The tool logged no steps for this run.",
  recordBelow: "The record below is everything the tool kept about this run.",
  copyRunId: "Copy run id",
  steps: "Steps",
  stepsHeading: (count: number | null, dropped: number | null) =>
    `Steps${count === null ? "" : ` · ${count}`}${dropped ? `, ${dropped} more not kept` : ""}`,
  stepsHelp: (service: string) =>
    `Each request the tool sent to ${service} (→) and its answer (←), plus notable moments: a warning, an answer from what it already kept, a crash. A retry and the wait before it are marked.`,
  readingRun: "Reading this run",
  couldNotReadRun: (error: string) => `Could not read this run: ${error}`,
  runRecord: "Run record",
  copyJson: "Copy JSON",
  copyRunJson: "Copy the run as JSON",
  commandLine: "Command line",
  copyCommandLine: "Copy the command line",
  startedBy: ({ agent, client, via, session }: StartedBy): ReactNode => (
    <>
      Started by {agent}
      {client && <> through {client}</>}
      {via && <> ({via})</>}
      {session && <> in session {session}</>}.
    </>
  ),
  masked: "The tool masked every value that could be message text or personal data.",
  onlyThisSession: "Show only this session's runs",
  requests: (n: number) => plural("en", n, { one: "# request", other: "# requests" }),
  step: "Step",
  outcome: "Outcome",
  stepDetails: (n: number) => `Step ${n} details`,
  stepN: (n: number) => `Step ${n}`,
  droppedSteps: (n: number | null) =>
    n === null
      ? "Some more steps not kept"
      : plural("en", n, { one: "# more step not kept", other: "# more steps not kept" }),
  retry: (n: number) => `retry ${n}`,
  waited: (took: string) => `waited ${took}`,

  whatWentWrong: "What went wrong",
  request: "Request",
  httpStatus: "HTTP status",
  operation: "Operation",
  serviceRefused: "Service refused",
  code: (code: number) => `code ${code}`,
  causedBy: "Caused by",
  causes: "Causes",
  whereInTool: (frames: number) => `Where in the tool · ${plural("en", frames, { one: "# frame", other: "# frames" })}`,

  items: (n: number) => plural("en", n, { one: "# item", other: "# items" }),
  filterBy: (term: string) => `Filter by ${term}`,
  exclude: (term: string) => `Exclude ${term}`,
  copyValue: "Copy value",
  copied: "Copied",

  searchRuns: "Search runs",
  placeholder: "status:failed command:sync* -profile:work timeout",
  suggestions: "Suggestions",
  searchHint: "field:value to filter, * matches anything, a leading - excludes. Two values of one field match either.",
  searchSyntax: "Search syntax",
  unclosedQuote: "A quote is not closed.",
  needsValue: (field: string) => `${field}: needs a value, like ${field}:something.`,
  notANumber: (op: string, value: string) => `${op} compares numbers; "${value}" is not one.`,
  unknownField: (field: string) => `No run has a field named ${field}.`,

  keepingRegion: "Which runs each tool keeps",
  keepingHeading: "Runs each tool keeps",
  readingKeeping: "Reading which runs each tool keeps",
  whichRuns: (tool: string) => `Which ${tool} runs to keep`,
  refused: (tool: string, error: string) => `${tool} refused the change: ${error}`,
  askEvery: (tool: string) => `Keep every ${tool} run?`,
  askFailedOnly: (tool: string) => `Stop keeping successful ${tool} runs?`,
  leaveIt: "Leave it as it is",
  keepEvery: "Keep every run",
  keepFailedOnly: "Keep failed runs only",
  choiceFailed: "Failed runs only",
  choiceEvery: "Every run",
  /** What a tool keeps, as the object of "it keeps …"; null days: the tool did not say how long. */
  periodsEvery: (days: number | null) => `every run${days === null ? "" : ` for ${enDays(days)}`}`,
  periodsSplit: (success: number | null, failed: number | null) =>
    `successful runs${success === null ? "" : ` for ${enDays(success)}`}, failed runs${failed === null ? "" : ` for ${enDays(failed)}`}`,
  chipReading: (tool: string) => `${tool} is reading its settings`,
  chipError: (tool: string, error: string) => `${tool} could not say whether it keeps successful runs: ${error}`,
  chipKeeps: (tool: string, periods: string) => `${tool} keeps ${periods}`,
  chipFailedOnly: (tool: string, days: number | null) =>
    `${tool} keeps failed runs only${days === null ? "" : ` for ${enDays(days)}`}`,
  chipRefused: (error: string) => `The tool refused the change: ${error}`,
  noRecordSetting: "The tool does not report a record setting.",
  howUnset: (command: ReactNode): ReactNode => (
    <>This runs {command}, which puts the setting back to the tool's default.</>
  ),
  howSet: (command: ReactNode, tool: string): ReactNode => (
    <>
      This sets {command}, the default for every {tool} profile.
    </>
  ),
  everyBody: (tool: string, periods: string) =>
    `From now on ${tool} records every run, also the ones that succeed: it keeps ${periods}, then removes them. Until then every run takes disk space in the tool's own folder.`,
  everyProfiles: (record: ReactNode): ReactNode => (
    <>
      A profile that sets {record} itself keeps its own choice; change that on the Settings page. Runs that already
      ended are not recovered.
    </>
  ),
  failedOnlyBody: (tool: string, days: number | null, successDays: number | null) =>
    `From now on ${tool} keeps a run only when it fails${days === null ? "" : ` for ${enDays(days)}`}. Successful runs it already kept stay until the tool removes old runs${successDays !== null ? `, after ${enDays(successDays)}` : days !== null ? `, after ${enDays(days)}` : ""}.`,
  failedOnlyProfiles: (record: ReactNode): ReactNode => <>A profile that sets {record} itself keeps its own choice.</>,
}

const ru: typeof en = {
  title: "Журнал",
  intro:
    "Что каждый инструмент записал о своих запусках. Инструмент хранит каждый запуск: успешные — 7 дней, неудачные — 30. Если инструмент настроен хранить только неудачные запуски или его версия старше, в списке будут в основном ошибки. Так и задумано, это не значит, что всё сломано.",
  howToSearch: "Как искать в журнале",
  live: "В реальном времени",
  liveStop: "Перестать читать запуски каждые 5 секунд",
  liveStart: "Читать запуски заново каждые 5 секунд",
  reading: "Читаем…",
  readAgain: "Прочитать заново",
  noLogs:
    "Ни один установленный инструмент пока не ведёт журнал запусков. Telegram, MAX и WhatsApp ведут: установите один из них на странице «Инструменты», и его неудачные запуски появятся здесь.",
  facets: "Фильтры",
  nothingRecorded:
    "Ничего не записано. Пустой журнал значит, что эти инструменты давно не запускались, или не было ошибок, если инструмент хранит только неудачные запуски.",
  noMatch: "За выбранный период ни один запуск не подходит под этот поиск.",
  clearSearch: "Очистить поиск",
  clear: "Очистить",
  lookAtAll: "Посмотреть все загруженные запуски",
  newRuns: (n) =>
    plural("ru", n, {
      one: "# новый запуск",
      few: "# новых запуска",
      many: "# новых запусков",
      other: "# новых запуска",
    }),
  showingConversations: (shown, total) =>
    `Показано ${shown} ${plural("ru", total, { one: "из # разговора", few: "из # разговоров", many: "из # разговоров", other: "из # разговора" })}`,
  showMore: "Показать ещё",
  showingRuns: (shown, total) => `Показано ${shown} из ${total}`,
  showNMore: (n) => `Показать ещё ${n}`,

  sources: "Откуда взяты запуски",
  loadOlder: "Загрузить старые",
  late: (seconds, shown) =>
    shown ? `не ответил за ${seconds} с, показан его прошлый ответ` : `не ответил за ${seconds} с`,
  keepsNoLogs: "пока не ведёт журнал запусков",
  notInstalled: "не установлен",
  withNextUpdate: (tool) => `появится со следующим обновлением ${tool}`,
  couldNotBeRead: "не удалось прочитать",
  runCount: (n, more) => (more ? `${n}+ запусков` : ruCount(n, "запуск", "запуска", "запусков")),
  readingOlder: (runs) => `${runs}, читаем старые…`,
  readingShort: "читаем…",
  toolsRead: "Прочитано инструментов",
  toolsDone: (done, total, reading) => `Готово ${done} из ${total}, читаем ${formatList(reading, "ru")}…`,
  loadingRuns: "Загружаем запуски",

  matches: (n, count) => (
    <>
      {ruWord(n, "Подходит", "Подходят", "Подходят")} {count} {ruWord(n, "запуск", "запуска", "запусков")}
    </>
  ),
  matchesInConversations: (n, count, groups) => (
    <>
      {ruWord(n, "Подходит", "Подходят", "Подходят")} {count} {ruWord(n, "запуск", "запуска", "запусков")},{" "}
      {plural("ru", groups, {
        one: "в # разговоре",
        few: "в # разговорах",
        many: "в # разговорах",
        other: "в # разговорах",
      })}
    </>
  ),
  matchesInGroups: (n, count, groups) => (
    <>
      {ruWord(n, "Подходит", "Подходят", "Подходят")} {count} {ruWord(n, "запуск", "запуска", "запусков")},{" "}
      {plural("ru", groups, { one: "в # группе", few: "в # группах", many: "в # группах", other: "в # группах" })}
    </>
  ),
  over: (total, since, failed) =>
    `из ${plural("ru", total, { one: "# последнего сохранённого запуска", few: "# последних сохранённых запусков", many: "# последних сохранённых запусков", other: "# последних сохранённых запусков" })}${since ? ` с ${since}` : ""}; из них с ошибкой: ${failed}`,
  bareHidden: (n) =>
    plural("ru", n, {
      one: "# запуск без команды скрыт",
      few: "# запуска без команды скрыты",
      many: "# запусков без команды скрыты",
      other: "# запуска без команды скрыты",
    }),
  showThem: "Показать",
  stillReading: (tools) => `ещё читаем ${formatList(tools, "ru")}`,
  readingTools: (done, asked) => `Прочитано ${done} из ${asked}…`,
  updated: (ago) => `Обновлено ${ago}`,

  timeRange: "Период",
  ranges: { "1h": "За 1 ч", "24h": "За 24 ч", "7d": "За 7 дн.", "30d": "За 30 дн.", all: "Всё" },
  groupBy: "Группировка",
  nothing: "Без группировки",

  fields: {
    tool: "Инструмент",
    status: "Статус",
    cli_command: "Команда",
    command: "Подкоманда",
    error_code: "Код ошибки",
    profile: "Профиль",
    agent: "Агент",
    session_id: "Сеанс агента",
    via: "Как запущен",
    client: "Приложение",
    connection: "MCP-подключение",
    trace_id: "Трассировка",
    conversation: "Разговор",
    "error.class": "Класс ошибки",
    "error.http.status": "HTTP-статус",
    cli_version: "Версия",
  },
  fieldHint: "поле",
  via: {
    cli: "Терминал",
    "mcp-stdio": "MCP на этом компьютере",
    "mcp-http": "MCP через интернет",
    desktop: "WireCat Desktop",
  },
  mcpApp: "MCP-приложение",
  statuses: { success: "Успешно", failed: "Ошибка", partial: "Частично", running: "Идёт" },

  countsOver: (n) =>
    `Подсчёт по ${plural("ru", n, { one: "# запуску", few: "# запускам", many: "# запускам", other: "# запускам" })} за период. Нажмите, чтобы оставить значение, Alt+нажатие — чтобы скрыть.`,
  stopGroupingBy: (label) => `Не группировать по полю «${label}»`,
  groupByField: (label) => `Группировать по полю «${label}»`,
  stopGrouping: "Не группировать",
  groupByThis: "Группировать по этому полю",
  noValues: "Нет значений",
  showAll: (n) => `Показать все ${n}`,
  showFewer: "Показать меньше",
  withoutField: "Запуски без этого поля",
  stopKeeping: (value) => `Не оставлять только ${value}`,
  keepOnly: (value) => `Оставить только ${value}`,
  showAgainValue: (value) => `Снова показать ${value}`,
  hideValue: (value) => `Скрыть ${value}`,
  showAgain: "Снова показать",
  hideThese: "Скрыть эти запуски",
  none: "нет",
  noCommand: "(без команды)",
  noCommandTyped: (typed) => <>(без команды {typed})</>,
  commandLabel: (command) => `${command} (без команды)`,
  bareHint: "Инструмент запустили без известной ему команды — обычно это опечатка или не указан профиль.",
  didNotKnow: (typed) => `Он не знает «${typed}».`,

  share: "Доля",
  runs: "Запуски",
  failed: "С ошибкой",
  latest: "Последний",
  showOnly: (value) => `Показать только ${value}`,

  onlySession: (id) => `Только запуски сеанса ${id}`,
  onlyStartedBy: (name) => `Только запуски, которые начал ${name}`,
  notInConversation: "Вне разговора",
  session: (id) => `сеанс ${id}`,
  from: (when) => `с ${when}`,
  runsN: (n) => ruCount(n, "запуск", "запуска", "запусков"),
  failedN: (n) => `с ошибкой: ${n}`,
  conversationLabel: (title, session) => (session ? `${title}, сеанс ${session}` : title),
  showRun: (command, when) => `Показать запуск ${command} в ${when}`,
  hideRun: (command, when) => `Скрыть запуск ${command} в ${when}`,
  details: "Подробности",
  time: "Время",
  newestFirst: "Сначала новые",
  oldestFirst: "Сначала старые",
  tool: "Инструмент",
  profile: "Профиль",
  command: "Команда",
  agent: "Агент",
  status: "Статус",
  took: "Заняло",
  errorCode: "Код ошибки",

  events: {
    "provider.request": "Запрос ушёл в сервис",
    "provider.response": "Сервис ответил на запрос, или запрос не удался",
    "client.warning": "Инструмент заметил что-то неожиданное и продолжил",
    "cache.answered": "Ответ из того, что инструмент уже сохранил, без запроса к сервису",
    "command.crashed": "Команда упала из-за ошибки в инструменте",
    "send.recorded": "Сообщение, которое отправил инструмент, и чем это закончилось",
    "job.start": "Фоновая задача началась",
    "job.exit": "Фоновая задача закончилась",
    "schedule.start": "Запуск по расписанию начался",
    "schedule.exit": "Запуск по расписанию закончился",
    "agent.action": "Одно действие, которое ИИ-агент попросил у инструмента",
    "events.dropped": "Шагов было больше, чем инструмент хранит; остальные он посчитал, но не сохранил",
  },
  succeededSummary: "Запуск прошёл успешно, а для успешных запусков инструмент хранит только эту сводку, без шагов.",
  stoppedBefore: (service) => `Инструмент остановился до обращения к ${service}, поэтому шагов нет.`,
  requestsNotLogged: (n, service) =>
    `Инструмент отправил ${ruCount(n, "запрос", "запроса", "запросов")} в ${service}, но не записал их как шаги.`,
  noStepsLogged: "Инструмент не записал ни одного шага этого запуска.",
  recordBelow: "Ниже — всё, что инструмент сохранил об этом запуске.",
  copyRunId: "Скопировать id запуска",
  steps: "Шаги",
  stepsHeading: (count, dropped) =>
    `Шаги${count === null ? "" : ` · ${count}`}${dropped ? `, ещё ${dropped} не сохранено` : ""}`,
  stepsHelp: (service) =>
    `Каждый запрос инструмента к ${service} (→) и ответ на него (←), а также важные моменты: предупреждение, ответ из сохранённого, сбой. Повторы и ожидание перед ними отмечены.`,
  readingRun: "Читаем этот запуск",
  couldNotReadRun: (error) => `Не удалось прочитать этот запуск: ${error}`,
  runRecord: "Запись запуска",
  copyJson: "Скопировать JSON",
  copyRunJson: "Скопировать запуск как JSON",
  commandLine: "Командная строка",
  copyCommandLine: "Скопировать командную строку",
  startedBy: ({ agent, client, via, session }) => (
    <>
      Запустил {agent}
      {client && <> через {client}</>}
      {via && <> ({via})</>}
      {session && <> в сеансе {session}</>}.
    </>
  ),
  masked: "Инструмент скрыл все значения, в которых может быть текст сообщений или личные данные.",
  onlyThisSession: "Показать только запуски этого сеанса",
  requests: (n) => ruCount(n, "запрос", "запроса", "запросов"),
  step: "Шаг",
  outcome: "Итог",
  stepDetails: (n) => `Подробности шага ${n}`,
  stepN: (n) => `Шаг ${n}`,
  droppedSteps: (n) =>
    n === null
      ? "Ещё несколько шагов не сохранено"
      : plural("ru", n, {
          one: "Ещё # шаг не сохранён",
          few: "Ещё # шага не сохранено",
          many: "Ещё # шагов не сохранено",
          other: "Ещё # шага не сохранено",
        }),
  retry: (n) => `повтор ${n}`,
  waited: (took) => `ждал ${took}`,

  whatWentWrong: "Что пошло не так",
  request: "Запрос",
  httpStatus: "HTTP-статус",
  operation: "Операция",
  serviceRefused: "Сервис отказал",
  code: (code) => `код ${code}`,
  causedBy: "Причина",
  causes: "Причины",
  whereInTool: (frames) => `Где в инструменте · ${ruCount(frames, "кадр", "кадра", "кадров")}`,

  items: (n) => ruCount(n, "элемент", "элемента", "элементов"),
  filterBy: (term) => `Фильтровать по ${term}`,
  exclude: (term) => `Исключить ${term}`,
  copyValue: "Скопировать значение",
  copied: "Скопировано",

  searchRuns: "Поиск по запускам",
  placeholder: "status:failed command:sync* -profile:work timeout",
  suggestions: "Подсказки",
  searchHint:
    "поле:значение — фильтр, * — что угодно, минус в начале исключает. Два значения одного поля — подходит любое из них.",
  searchSyntax: "Синтаксис поиска",
  unclosedQuote: "Кавычка не закрыта.",
  needsValue: (field) => `После ${field}: нужно значение, например ${field}:что-то.`,
  notANumber: (op, value) => `${op} сравнивает числа, а «${value}» — не число.`,
  unknownField: (field) => `Ни у одного запуска нет поля ${field}.`,

  keepingRegion: "Какие запуски хранит каждый инструмент",
  keepingHeading: "Какие запуски хранятся",
  readingKeeping: "Читаем, какие запуски хранит каждый инструмент",
  whichRuns: (tool) => `Какие запуски ${tool} хранить`,
  refused: (tool, error) => `${tool} не принял изменение: ${error}`,
  askEvery: (tool) => `Хранить каждый запуск ${tool}?`,
  askFailedOnly: (tool) => `Перестать хранить успешные запуски ${tool}?`,
  leaveIt: "Оставить как есть",
  keepEvery: "Хранить каждый запуск",
  keepFailedOnly: "Хранить только неудачные",
  choiceFailed: "Только неудачные",
  choiceEvery: "Все запуски",
  periodsEvery: (days) => `каждый запуск${days === null ? "" : ` ${ruDays(days)}`}`,
  periodsSplit: (success, failed) =>
    `успешные запуски${success === null ? "" : ` ${ruDays(success)}`}, неудачные${failed === null ? "" : ` ${ruDays(failed)}`}`,
  chipReading: (tool) => `${tool} читает свои настройки`,
  chipError: (tool, error) => `${tool} не смог сказать, хранит ли он успешные запуски: ${error}`,
  chipKeeps: (tool, periods) => `${tool} хранит ${periods}`,
  chipFailedOnly: (tool, days) => `${tool} хранит только неудачные запуски${days === null ? "" : ` ${ruDays(days)}`}`,
  chipRefused: (error) => `Инструмент не принял изменение: ${error}`,
  noRecordSetting: "Инструмент не сообщает настройку record.",
  howUnset: (command) => <>Будет выполнена команда {command}, она вернёт настройке значение по умолчанию.</>,
  howSet: (command, tool) => (
    <>
      Будет выполнена команда {command}: это значение по умолчанию для всех профилей {tool}.
    </>
  ),
  everyBody: (tool, periods) =>
    `С этого момента ${tool} записывает каждый запуск, в том числе успешные: он хранит ${periods}, затем удаляет их. Всё это время каждый запуск занимает место на диске в папке инструмента.`,
  everyProfiles: (record) => (
    <>
      Профиль, в котором {record} задан отдельно, сохранит свой выбор; его можно изменить на странице «Настройки».
      Запуски, которые уже закончились, не восстановятся.
    </>
  ),
  failedOnlyBody: (tool, days, successDays) =>
    `С этого момента ${tool} хранит запуск, только если он закончился ошибкой${days === null ? "" : `, ${ruDays(days)}`}. Уже сохранённые успешные запуски останутся, пока инструмент не удалит старые${successDays !== null ? `, через ${ruDays(successDays)}` : days !== null ? `, через ${ruDays(days)}` : ""}.`,
  failedOnlyProfiles: (record) => <>Профиль, в котором {record} задан отдельно, сохранит свой выбор.</>,
}

const es: typeof en = {
  title: "Registros",
  intro:
    "Lo que cada herramienta ha registrado de sus propias ejecuciones. Una herramienta guarda cada ejecución: las correctas durante 7 días y las fallidas durante 30. Si una herramienta está configurada para guardar solo las fallidas, o es más antigua, verás sobre todo fallos. Es así a propósito; no significa que todo esté roto.",
  howToSearch: "Cómo buscar en los registros",
  live: "En directo",
  liveStop: "Dejar de leer las ejecuciones cada 5 segundos",
  liveStart: "Volver a leer las ejecuciones cada 5 segundos",
  reading: "Leyendo…",
  readAgain: "Volver a leer",
  noLogs:
    "Ninguna herramienta instalada guarda registros de ejecución todavía. Telegram, MAX y WhatsApp sí: instala una en la página Herramientas y sus ejecuciones fallidas aparecerán aquí.",
  facets: "Filtros",
  nothingRecorded:
    "No hay nada registrado. Un registro vacío significa que ninguna de estas herramientas se ha ejecutado últimamente, o que no ha fallado si solo guarda las ejecuciones fallidas.",
  noMatch: "Ninguna ejecución coincide con esta búsqueda en el periodo elegido.",
  clearSearch: "Borrar la búsqueda",
  clear: "Borrar",
  lookAtAll: "Ver todas las ejecuciones cargadas",
  newRuns: (n) => plural("es", n, { one: "# ejecución nueva", other: "# ejecuciones nuevas" }),
  showingConversations: (shown, total) =>
    `Mostrando ${shown} de ${plural("es", total, { one: "# conversación", other: "# conversaciones" })}`,
  showMore: "Mostrar más",
  showingRuns: (shown, total) => `Mostrando ${shown} de ${total}`,
  showNMore: (n) => `Mostrar ${n} más`,

  sources: "De dónde vienen las ejecuciones",
  loadOlder: "Cargar anteriores",
  late: (seconds, shown) =>
    shown ? `no respondió en ${seconds} s, se muestra su última respuesta` : `no respondió en ${seconds} s`,
  keepsNoLogs: "aún no guarda registros de ejecución",
  notInstalled: "no instalada",
  withNextUpdate: (tool) => `llega con la próxima actualización de ${tool}`,
  couldNotBeRead: "no se pudo leer",
  runCount: (n, more) => (more ? `${n}+ ejecuciones` : plural("es", n, { one: "# ejecución", other: "# ejecuciones" })),
  readingOlder: (runs) => `${runs}, leyendo anteriores…`,
  readingShort: "leyendo…",
  toolsRead: "Herramientas leídas",
  toolsDone: (done, total, reading) => `${done} de ${total} herramientas listas, leyendo ${formatList(reading, "es")}…`,
  loadingRuns: "Cargando ejecuciones",

  matches: (n, count) => (
    <>
      {plural("es", n, { one: "Coincide", other: "Coinciden" })} {count}{" "}
      {plural("es", n, { one: "ejecución", other: "ejecuciones" })}
    </>
  ),
  matchesInConversations: (n, count, groups) => (
    <>
      {plural("es", n, { one: "Coincide", other: "Coinciden" })} {count}{" "}
      {plural("es", n, { one: "ejecución", other: "ejecuciones" })},{" "}
      {plural("es", groups, { one: "en # conversación", other: "en # conversaciones" })}
    </>
  ),
  matchesInGroups: (n, count, groups) => (
    <>
      {plural("es", n, { one: "Coincide", other: "Coinciden" })} {count}{" "}
      {plural("es", n, { one: "ejecución", other: "ejecuciones" })},{" "}
      {plural("es", groups, { one: "en # grupo", other: "en # grupos" })}
    </>
  ),
  over: (total, since, failed) =>
    `de ${plural("es", total, { one: "la última ejecución guardada", other: "las últimas # ejecuciones guardadas" })}${since ? ` desde el ${since}` : ""}; ${plural("es", failed, { one: "# falló", other: "# fallaron" })}`,
  bareHidden: (n) =>
    plural("es", n, { one: "# ejecución sin comando oculta", other: "# ejecuciones sin comando ocultas" }),
  showThem: "Mostrarlas",
  stillReading: (tools) => `todavía leyendo ${formatList(tools, "es")}`,
  readingTools: (done, asked) => `Leyendo ${done} de ${asked} herramientas…`,
  updated: (ago) => `Actualizado ${ago}`,

  timeRange: "Periodo",
  ranges: { "1h": "Última 1 h", "24h": "Últimas 24 h", "7d": "Últimos 7 d", "30d": "Últimos 30 d", all: "Todo" },
  groupBy: "Agrupar por",
  nothing: "Nada",

  fields: {
    tool: "Herramienta",
    status: "Estado",
    cli_command: "Comando",
    command: "Subcomando",
    error_code: "Código de error",
    profile: "Perfil",
    agent: "Agente",
    session_id: "Sesión del agente",
    via: "Iniciada desde",
    client: "App",
    connection: "Conexión MCP",
    trace_id: "Traza",
    conversation: "Conversación",
    "error.class": "Clase de error",
    "error.http.status": "Estado HTTP",
    cli_version: "Versión",
  },
  fieldHint: "campo",
  via: {
    cli: "Terminal",
    "mcp-stdio": "MCP en este ordenador",
    "mcp-http": "MCP por internet",
    desktop: "WireCat Desktop",
  },
  mcpApp: "App MCP",
  statuses: { success: "Correcta", failed: "Fallida", partial: "Parcial", running: "En curso" },

  countsOver: (n) =>
    `Recuentos sobre ${plural("es", n, { one: "# ejecución", other: "# ejecuciones" })} del periodo. Haz clic para quedarte con un valor y Alt+clic para ocultarlo.`,
  stopGroupingBy: (label) => `Dejar de agrupar por ${label}`,
  groupByField: (label) => `Agrupar por ${label}`,
  stopGrouping: "Dejar de agrupar",
  groupByThis: "Agrupar por este campo",
  noValues: "Sin valores",
  showAll: (n) => `Mostrar los ${n}`,
  showFewer: "Mostrar menos",
  withoutField: "Ejecuciones sin este campo",
  stopKeeping: (value) => `Dejar de filtrar por ${value}`,
  keepOnly: (value) => `Quedarse solo con ${value}`,
  showAgainValue: (value) => `Volver a mostrar ${value}`,
  hideValue: (value) => `Ocultar ${value}`,
  showAgain: "Volver a mostrar",
  hideThese: "Ocultar estas ejecuciones",
  none: "ninguno",
  noCommand: "(sin comando)",
  noCommandTyped: (typed) => <>(sin comando {typed})</>,
  commandLabel: (command) => `${command} (sin comando)`,
  bareHint: "La herramienta se inició sin un comando que conozca; suele ser una errata o que falta el perfil.",
  didNotKnow: (typed) => `No conocía «${typed}».`,

  share: "Proporción",
  runs: "Ejecuciones",
  failed: "Fallidas",
  latest: "Última",
  showOnly: (value) => `Mostrar solo ${value}`,

  onlySession: (id) => `Solo las ejecuciones de la sesión ${id}`,
  onlyStartedBy: (name) => `Solo las ejecuciones que inició ${name}`,
  notInConversation: "Fuera de una conversación",
  session: (id) => `sesión ${id}`,
  from: (when) => `desde ${when}`,
  runsN: (n) => plural("es", n, { one: "# ejecución", other: "# ejecuciones" }),
  failedN: (n) => plural("es", n, { one: "# fallida", other: "# fallidas" }),
  conversationLabel: (title, session) => (session ? `${title}, sesión ${session}` : title),
  showRun: (command, when) => `Mostrar la ejecución ${command} de ${when}`,
  hideRun: (command, when) => `Ocultar la ejecución ${command} de ${when}`,
  details: "Detalles",
  time: "Hora",
  newestFirst: "Más recientes primero",
  oldestFirst: "Más antiguas primero",
  tool: "Herramienta",
  profile: "Perfil",
  command: "Comando",
  agent: "Agente",
  status: "Estado",
  took: "Duró",
  errorCode: "Código de error",

  events: {
    "provider.request": "Se envió una petición al servicio",
    "provider.response": "El servicio respondió a la petición, o falló",
    "client.warning": "La herramienta notó algo inesperado y siguió",
    "cache.answered": "Respondido con lo que la herramienta ya tenía guardado, sin preguntar al servicio",
    "command.crashed": "El comando falló por un error de la herramienta",
    "send.recorded": "Un mensaje que envió la herramienta, y cómo terminó",
    "job.start": "Empezó una tarea en segundo plano",
    "job.exit": "Terminó una tarea en segundo plano",
    "schedule.start": "Empezó una ejecución programada",
    "schedule.exit": "Terminó una ejecución programada",
    "agent.action": "Una acción que un agente de IA pidió a la herramienta",
    "events.dropped": "La ejecución tuvo más pasos de los que guarda la herramienta; contó el resto sin guardarlo",
  },
  succeededSummary:
    "La ejecución fue correcta, y de las correctas la herramienta solo guarda este resumen, no sus pasos.",
  stoppedBefore: (service) => `La herramienta se detuvo antes de contactar con ${service}, así que no hay pasos.`,
  requestsNotLogged: (n, service) =>
    `La herramienta hizo ${plural("es", n, { one: "# petición", other: "# peticiones" })} a ${service}, pero no las registró como pasos.`,
  noStepsLogged: "La herramienta no registró ningún paso de esta ejecución.",
  recordBelow: "El registro de abajo es todo lo que la herramienta guardó de esta ejecución.",
  copyRunId: "Copiar el id de la ejecución",
  steps: "Pasos",
  stepsHeading: (count, dropped) =>
    `Pasos${count === null ? "" : ` · ${count}`}${dropped ? `, ${dropped} más sin guardar` : ""}`,
  stepsHelp: (service) =>
    `Cada petición que la herramienta envió a ${service} (→) y su respuesta (←), además de los momentos destacados: un aviso, una respuesta con lo ya guardado, un fallo. Se marcan los reintentos y la espera previa.`,
  readingRun: "Leyendo esta ejecución",
  couldNotReadRun: (error) => `No se pudo leer esta ejecución: ${error}`,
  runRecord: "Registro de la ejecución",
  copyJson: "Copiar JSON",
  copyRunJson: "Copiar la ejecución como JSON",
  commandLine: "Línea de comandos",
  copyCommandLine: "Copiar la línea de comandos",
  startedBy: ({ agent, client, via, session }) => (
    <>
      La inició {agent}
      {client && <> a través de {client}</>}
      {via && <> ({via})</>}
      {session && <> en la sesión {session}</>}.
    </>
  ),
  masked: "La herramienta ocultó todos los valores que podían ser texto de mensajes o datos personales.",
  onlyThisSession: "Mostrar solo las ejecuciones de esta sesión",
  requests: (n) => plural("es", n, { one: "# petición", other: "# peticiones" }),
  step: "Paso",
  outcome: "Resultado",
  stepDetails: (n) => `Detalles del paso ${n}`,
  stepN: (n) => `Paso ${n}`,
  droppedSteps: (n) =>
    n === null
      ? "Algunos pasos más sin guardar"
      : plural("es", n, { one: "# paso más sin guardar", other: "# pasos más sin guardar" }),
  retry: (n) => `reintento ${n}`,
  waited: (took) => `esperó ${took}`,

  whatWentWrong: "Qué salió mal",
  request: "Petición",
  httpStatus: "Estado HTTP",
  operation: "Operación",
  serviceRefused: "El servicio rechazó",
  code: (code) => `código ${code}`,
  causedBy: "Causa",
  causes: "Causas",
  whereInTool: (frames) => `Dónde en la herramienta · ${plural("es", frames, { one: "# marco", other: "# marcos" })}`,

  items: (n) => plural("es", n, { one: "# elemento", other: "# elementos" }),
  filterBy: (term) => `Filtrar por ${term}`,
  exclude: (term) => `Excluir ${term}`,
  copyValue: "Copiar el valor",
  copied: "Copiado",

  searchRuns: "Buscar ejecuciones",
  placeholder: "status:failed command:sync* -profile:work timeout",
  suggestions: "Sugerencias",
  searchHint:
    "campo:valor para filtrar, * coincide con cualquier cosa, un - delante excluye. Dos valores del mismo campo coinciden con cualquiera de ellos.",
  searchSyntax: "Sintaxis de búsqueda",
  unclosedQuote: "Hay unas comillas sin cerrar.",
  needsValue: (field) => `${field}: necesita un valor, como ${field}:algo.`,
  notANumber: (op, value) => `${op} compara números; «${value}» no lo es.`,
  unknownField: (field) => `Ninguna ejecución tiene un campo llamado ${field}.`,

  keepingRegion: "Qué ejecuciones guarda cada herramienta",
  keepingHeading: "Ejecuciones que guarda cada herramienta",
  readingKeeping: "Leyendo qué ejecuciones guarda cada herramienta",
  whichRuns: (tool) => `Qué ejecuciones de ${tool} guardar`,
  refused: (tool, error) => `${tool} rechazó el cambio: ${error}`,
  askEvery: (tool) => `¿Guardar todas las ejecuciones de ${tool}?`,
  askFailedOnly: (tool) => `¿Dejar de guardar las ejecuciones correctas de ${tool}?`,
  leaveIt: "Dejarlo como está",
  keepEvery: "Guardar todas",
  keepFailedOnly: "Guardar solo las fallidas",
  choiceFailed: "Solo las fallidas",
  choiceEvery: "Todas",
  periodsEvery: (days) => `todas las ejecuciones${days === null ? "" : ` durante ${esDays(days)}`}`,
  periodsSplit: (success, failed) =>
    `las correctas${success === null ? "" : ` durante ${esDays(success)}`} y las fallidas${failed === null ? "" : ` durante ${esDays(failed)}`}`,
  chipReading: (tool) => `${tool} está leyendo sus ajustes`,
  chipError: (tool, error) => `${tool} no pudo decir si guarda las ejecuciones correctas: ${error}`,
  chipKeeps: (tool, periods) => `${tool} guarda ${periods}`,
  chipFailedOnly: (tool, days) =>
    `${tool} guarda solo las ejecuciones fallidas${days === null ? "" : ` durante ${esDays(days)}`}`,
  chipRefused: (error) => `La herramienta rechazó el cambio: ${error}`,
  noRecordSetting: "La herramienta no informa del ajuste record.",
  howUnset: (command) => <>Se ejecuta {command}, que devuelve el ajuste al valor por defecto de la herramienta.</>,
  howSet: (command, tool) => (
    <>
      Se fija {command}, el valor por defecto de todos los perfiles de {tool}.
    </>
  ),
  everyBody: (tool, periods) =>
    `A partir de ahora ${tool} registra todas las ejecuciones, también las correctas: guarda ${periods} y luego las borra. Mientras tanto, cada ejecución ocupa espacio en la carpeta de la herramienta.`,
  everyProfiles: (record) => (
    <>
      Un perfil que fija {record} por su cuenta mantiene su elección; cámbiala en la página Ajustes. Las ejecuciones que
      ya terminaron no se recuperan.
    </>
  ),
  failedOnlyBody: (tool, days, successDays) =>
    `A partir de ahora ${tool} guarda una ejecución solo cuando falla${days === null ? "" : `, durante ${esDays(days)}`}. Las correctas que ya guardó se quedan hasta que la herramienta borre las antiguas${successDays !== null ? `, al cabo de ${esDays(successDays)}` : days !== null ? `, al cabo de ${esDays(days)}` : ""}.`,
  failedOnlyProfiles: (record) => <>Un perfil que fija {record} por su cuenta mantiene su elección.</>,
}

export const logsMessages: Messages<typeof en> = { en, ru, es }
