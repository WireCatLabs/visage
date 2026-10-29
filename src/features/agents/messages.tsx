import type { ReactNode } from "react"
import type { CheckWords } from "@/domain/agents"
import { formatList, type Messages, plural } from "@/i18n"

const enList = (items: readonly string[]) => formatList(items, "en")
const ruList = (items: readonly string[]) => formatList(items, "ru")
const esList = (items: readonly string[]) => formatList(items, "es")

const ruCount = (n: number, one: string, few: string, many: string) =>
  plural("ru", n, { one: `# ${one}`, few: `# ${few}`, many: `# ${many}`, other: `# ${few}` })

const enCheck: CheckWords = {
  cannotFind: (agent, tools) => `${agent} cannot find ${enList(tools)}`,
  hermesPath:
    "Hermes runs each command in a bash login shell (bash -l) started from its gateway's PATH, so a folder added " +
    "only in ~/.zshrc or ~/.bashrc is missing there. Add this line to ~/.profile, or to ~/.bash_profile if you have " +
    "one, then restart Hermes (hermes gateway restart).",
  openclawPath:
    "OpenClaw runs commands with its gateway's PATH. Add the folders to tools.exec.pathPrepend with OpenClaw's own " +
    "command below. It replaces the whole list and works only while the gateway is stopped: stop the gateway, add " +
    "the folders that openclaw config get tools.exec.pathPrepend already lists, run it, then start the gateway again.",
  notOnPath: (tool) => `${tool} is not on a terminal's PATH`,
  notOnPathWindows: (agent, bin, folder) =>
    `${agent} runs commands in a terminal, and a new terminal does not find ${bin}. Add ${folder ?? "its folder"} to your user Path in Windows settings, then restart ${agent}.`,
  notOnPathShell: (agent, bin) =>
    `${agent} runs commands in a terminal, and a new terminal does not find ${bin}. Add its folder to PATH in your shell profile, then restart ${agent}.`,
  skillCurrent: (tool) => `${tool} skill is current`,
  cannotReport: (tools) =>
    tools.length === 1 ? `${enList(tools)} cannot report its skill` : `${enList(tools)} cannot report their skills`,
  tooOld: "These versions are too old to say which skill is installed. A newer version can.",
  cannotWrite: (tools, agent) => `${enList(tools)} cannot write a skill for ${agent} yet`,
  notReleased: (agent) =>
    `The version that can is not released yet. Until then ${agent} does not know these tools' commands.`,
  permissionsUnread: (tool, profile) => `${tool} (${profile}) permissions could not be read`,
  allowsAll: (tool, profile) => `${tool} (${profile}) allows every command`,
  blocked: (tool, profile, blocked, total) =>
    `${tool} (${profile}): ${blocked} of ${plural("en", total, { one: "# command is", other: "# commands are" })} blocked`,
  blockedDetail: (agent, tool) =>
    `Its permissions stop ${agent} from running them. Change them in ${tool}'s Manage panel.`,
  permissionsLater: "Permissions are read when you check this agent",
  permissionsLaterDetail: "The check asks each tool which commands every profile allows.",
  skillOld: (tool, version) => `${tool} skill is old (${version})`,
  skillOldDetail: (agent, folder) => `${agent} reads ${folder}; an old skill may name commands that changed.`,
  skillUnversioned: (tool) => `${tool} skill has no version`,
  inFolder: (folder) => `In ${folder}.`,
  skillMissing: (tool) => `${tool} skill is not installed`,
  skillMissingDetail: (agent, folder, bin) =>
    `${agent} reads ${folder}. Without the skill it does not know ${bin}'s commands.`,
  skillUnchecked: (tool) => `${tool} skill could not be checked`,
}

const en = {
  title: "Agents",
  intro:
    "Give each AI agent the skill for each of your tools. A skill tells the agent which commands a tool has; with it, the agent runs them itself.",
  checkAgain: "Check again",
  checking: "Checking…",
  checkingLabel: "Checking",
  lookFailed: (error: string) => `Could not look for AI agents: ${error}`,
  noAgent: "No AI agent was found on this computer. Skills can still be written; an agent installed later reads them.",
  noTool: "No WireCat tool is installed yet. Each tool brings its own skill; install one on the Tools page first.",
  readingElsewhere: "Reading tasks and run logs",
  unknownRuns: (n: number) =>
    plural("en", n, {
      one: "# run in the logs came from an older tool version, which does not record the agent that started it.",
      other: "# runs in the logs came from older tool versions, which do not record the agent that started them.",
    }),
  signedOutTasks: (tool: string, profiles: number, signIn: ReactNode): ReactNode => (
    <>
      {tool}: {plural("en", profiles, { one: "# profile is not signed in", other: "# profiles are not signed in" })}.{" "}
      {signIn} to see their tasks.
    </>
  ),
  signIn: "Sign in",
  signInButton: "Sign in",
  claimReadFailed: (tool: string, profile: string, error: string) =>
    `Could not read the tasks of ${tool} (${profile}): ${error}`,
  heldByOthers: (n: number) => `Tasks held by others (${n})`,
  you: "You",
  mcpApp: "MCP app",
  showInLogs: "Show in Logs",
  showNameInLogs: (name: string) => `Show ${name} in Logs`,

  notFound: "Not found",
  seenInRuns: (sessions: number) =>
    `Seen in runs · ${plural("en", sessions, { one: "# session", other: "# sessions" })}`,
  lookingForAgents: "Looking for agents",
  toSetUp: (n: number) => `${n} to set up`,
  skillsCurrent: "Skills current",

  seenBody: (sessions: number) =>
    `The run logs name this agent (${plural("en", sessions, { one: "# session", other: "# sessions" })}), but WireCat does not detect it, so it cannot say which skills it reads.`,
  absentShared: (folders: ReactNode): ReactNode => (
    <>
      Not found on this computer. Once it is installed it reads skills from {folders}, so the skills you install for the
      other agents reach it too.
    </>
  ),
  absentAlone: (folders: ReactNode): ReactNode => (
    <>Not found on this computer. Once it is installed it reads skills from {folders}.</>
  ),
  allCurrent: "Every skill it can see is current",
  connect: "Connect",
  connectTo: (agent: string) => `Connect WireCat to ${agent}`,
  todoMixed: (total: number, agent: string, missing: number, old: number) =>
    `${plural("en", total, { one: "# skill", other: "# skills" })} to set up for ${agent}: ${missing} missing, ${old} old`,
  todoMissing: (n: number, agent: string) =>
    `${plural("en", n, { one: "# tool has", other: "# tools have" })} no skill for ${agent}`,
  todoOld: (n: number, agent: string) =>
    `${plural("en", n, { one: "# skill", other: "# skills" })} for ${agent} ${n === 1 ? "is" : "are"} old`,
  installAll: "Install all",
  updateAll: "Update all",
  action: { Install: "Install", Update: "Update" },

  findingTools: "Finding installed tools",
  skillsFor: (agent: string) => `Skills for ${agent}`,
  updateToSee: (tool: string) => `Update ${tool} to see its skill`,
  updateToSeeVersion: (tool: string, version: ReactNode): ReactNode => (
    <>
      Update {tool} to {version} to see its skill
    </>
  ),
  needsNewerFor: (tool: string, agent: string) => `Needs a newer ${tool} to write a skill for ${agent}`,
  skillState: (tool: string, agent: string, state: string) => `${tool} skill for ${agent}: ${state}`,
  read: "Read",
  readSkill: (tool: string) => `Read the ${tool} skill`,
  openTools: "Open Tools",
  installSkill: (tool: string, agent: string) => `Install the ${tool} skill for ${agent}`,
  updateSkill: (tool: string, agent: string) => `Update the ${tool} skill for ${agent}`,
  state: {
    checking: "Checking…",
    current: "Current",
    stale: "Old",
    unversioned: "No version",
    missing: "Not installed",
    unknown: "Update the tool to see",
    unsupported: "Needs a newer version",
    failed: "Could not check",
  },
  writing: "Writing…",
  unknown: "Unknown",

  matrixLabel: "Skills for agents",
  tool: "Tool",
  checkingSkills: "Checking skills",
  notInstalledNote: (tools: readonly string[]) => `Not installed: ${enList(tools)}. A skill comes with its tool.`,
  silent: (tools: readonly string[]) =>
    tools.length === 1
      ? `The installed ${enList(tools)} cannot report its skill, so it shows as Unknown.`
      : `The installed ${enList(tools)} cannot report their skills, so they show as Unknown.`,
  fixOnTools: "Updating on the Tools page fixes that.",
  fixOnToolsTo: (updates: readonly string[]) => `Updating on the Tools page fixes that: ${enList(updates)}.`,
  toVersion: (tool: string, version: string) => `${tool} to ${version}`,
  comingRelease: "A coming release will.",

  foundProgram: "Program on PATH",
  foundFolder: "Found by its settings folder; the program is not on PATH",
  reads: (found: string, folders: ReactNode): ReactNode => (
    <>
      {found} · reads {folders}
    </>
  ),
  disconnect: "Disconnect",
  disconnectFrom: (agent: string) => `Disconnect WireCat from ${agent}`,
  checkThis: "Check this agent",
  alsoFix: "Also to fix",
  recentSessions: "Recent sessions",
  tasksHeld: "Tasks it holds",
  nothingElse: (agent: string) => `Nothing else stops ${agent}.`,
  otherFixes: (agent: string) => `Other things to fix for ${agent}`,
  profileSignedOut: (tool: string, profile: ReactNode): ReactNode => (
    <>
      {tool} profile {profile} is not signed in
    </>
  ),
  profileSignedOutDetail: (agent: string, tool: string) =>
    `${agent} cannot use ${tool} through this profile until it is signed in again.`,
  signInTo: (tool: string, profile: string) => `Sign in to ${tool} (${profile})`,
  readingRunLogs: "Reading run logs",
  noSessions: (agent: string) => `The tools' run logs have no session from ${agent}.`,
  noSessionId: "no session id",
  commandsRun: (n: number) => plural("en", n, { one: "# command", other: "# commands" }),
  failedCount: (n: number) => `${n} failed`,
  olderSessions: (n: number) => `and ${n} older on the Logs page`,
  copyCommand: "Copy the command",

  advancedMcp: "Advanced: MCP",
  mcpIntro:
    "For chat apps and agents on another computer. Agents on this computer use the tools directly through their skill.",
  readingMcp: "Reading MCP servers",
  mcpUnread: (agent: string, file: ReactNode): ReactNode => (
    <>
      WireCat does not read {agent}'s MCP servers. See {file}.
    </>
  ),
  noMcp: (agent: string) => `${agent} has no WireCat MCP server registered.`,
  mcpList: (agent: string) => `WireCat MCP servers in ${agent}`,
  readFrom: (source: ReactNode): ReactNode => <>Read from {source}</>,
  remove: "Remove",
  removing: "Removing…",
  removeServer: (server: string, agent: string) => `Remove the ${server} MCP server from ${agent}`,

  until: (when: string) => `until ${when}`,
  release: "Release",
  releasing: "Releasing…",
  releaseTask: (task: string) => `Release ${task}`,

  noReason: "It did not work, and the tool gave no reason.",
  close: "Close",
  cancel: "Cancel",
  running: "Running…",
  tryAgain: "Try again",
  appRuns: "The app runs",
  installSkillTitle: (tool: string, reader: string) => `Install the ${tool} skill for ${reader}?`,
  updateSkillTitle: (tool: string, reader: string) => `Update the ${tool} skill for ${reader}?`,
  skillBody: (tool: string) => `${tool} writes its own skill file, the version that comes with it.`,
  installManyTitle: (n: number, agent: string) =>
    `Install ${plural("en", n, { one: "# skill", other: "# skills" })} for ${agent}?`,
  updateManyTitle: (n: number, agent: string) =>
    `Update ${plural("en", n, { one: "# skill", other: "# skills" })} for ${agent}?`,
  eachWrites: (folders: readonly string[]) =>
    `Each tool writes its own skill file into ${enList(folders)}, one after another.`,
  othersToo: (agents: readonly string[]) =>
    agents.length === 1
      ? `${enList(agents)} reads the same folder and gets these skills too.`
      : `${enList(agents)} read the same folder and get these skills too.`,
  removeServerTitle: (server: string, agent: string) => `Remove the ${server} MCP server from ${agent}?`,
  removeServerBody: (agent: string, tool: string) =>
    `${agent} stops starting this MCP server. The skill and the tool stay, and ${agent} keeps using ${tool} through its commands.`,
  releaseTitle: (task: string) => `Release ${task}?`,
  releaseBody: (holder: string) =>
    `${holder} holds this task. Release it when that session has stopped, so another agent can take it.`,

  needsNewer: (tool: string) => `Needs a newer ${tool}`,
  updateFirst: (tool: string) => `Update ${tool} first`,
  notOnTerminalPath: (tools: readonly string[]) =>
    tools.length === 1
      ? `${enList(tools)} is not on a terminal's PATH`
      : `${enList(tools)} are not on a terminal's PATH`,
  terminalFixDetail: (tools: readonly string[], folders: number, agent: string) =>
    `A new terminal does not find ${enList(tools)}. Add ${folders === 1 ? "its folder" : "their folders"} to PATH in your shell profile, then restart ${agent}.`,
  connectIntro: (agent: string) =>
    `Each tool writes its own skill for ${agent}, so ${agent} knows its commands. Then WireCat checks that ${agent} finds each tool. MCP is not part of this.`,
  tools: "Tools",
  readOnly: "Read only",
  readOnlyIntro: (agent: string) =>
    `A profile set to read only lets ${agent} read and search through it, but not send, change or delete anything. You can change it later in the tool's Permissions on the Tools page.`,
  chooseTool: "Choose a tool to see its profiles.",
  noProfiles: "The chosen tools have no profiles.",
  connectTools: (n: number) => `Connect ${plural("en", n, { one: "# tool", other: "# tools" })}`,
  connecting: "Connecting…",
  readingChats: (agent: string) => `Reading which chat apps reach ${agent}`,
  noChats: (agent: string) =>
    `${agent} answers in no chat app now. If you add one later, anyone that bot accepts can ask it to run the tools you connect.`,
  chatsReady: (agent: string, apps: readonly string[], stopped: boolean) =>
    `${agent} answers in ${enList(apps)}${stopped ? " (stopped now, it starts again with them)" : ""}. Anyone the bot accepts there can ask it to run the tools you connect, with your signed-in accounts. Consider read only for the profiles below.`,
  chatsFailed: (agent: string, error: string) =>
    `WireCat could not read which chat apps reach ${agent} (${error}). If it answers in one, anyone the bot accepts can ask it to run the tools you connect. Consider read only for the profiles below.`,
  steps: "Steps",
  stepState: { waiting: "waiting", running: "running", ok: "done", warn: "needs attention", failed: "failed" },
  step: {
    skill: (tool: string) => `${tool} skill`,
    readOnly: (tool: string, profile: string) => `${tool} (${profile}) read only`,
    finds: (agent: string) => `${agent} finds the tools`,
    written: "Written",
    keptBlock: (groups: readonly string[]) => `Kept Block on ${enList(groups)}.`,
    opened: (commands: readonly string[], tool: string) =>
      `Now allowed and blocked before: ${commands.join(", ")}. Block them again in ${tool}'s Permissions on the Tools page.`,
    allBlocked: "Every command that changes something is blocked.",
    setUnknown: "Set; this version cannot say which commands it now blocks.",
    stillAllowed: (n: number, tool: string) =>
      `Set, but ${plural("en", n, { one: "# command that changes things is", other: "# commands that change things are" })} still allowed. Change them in ${tool}'s Permissions on the Tools page.`,
    noPath: "WireCat could not read the PATH it runs commands with.",
    findsAll: (agent: string) => `${agent} finds every tool you chose`,
  },

  disconnectBody: (agent: string, folders: number) =>
    `The WireCat tools have no command that removes their skill yet, so WireCat does not delete it for you. To disconnect ${agent}, delete ${folders === 1 ? "this folder" : "these folders"} yourself:`,
  othersLose: (agents: readonly string[], folders: readonly string[]) =>
    agents.length === 1
      ? `${enList(agents)} reads ${enList(folders)} too and loses these skills as well.`
      : `${enList(agents)} read ${enList(folders)} too and lose these skills as well.`,
  toolsStay: (agent: string) =>
    `The tools stay installed, and ${agent} can still run them; without the skill it no longer knows their commands.`,

  skillTitle: (tool: string) => `${tool} skill`,
  comesWith: (bin: string) => `Comes with ${bin}`,
  inFolder: (folder: ReactNode): ReactNode => <>In {folder}</>,
  notInstalled: "not installed",
  differs:
    "An installed copy is a different version. Showing exactly what changed arrives with a tool update: the tool cannot print the installed copy yet. Updating replaces it with the text below.",
  readingSkill: "Reading the skill",

  check: enCheck,
}

const ruCheck: CheckWords = {
  cannotFind: (agent, tools) => `${agent} не находит ${ruList(tools)}`,
  hermesPath:
    "Hermes запускает каждую команду в login-оболочке bash (bash -l) с PATH своего шлюза, поэтому папки, добавленной " +
    "только в ~/.zshrc или ~/.bashrc, там нет. Добавьте эту строку в ~/.profile или в ~/.bash_profile, если он у вас " +
    "есть, и перезапустите Hermes (hermes gateway restart).",
  openclawPath:
    "OpenClaw запускает команды с PATH своего шлюза. Добавьте папки в tools.exec.pathPrepend собственной командой " +
    "OpenClaw ниже. Она заменяет весь список и работает, только пока шлюз остановлен: остановите шлюз, добавьте в " +
    "команду папки, которые уже показывает openclaw config get tools.exec.pathPrepend, выполните её и снова " +
    "запустите шлюз.",
  notOnPath: (tool) => `${tool} нет в PATH терминала`,
  notOnPathWindows: (agent, bin, folder) =>
    `${agent} запускает команды в терминале, а новый терминал не находит ${bin}. Добавьте ${folder ?? "его папку"} в пользовательскую переменную Path в настройках Windows и перезапустите ${agent}.`,
  notOnPathShell: (agent, bin) =>
    `${agent} запускает команды в терминале, а новый терминал не находит ${bin}. Добавьте его папку в PATH в профиле оболочки и перезапустите ${agent}.`,
  skillCurrent: (tool) => `Навык ${tool} актуален`,
  cannotReport: (tools) =>
    tools.length === 1
      ? `${ruList(tools)} не может сообщить о своём навыке`
      : `${ruList(tools)} не могут сообщить о своих навыках`,
  tooOld: "Эти версии слишком старые и не говорят, какой навык установлен. Новая версия скажет.",
  cannotWrite: (tools, agent) => `${ruList(tools)} пока не умеют записывать навык для ${agent}`,
  notReleased: (agent) =>
    `Версия, которая это умеет, ещё не вышла. До тех пор ${agent} не знает команд этих инструментов.`,
  permissionsUnread: (tool, profile) => `Не удалось прочитать разрешения ${tool} (${profile})`,
  allowsAll: (tool, profile) => `${tool} (${profile}) разрешает все команды`,
  blocked: (tool, profile, blocked, total) =>
    `${tool} (${profile}): заблокировано ${blocked} из ${ruCount(total, "команды", "команд", "команд")}`,
  blockedDetail: (agent, tool) =>
    `Разрешения не дают ${agent} их выполнять. Измените их в панели «Управление» инструмента ${tool}.`,
  permissionsLater: "Разрешения читаются при проверке этого агента",
  permissionsLaterDetail: "Проверка спрашивает у каждого инструмента, какие команды разрешены в каждом профиле.",
  skillOld: (tool, version) => `Навык ${tool} устарел (${version})`,
  skillOldDetail: (agent, folder) =>
    `${agent} читает ${folder}; в старом навыке могут быть команды, которые уже изменились.`,
  skillUnversioned: (tool) => `У навыка ${tool} нет версии`,
  inFolder: (folder) => `В ${folder}.`,
  skillMissing: (tool) => `Навык ${tool} не установлен`,
  skillMissingDetail: (agent, folder, bin) => `${agent} читает ${folder}. Без навыка он не знает команд ${bin}.`,
  skillUnchecked: (tool) => `Не удалось проверить навык ${tool}`,
}

const ru: typeof en = {
  title: "Агенты",
  intro:
    "Дайте каждому ИИ-агенту навык для каждого вашего инструмента. Навык говорит агенту, какие команды есть у инструмента, и агент запускает их сам.",
  checkAgain: "Проверить снова",
  checking: "Проверка…",
  checkingLabel: "Проверка",
  lookFailed: (error) => `Не удалось найти ИИ-агентов: ${error}`,
  noAgent:
    "На этом компьютере не найдено ни одного ИИ-агента. Навыки всё равно можно записать: агент, установленный позже, их прочитает.",
  noTool:
    "Ни один инструмент WireCat ещё не установлен. Каждый инструмент приносит свой навык; сначала установите его на странице «Инструменты».",
  readingElsewhere: "Читаем задачи и журналы запусков",
  unknownRuns: (n) =>
    plural("ru", n, {
      one: "# запуск в журналах сделан старой версией инструмента, которая не записывает, какой агент его начал.",
      few: "# запуска в журналах сделаны старыми версиями инструментов, которые не записывают, какой агент их начал.",
      many: "# запусков в журналах сделаны старыми версиями инструментов, которые не записывают, какой агент их начал.",
      other: "# запуска в журналах сделаны старыми версиями инструментов, которые не записывают, какой агент их начал.",
    }),
  signedOutTasks: (tool, profiles, signIn) => (
    <>
      {tool}: не выполнен вход в {ruCount(profiles, "профиль", "профиля", "профилей")}. {signIn}, чтобы увидеть их
      задачи.
    </>
  ),
  signIn: "Войдите",
  signInButton: "Войти",
  claimReadFailed: (tool, profile, error) => `Не удалось прочитать задачи ${tool} (${profile}): ${error}`,
  heldByOthers: (n) => `Задачи, занятые другими (${n})`,
  you: "Вы",
  mcpApp: "MCP-приложение",
  showInLogs: "Показать в журнале",
  showNameInLogs: (name) => `Показать ${name} в журнале`,

  notFound: "Не найден",
  seenInRuns: (sessions) => `Есть в запусках · ${ruCount(sessions, "сеанс", "сеанса", "сеансов")}`,
  lookingForAgents: "Ищем агентов",
  toSetUp: (n) => `Настроить: ${n}`,
  skillsCurrent: "Навыки актуальны",

  seenBody: (sessions) =>
    `Этот агент есть в журналах запусков (${ruCount(sessions, "сеанс", "сеанса", "сеансов")}), но WireCat не умеет его находить и не может сказать, какие навыки он читает.`,
  absentShared: (folders) => (
    <>
      На этом компьютере не найден. Когда его установят, он будет читать навыки из {folders}, так что навыки, которые вы
      ставите другим агентам, дойдут и до него.
    </>
  ),
  absentAlone: (folders) => (
    <>На этом компьютере не найден. Когда его установят, он будет читать навыки из {folders}.</>
  ),
  allCurrent: "Все навыки, которые он видит, актуальны",
  connect: "Подключить",
  connectTo: (agent) => `Подключить WireCat к ${agent}`,
  todoMixed: (total, agent, missing, old) =>
    `Для ${agent} нужно настроить ${ruCount(total, "навык", "навыка", "навыков")}: не хватает — ${missing}, устарело — ${old}`,
  todoMissing: (n, agent) =>
    `У ${plural("ru", n, { one: "# инструмента", few: "# инструментов", many: "# инструментов", other: "# инструмента" })} нет навыка для ${agent}`,
  todoOld: (n, agent) =>
    plural("ru", n, {
      one: `# навык для ${agent} устарел`,
      few: `# навыка для ${agent} устарели`,
      many: `# навыков для ${agent} устарели`,
      other: `# навыка для ${agent} устарели`,
    }),
  installAll: "Установить все",
  updateAll: "Обновить все",
  action: { Install: "Установить", Update: "Обновить" },

  findingTools: "Ищем установленные инструменты",
  skillsFor: (agent) => `Навыки для ${agent}`,
  updateToSee: (tool) => `Обновите ${tool}, чтобы увидеть его навык`,
  updateToSeeVersion: (tool, version) => (
    <>
      Обновите {tool} до {version}, чтобы увидеть его навык
    </>
  ),
  needsNewerFor: (tool, agent) => `Чтобы записать навык для ${agent}, нужна более новая версия ${tool}`,
  skillState: (tool, agent, state) => `Навык ${tool} для ${agent}: ${state}`,
  read: "Читать",
  readSkill: (tool) => `Прочитать навык ${tool}`,
  openTools: "К инструментам",
  installSkill: (tool, agent) => `Установить навык ${tool} для ${agent}`,
  updateSkill: (tool, agent) => `Обновить навык ${tool} для ${agent}`,
  state: {
    checking: "Проверка…",
    current: "Актуален",
    stale: "Устарел",
    unversioned: "Без версии",
    missing: "Не установлен",
    unknown: "Обновите инструмент",
    unsupported: "Нужна новая версия",
    failed: "Не удалось проверить",
  },
  writing: "Запись…",
  unknown: "Неизвестно",

  matrixLabel: "Навыки для агентов",
  tool: "Инструмент",
  checkingSkills: "Проверяем навыки",
  notInstalledNote: (tools) => `Не установлены: ${ruList(tools)}. Навык поставляется вместе с инструментом.`,
  silent: (tools) =>
    tools.length === 1
      ? `Установленный ${ruList(tools)} не может сообщить о своём навыке, поэтому он показан как «Неизвестно».`
      : `Установленные ${ruList(tools)} не могут сообщить о своих навыках, поэтому они показаны как «Неизвестно».`,
  fixOnTools: "Это исправит обновление на странице «Инструменты».",
  fixOnToolsTo: (updates) => `Это исправит обновление на странице «Инструменты»: ${ruList(updates)}.`,
  toVersion: (tool, version) => `${tool} до ${version}`,
  comingRelease: "Это исправит один из следующих выпусков.",

  foundProgram: "Программа есть в PATH",
  foundFolder: "Найден по папке настроек; программы нет в PATH",
  reads: (found, folders) => (
    <>
      {found} · читает {folders}
    </>
  ),
  disconnect: "Отключить",
  disconnectFrom: (agent) => `Отключить WireCat от ${agent}`,
  checkThis: "Проверить агента",
  alsoFix: "Что ещё исправить",
  recentSessions: "Последние сеансы",
  tasksHeld: "Его задачи",
  nothingElse: (agent) => `Больше ничто не мешает ${agent}.`,
  otherFixes: (agent) => `Что ещё исправить для ${agent}`,
  profileSignedOut: (tool, profile) => (
    <>
      {tool}: не выполнен вход в профиль {profile}
    </>
  ),
  profileSignedOutDetail: (agent, tool) =>
    `${agent} не сможет работать с ${tool} через этот профиль, пока вы снова не войдёте.`,
  signInTo: (tool, profile) => `Войти в ${tool} (${profile})`,
  readingRunLogs: "Читаем журналы запусков",
  noSessions: (agent) => `В журналах запусков инструментов нет сеансов ${agent}.`,
  noSessionId: "без id сеанса",
  commandsRun: (n) => ruCount(n, "команда", "команды", "команд"),
  failedCount: (n) => `с ошибкой: ${n}`,
  olderSessions: (n) => `и ещё ${n} — в журнале`,
  copyCommand: "Скопировать команду",

  advancedMcp: "Дополнительно: MCP",
  mcpIntro:
    "Для чат-приложений и агентов на другом компьютере. Агенты на этом компьютере работают с инструментами напрямую, через навык.",
  readingMcp: "Читаем MCP-серверы",
  mcpUnread: (agent, file) => (
    <>
      WireCat не читает MCP-серверы {agent}. Смотрите {file}.
    </>
  ),
  noMcp: (agent) => `В ${agent} не зарегистрирован ни один MCP-сервер WireCat.`,
  mcpList: (agent) => `MCP-серверы WireCat в ${agent}`,
  readFrom: (source) => <>Прочитано из {source}</>,
  remove: "Удалить",
  removing: "Удаляем…",
  removeServer: (server, agent) => `Удалить MCP-сервер ${server} из ${agent}`,

  until: (when) => `до ${when}`,
  release: "Освободить",
  releasing: "Освобождаем…",
  releaseTask: (task) => `Освободить ${task}`,

  noReason: "Не получилось, и инструмент не объяснил почему.",
  close: "Закрыть",
  cancel: "Отмена",
  running: "Выполняется…",
  tryAgain: "Повторить",
  appRuns: "Приложение выполнит",
  installSkillTitle: (tool, reader) => `Установить навык ${tool} для ${reader}?`,
  updateSkillTitle: (tool, reader) => `Обновить навык ${tool} для ${reader}?`,
  skillBody: (tool) => `${tool} сам записывает файл своего навыка — той версии, что идёт с ним.`,
  installManyTitle: (n, agent) => `Установить ${ruCount(n, "навык", "навыка", "навыков")} для ${agent}?`,
  updateManyTitle: (n, agent) => `Обновить ${ruCount(n, "навык", "навыка", "навыков")} для ${agent}?`,
  eachWrites: (folders) => `Каждый инструмент по очереди записывает файл своего навыка в ${ruList(folders)}.`,
  othersToo: (agents) =>
    agents.length === 1
      ? `${ruList(agents)} читает ту же папку и тоже получит эти навыки.`
      : `${ruList(agents)} читают ту же папку и тоже получат эти навыки.`,
  removeServerTitle: (server, agent) => `Удалить MCP-сервер ${server} из ${agent}?`,
  removeServerBody: (agent, tool) =>
    `${agent} перестанет запускать этот MCP-сервер. Навык и инструмент останутся, и ${agent} продолжит работать с ${tool} через его команды.`,
  releaseTitle: (task) => `Освободить ${task}?`,
  releaseBody: (holder) =>
    `Эту задачу держит ${holder}. Освободите её, когда тот сеанс завершится, чтобы её мог взять другой агент.`,

  needsNewer: (tool) => `Нужна более новая версия ${tool}`,
  updateFirst: (tool) => `Сначала обновите ${tool}`,
  notOnTerminalPath: (tools) => `${ruList(tools)} нет в PATH терминала`,
  terminalFixDetail: (tools, folders, agent) =>
    `Новый терминал не находит ${ruList(tools)}. Добавьте ${folders === 1 ? "папку" : "папки"} в PATH в профиле оболочки и перезапустите ${agent}.`,
  connectIntro: (agent) =>
    `Каждый инструмент записывает свой навык для ${agent}, чтобы ${agent} знал его команды. Затем WireCat проверит, что ${agent} находит каждый инструмент. MCP здесь не участвует.`,
  tools: "Инструменты",
  readOnly: "Только чтение",
  readOnlyIntro: (agent) =>
    `В профиле «только чтение» ${agent} может читать и искать, но не может ничего отправлять, менять или удалять. Это можно изменить позже в разрешениях инструмента на странице «Инструменты».`,
  chooseTool: "Выберите инструмент, чтобы увидеть его профили.",
  noProfiles: "У выбранных инструментов нет профилей.",
  connectTools: (n) => `Подключить ${ruCount(n, "инструмент", "инструмента", "инструментов")}`,
  connecting: "Подключаем…",
  readingChats: (agent) => `Узнаём, через какие чат-приложения доступен ${agent}`,
  noChats: (agent) =>
    `Сейчас ${agent} не отвечает ни в одном чат-приложении. Если вы добавите его позже, любой, кого принимает этот бот, сможет попросить его запустить подключённые инструменты.`,
  chatsReady: (agent, apps, stopped) =>
    `${agent} отвечает в ${ruList(apps)}${stopped ? " (сейчас остановлен и запустится снова вместе с ними)" : ""}. Любой, кого бот там принимает, может попросить его запустить подключённые инструменты от имени ваших аккаунтов. Подумайте о режиме «только чтение» для профилей ниже.`,
  chatsFailed: (agent, error) =>
    `WireCat не смог узнать, через какие чат-приложения доступен ${agent} (${error}). Если он отвечает в одном из них, любой, кого принимает бот, может попросить его запустить подключённые инструменты. Подумайте о режиме «только чтение» для профилей ниже.`,
  steps: "Шаги",
  stepState: { waiting: "ждёт", running: "идёт", ok: "готово", warn: "требует внимания", failed: "не удалось" },
  step: {
    skill: (tool) => `Навык ${tool}`,
    readOnly: (tool, profile) => `${tool} (${profile}): только чтение`,
    finds: (agent) => `${agent} находит инструменты`,
    written: "Записан",
    keptBlock: (groups) => `Блокировка сохранена для ${ruList(groups)}.`,
    opened: (commands, tool) =>
      `Теперь разрешены, а раньше были заблокированы: ${commands.join(", ")}. Заблокируйте их снова в разрешениях ${tool} на странице «Инструменты».`,
    allBlocked: "Все команды, которые что-то меняют, заблокированы.",
    setUnknown: "Готово; эта версия не может сказать, какие команды теперь заблокированы.",
    stillAllowed: (n, tool) =>
      `Готово, но ещё ${plural("ru", n, { one: "# команда, которая что-то меняет, разрешена", few: "# команды, которые что-то меняют, разрешены", many: "# команд, которые что-то меняют, разрешены", other: "# команды, которые что-то меняют, разрешены" })}. Измените их в разрешениях ${tool} на странице «Инструменты».`,
    noPath: "WireCat не смог прочитать PATH, с которым запускает команды.",
    findsAll: (agent) => `${agent} находит все выбранные инструменты`,
  },

  disconnectBody: (agent, folders) =>
    `У инструментов WireCat пока нет команды, которая удаляет их навык, поэтому WireCat не удаляет его за вас. Чтобы отключить ${agent}, удалите ${folders === 1 ? "эту папку" : "эти папки"} сами:`,
  othersLose: (agents, folders) =>
    agents.length === 1
      ? `${ruList(agents)} тоже читает ${ruList(folders)} и тоже потеряет эти навыки.`
      : `${ruList(agents)} тоже читают ${ruList(folders)} и тоже потеряют эти навыки.`,
  toolsStay: (agent) =>
    `Инструменты останутся установленными, и ${agent} по-прежнему сможет их запускать; без навыка он просто не знает их команд.`,

  skillTitle: (tool) => `Навык ${tool}`,
  comesWith: (bin) => `Идёт с ${bin}`,
  inFolder: (folder) => <>В {folder}</>,
  notInstalled: "не установлен",
  differs:
    "Установленная копия другой версии. Показать, что именно изменилось, сможет новая версия инструмента: пока он не умеет выводить установленную копию. Обновление заменит её текстом ниже.",
  readingSkill: "Читаем навык",

  check: ruCheck,
}

const esCheck: CheckWords = {
  cannotFind: (agent, tools) => `${agent} no encuentra ${esList(tools)}`,
  hermesPath:
    "Hermes ejecuta cada comando en un shell de inicio de sesión de bash (bash -l) lanzado con el PATH de su " +
    "gateway, así que una carpeta añadida solo en ~/.zshrc o ~/.bashrc no está ahí. Añade esta línea a ~/.profile, " +
    "o a ~/.bash_profile si lo tienes, y reinicia Hermes (hermes gateway restart).",
  openclawPath:
    "OpenClaw ejecuta los comandos con el PATH de su gateway. Añade las carpetas a tools.exec.pathPrepend con el " +
    "comando de OpenClaw que ves abajo. Sustituye la lista entera y solo funciona con el gateway parado: para el " +
    "gateway, añade las carpetas que ya muestra openclaw config get tools.exec.pathPrepend, ejecútalo y vuelve a " +
    "arrancar el gateway.",
  notOnPath: (tool) => `${tool} no está en el PATH del terminal`,
  notOnPathWindows: (agent, bin, folder) =>
    `${agent} ejecuta comandos en un terminal, y un terminal nuevo no encuentra ${bin}. Añade ${folder ?? "su carpeta"} a la variable Path de tu usuario en la configuración de Windows y reinicia ${agent}.`,
  notOnPathShell: (agent, bin) =>
    `${agent} ejecuta comandos en un terminal, y un terminal nuevo no encuentra ${bin}. Añade su carpeta al PATH en el perfil de tu shell y reinicia ${agent}.`,
  skillCurrent: (tool) => `La skill de ${tool} está al día`,
  cannotReport: (tools) =>
    tools.length === 1
      ? `${esList(tools)} no puede informar de su skill`
      : `${esList(tools)} no pueden informar de sus skills`,
  tooOld: "Estas versiones son demasiado antiguas para decir qué skill está instalada. Una versión más nueva sí puede.",
  cannotWrite: (tools, agent) => `${esList(tools)} aún no pueden escribir una skill para ${agent}`,
  notReleased: (agent) =>
    `La versión que puede hacerlo aún no ha salido. Hasta entonces, ${agent} no conoce los comandos de estas herramientas.`,
  permissionsUnread: (tool, profile) => `No se pudieron leer los permisos de ${tool} (${profile})`,
  allowsAll: (tool, profile) => `${tool} (${profile}) permite todos los comandos`,
  blocked: (tool, profile, blocked, total) =>
    `${tool} (${profile}): ${blocked} de ${plural("es", total, { one: "# comando", other: "# comandos" })} bloqueados`,
  blockedDetail: (agent, tool) =>
    `Sus permisos impiden que ${agent} los ejecute. Cámbialos en el panel Gestionar de ${tool}.`,
  permissionsLater: "Los permisos se leen cuando compruebas este agente",
  permissionsLaterDetail: "La comprobación pregunta a cada herramienta qué comandos permite cada perfil.",
  skillOld: (tool, version) => `La skill de ${tool} está desactualizada (${version})`,
  skillOldDetail: (agent, folder) =>
    `${agent} lee ${folder}; una skill antigua puede nombrar comandos que ya han cambiado.`,
  skillUnversioned: (tool) => `La skill de ${tool} no tiene versión`,
  inFolder: (folder) => `En ${folder}.`,
  skillMissing: (tool) => `La skill de ${tool} no está instalada`,
  skillMissingDetail: (agent, folder, bin) => `${agent} lee ${folder}. Sin la skill no conoce los comandos de ${bin}.`,
  skillUnchecked: (tool) => `No se pudo comprobar la skill de ${tool}`,
}

const es: typeof en = {
  title: "Agentes",
  intro:
    "Da a cada agente de IA la skill de cada una de tus herramientas. La skill le dice al agente qué comandos tiene una herramienta; con ella, el agente los ejecuta por su cuenta.",
  checkAgain: "Comprobar de nuevo",
  checking: "Comprobando…",
  checkingLabel: "Comprobando",
  lookFailed: (error) => `No se pudieron buscar agentes de IA: ${error}`,
  noAgent:
    "No se ha encontrado ningún agente de IA en este ordenador. Las skills se pueden escribir igualmente; un agente instalado más tarde las leerá.",
  noTool:
    "Aún no hay ninguna herramienta de WireCat instalada. Cada herramienta trae su propia skill; instala una primero en la página Herramientas.",
  readingElsewhere: "Leyendo tareas y registros de ejecución",
  unknownRuns: (n) =>
    plural("es", n, {
      one: "# ejecución de los registros viene de una versión antigua de la herramienta, que no anota qué agente la inició.",
      other:
        "# ejecuciones de los registros vienen de versiones antiguas de las herramientas, que no anotan qué agente las inició.",
    }),
  signedOutTasks: (tool, profiles, signIn) => (
    <>
      {tool}: {plural("es", profiles, { one: "# perfil sin sesión iniciada", other: "# perfiles sin sesión iniciada" })}
      . {signIn} para ver sus tareas.
    </>
  ),
  signIn: "Inicia sesión",
  signInButton: "Iniciar sesión",
  claimReadFailed: (tool, profile, error) => `No se pudieron leer las tareas de ${tool} (${profile}): ${error}`,
  heldByOthers: (n) => `Tareas que tienen otros (${n})`,
  you: "Tú",
  mcpApp: "App MCP",
  showInLogs: "Ver en Registros",
  showNameInLogs: (name) => `Ver ${name} en Registros`,

  notFound: "No encontrado",
  seenInRuns: (sessions) =>
    `Visto en ejecuciones · ${plural("es", sessions, { one: "# sesión", other: "# sesiones" })}`,
  lookingForAgents: "Buscando agentes",
  toSetUp: (n) => `${n} por configurar`,
  skillsCurrent: "Skills al día",

  seenBody: (sessions) =>
    `Los registros de ejecución nombran a este agente (${plural("es", sessions, { one: "# sesión", other: "# sesiones" })}), pero WireCat no lo detecta, así que no puede decir qué skills lee.`,
  absentShared: (folders) => (
    <>
      No se ha encontrado en este ordenador. Cuando se instale, leerá las skills de {folders}, así que las skills que
      instales para los demás agentes también le llegarán.
    </>
  ),
  absentAlone: (folders) => (
    <>No se ha encontrado en este ordenador. Cuando se instale, leerá las skills de {folders}.</>
  ),
  allCurrent: "Todas las skills que ve están al día",
  connect: "Conectar",
  connectTo: (agent) => `Conectar WireCat a ${agent}`,
  todoMixed: (total, agent, missing, old) =>
    `${plural("es", total, { one: "# skill", other: "# skills" })} por configurar para ${agent}: ${missing} sin instalar y ${plural("es", old, { one: "# antigua", other: "# antiguas" })}`,
  todoMissing: (n, agent) =>
    plural("es", n, {
      one: `# herramienta no tiene skill para ${agent}`,
      other: `# herramientas no tienen skill para ${agent}`,
    }),
  todoOld: (n, agent) =>
    plural("es", n, {
      one: `# skill para ${agent} está desactualizada`,
      other: `# skills para ${agent} están desactualizadas`,
    }),
  installAll: "Instalar todas",
  updateAll: "Actualizar todas",
  action: { Install: "Instalar", Update: "Actualizar" },

  findingTools: "Buscando las herramientas instaladas",
  skillsFor: (agent) => `Skills para ${agent}`,
  updateToSee: (tool) => `Actualiza ${tool} para ver su skill`,
  updateToSeeVersion: (tool, version) => (
    <>
      Actualiza {tool} a {version} para ver su skill
    </>
  ),
  needsNewerFor: (tool, agent) => `Necesita una versión más nueva de ${tool} para escribir una skill para ${agent}`,
  skillState: (tool, agent, state) => `Skill de ${tool} para ${agent}: ${state}`,
  read: "Leer",
  readSkill: (tool) => `Leer la skill de ${tool}`,
  openTools: "Ir a Herramientas",
  installSkill: (tool, agent) => `Instalar la skill de ${tool} para ${agent}`,
  updateSkill: (tool, agent) => `Actualizar la skill de ${tool} para ${agent}`,
  state: {
    checking: "Comprobando…",
    current: "Al día",
    stale: "Antigua",
    unversioned: "Sin versión",
    missing: "No instalada",
    unknown: "Actualiza la herramienta para verla",
    unsupported: "Necesita una versión más nueva",
    failed: "No se pudo comprobar",
  },
  writing: "Escribiendo…",
  unknown: "Desconocida",

  matrixLabel: "Skills para agentes",
  tool: "Herramienta",
  checkingSkills: "Comprobando skills",
  notInstalledNote: (tools) => `Sin instalar: ${esList(tools)}. La skill viene con su herramienta.`,
  silent: (tools) =>
    tools.length === 1
      ? `La versión instalada de ${esList(tools)} no puede informar de su skill, así que aparece como Desconocida.`
      : `Las versiones instaladas de ${esList(tools)} no pueden informar de sus skills, así que aparecen como Desconocida.`,
  fixOnTools: "Se arregla actualizando en la página Herramientas.",
  fixOnToolsTo: (updates) => `Se arregla actualizando en la página Herramientas: ${esList(updates)}.`,
  toVersion: (tool, version) => `${tool} a ${version}`,
  comingRelease: "Lo arreglará una próxima versión.",

  foundProgram: "Programa en el PATH",
  foundFolder: "Encontrado por su carpeta de ajustes; el programa no está en el PATH",
  reads: (found, folders) => (
    <>
      {found} · lee {folders}
    </>
  ),
  disconnect: "Desconectar",
  disconnectFrom: (agent) => `Desconectar WireCat de ${agent}`,
  checkThis: "Comprobar este agente",
  alsoFix: "Qué más arreglar",
  recentSessions: "Sesiones recientes",
  tasksHeld: "Tareas que tiene",
  nothingElse: (agent) => `Nada más le impide funcionar a ${agent}.`,
  otherFixes: (agent) => `Otras cosas que arreglar para ${agent}`,
  profileSignedOut: (tool, profile) => (
    <>
      El perfil {profile} de {tool} no tiene la sesión iniciada
    </>
  ),
  profileSignedOutDetail: (agent, tool) =>
    `${agent} no puede usar ${tool} con este perfil hasta que vuelvas a iniciar sesión.`,
  signInTo: (tool, profile) => `Iniciar sesión en ${tool} (${profile})`,
  readingRunLogs: "Leyendo los registros de ejecución",
  noSessions: (agent) => `Los registros de ejecución de las herramientas no tienen ninguna sesión de ${agent}.`,
  noSessionId: "sin id de sesión",
  commandsRun: (n) => plural("es", n, { one: "# comando", other: "# comandos" }),
  failedCount: (n) => `${n} con error`,
  olderSessions: (n) => `y ${n} más antiguas en la página Registros`,
  copyCommand: "Copiar el comando",

  advancedMcp: "Avanzado: MCP",
  mcpIntro:
    "Para apps de chat y agentes en otro ordenador. Los agentes de este ordenador usan las herramientas directamente con su skill.",
  readingMcp: "Leyendo los servidores MCP",
  mcpUnread: (agent, file) => (
    <>
      WireCat no lee los servidores MCP de {agent}. Consulta {file}.
    </>
  ),
  noMcp: (agent) => `${agent} no tiene registrado ningún servidor MCP de WireCat.`,
  mcpList: (agent) => `Servidores MCP de WireCat en ${agent}`,
  readFrom: (source) => <>Leído de {source}</>,
  remove: "Quitar",
  removing: "Quitando…",
  removeServer: (server, agent) => `Quitar el servidor MCP ${server} de ${agent}`,

  until: (when) => `hasta ${when}`,
  release: "Liberar",
  releasing: "Liberando…",
  releaseTask: (task) => `Liberar ${task}`,

  noReason: "No ha funcionado y la herramienta no ha dado ningún motivo.",
  close: "Cerrar",
  cancel: "Cancelar",
  running: "Ejecutando…",
  tryAgain: "Reintentar",
  appRuns: "La app ejecuta",
  installSkillTitle: (tool, reader) => `¿Instalar la skill de ${tool} para ${reader}?`,
  updateSkillTitle: (tool, reader) => `¿Actualizar la skill de ${tool} para ${reader}?`,
  skillBody: (tool) => `${tool} escribe su propio archivo de skill, la versión que viene con él.`,
  installManyTitle: (n, agent) => `¿Instalar ${plural("es", n, { one: "# skill", other: "# skills" })} para ${agent}?`,
  updateManyTitle: (n, agent) => `¿Actualizar ${plural("es", n, { one: "# skill", other: "# skills" })} para ${agent}?`,
  eachWrites: (folders) => `Cada herramienta escribe su propio archivo de skill en ${esList(folders)}, una tras otra.`,
  othersToo: (agents) =>
    agents.length === 1
      ? `${esList(agents)} lee la misma carpeta y también recibe estas skills.`
      : `${esList(agents)} leen la misma carpeta y también reciben estas skills.`,
  removeServerTitle: (server, agent) => `¿Quitar el servidor MCP ${server} de ${agent}?`,
  removeServerBody: (agent, tool) =>
    `${agent} deja de arrancar este servidor MCP. La skill y la herramienta se quedan, y ${agent} sigue usando ${tool} con sus comandos.`,
  releaseTitle: (task) => `¿Liberar ${task}?`,
  releaseBody: (holder) =>
    `${holder} tiene esta tarea. Libérala cuando esa sesión haya terminado, para que otro agente pueda cogerla.`,

  needsNewer: (tool) => `Necesita una versión más nueva de ${tool}`,
  updateFirst: (tool) => `Actualiza ${tool} primero`,
  notOnTerminalPath: (tools) =>
    tools.length === 1
      ? `${esList(tools)} no está en el PATH del terminal`
      : `${esList(tools)} no están en el PATH del terminal`,
  terminalFixDetail: (tools, folders, agent) =>
    `Un terminal nuevo no encuentra ${esList(tools)}. Añade ${folders === 1 ? "su carpeta" : "sus carpetas"} al PATH en el perfil de tu shell y reinicia ${agent}.`,
  connectIntro: (agent) =>
    `Cada herramienta escribe su propia skill para ${agent}, para que ${agent} conozca sus comandos. Después WireCat comprueba que ${agent} encuentra cada herramienta. MCP no forma parte de esto.`,
  tools: "Herramientas",
  readOnly: "Solo lectura",
  readOnlyIntro: (agent) =>
    `Un perfil en solo lectura deja que ${agent} lea y busque con él, pero no que envíe, cambie ni borre nada. Puedes cambiarlo más tarde en los Permisos de la herramienta, en la página Herramientas.`,
  chooseTool: "Elige una herramienta para ver sus perfiles.",
  noProfiles: "Las herramientas elegidas no tienen perfiles.",
  connectTools: (n) => `Conectar ${plural("es", n, { one: "# herramienta", other: "# herramientas" })}`,
  connecting: "Conectando…",
  readingChats: (agent) => `Comprobando desde qué apps de chat se llega a ${agent}`,
  noChats: (agent) =>
    `${agent} no responde ahora en ninguna app de chat. Si añades una más tarde, cualquiera que acepte ese bot podrá pedirle que ejecute las herramientas que conectes.`,
  chatsReady: (agent, apps, stopped) =>
    `${agent} responde en ${esList(apps)}${stopped ? " (ahora está parado y vuelve a arrancar con ellas)" : ""}. Cualquiera que el bot acepte allí puede pedirle que ejecute las herramientas que conectes, con tus cuentas con sesión iniciada. Plantéate poner en solo lectura los perfiles de abajo.`,
  chatsFailed: (agent, error) =>
    `WireCat no pudo comprobar desde qué apps de chat se llega a ${agent} (${error}). Si responde en alguna, cualquiera que el bot acepte puede pedirle que ejecute las herramientas que conectes. Plantéate poner en solo lectura los perfiles de abajo.`,
  steps: "Pasos",
  stepState: { waiting: "en espera", running: "en curso", ok: "hecho", warn: "requiere atención", failed: "falló" },
  step: {
    skill: (tool) => `Skill de ${tool}`,
    readOnly: (tool, profile) => `${tool} (${profile}) en solo lectura`,
    finds: (agent) => `${agent} encuentra las herramientas`,
    written: "Escrita",
    keptBlock: (groups) => `Se mantiene el bloqueo en ${esList(groups)}.`,
    opened: (commands, tool) =>
      `Ahora permitidos y antes bloqueados: ${commands.join(", ")}. Vuelve a bloquearlos en los Permisos de ${tool}, en la página Herramientas.`,
    allBlocked: "Todos los comandos que cambian algo están bloqueados.",
    setUnknown: "Hecho; esta versión no puede decir qué comandos bloquea ahora.",
    stillAllowed: (n, tool) =>
      `Hecho, pero ${plural("es", n, { one: "# comando que cambia cosas sigue permitido", other: "# comandos que cambian cosas siguen permitidos" })}. Cámbialos en los Permisos de ${tool}, en la página Herramientas.`,
    noPath: "WireCat no pudo leer el PATH con el que ejecuta los comandos.",
    findsAll: (agent) => `${agent} encuentra todas las herramientas que elegiste`,
  },

  disconnectBody: (agent, folders) =>
    `Las herramientas de WireCat aún no tienen un comando que quite su skill, así que WireCat no la borra por ti. Para desconectar ${agent}, borra tú ${folders === 1 ? "esta carpeta" : "estas carpetas"}:`,
  othersLose: (agents, folders) =>
    agents.length === 1
      ? `${esList(agents)} también lee ${esList(folders)} y pierde también estas skills.`
      : `${esList(agents)} también leen ${esList(folders)} y pierden también estas skills.`,
  toolsStay: (agent) =>
    `Las herramientas siguen instaladas y ${agent} puede seguir ejecutándolas; sin la skill ya no conoce sus comandos.`,

  skillTitle: (tool) => `Skill de ${tool}`,
  comesWith: (bin) => `Viene con ${bin}`,
  inFolder: (folder) => <>En {folder}</>,
  notInstalled: "no instalada",
  differs:
    "Una copia instalada es de otra versión. Ver exactamente qué ha cambiado llegará con una actualización de la herramienta: todavía no puede mostrar la copia instalada. Al actualizar se sustituye por el texto de abajo.",
  readingSkill: "Leyendo la skill",

  check: esCheck,
}

export type AgentsMessages = typeof en

export const agentsMessages: Messages<AgentsMessages> = { en, ru, es }
