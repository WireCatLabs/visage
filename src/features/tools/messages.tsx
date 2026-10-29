import type { ReactNode } from "react"
import { type CatalogTool, tools } from "@/domain/catalog"
import type { DoctorNote } from "@/domain/doctor"
import { formatNumber, type Messages, plural } from "@/i18n"

type Em = (text: string) => ReactNode
type Step = Record<string, string>

const syncNote = (t: CatalogTool) => t.sync?.note?.replace(" {profile}", "") ?? null
const byId = (pick: (t: CatalogTool) => string | null | undefined) =>
  Object.fromEntries(tools.flatMap((t) => (pick(t) ? [[t.id, pick(t) as string]] : [])))

// ---------- English ----------

const en = {
  page: {
    title: "Tools",
    looking: "Looking for WireCat tools on this computer…",
    askingNpm: "Checking npm for newer versions…",
    checkAgain: "Check again",
    checking: "Checking…",
    inspectFailed: (error: string) => `Could not inspect this computer: ${error}`,
    systemFailed: (error: string) => `Could not check Node.js and npm: ${error}`,
    checkingStorage: "Checking storage",
    list: "WireCat tools",
    latestUnknown: "Could not ask npm for the latest versions, so updates are not shown.",
  },
  intro: {
    label: "About WireCat",
    text: "WireCat gives your AI agent your messengers, meetings, mail and documents. Each service has a small command-line tool that your agent runs; everything stays on this computer.",
    install: (em: Em): ReactNode => <>{em("Install")} the tools for the services you use.</>,
    signIn: (em: Em): ReactNode => <>{em("Sign in")} to an account under Manage.</>,
    connect: (link: Em): ReactNode => <>{link("Connect your agent")} on the Agents page.</>,
    choose: "Choose tools to install",
    hide: "Hide this introduction",
  },
  // tools.json is the English source; catalogs.test.ts fails until a new tool's text is translated.
  tool: {
    tagline: byId((t) => t.tagline),
    summary: byId((t) => t.summary),
    syncNote: byId(syncNote),
    group: Object.fromEntries(tools.flatMap((t) => t.permissions?.groups ?? []).map((g) => [g.key, g.label])),
  },
  row: {
    status: {
      checking: "Checking",
      missing: "Not installed",
      installing: "Installing",
      uninstalling: "Uninstalling",
      broken: "Installed, but it does not start",
      outdated: "Update available",
      readyChecking: "Installed, checking for updates",
      ready: "Installed and up to date",
    },
    withStorage: (status: string, storage: string) => `${status}. ${storage}`,
    partOf: (name: string) => `Part of ${name}`,
    copies: (n: number) => plural("en", n, { one: "# copy installed", other: "# copies installed" }),
    browserApp: "A browser app",
    nodeFirst: "Node.js is needed first",
    doesNotStart: "Does not start",
    notInstalled: "Not installed",
    cancel: "Cancel",
    updateTo: (version: string) => `Update to ${version}`,
    install: "Install",
    fix: "Fix",
    manage: "Manage",
  },
  install: {
    steps: {
      install: { check: "Checking requirements", install: "Installing", verify: "Verifying", done: "Done" } as Step,
      uninstall: { check: "Finding copies", remove: "Removing", verify: "Verifying", done: "Done" } as Step,
    },
    waiting: "Waiting for the operation in progress to finish.",
    installed: (names: string, version: string, shared: boolean) =>
      shared ? `${names} ${version} are installed and run.` : `${names} ${version} is installed and runs.`,
    removed: (names: string, shared: boolean) => (shared ? `${names} are uninstalled.` : `${names} is uninstalled.`),
    dataKept: "The data stays on this computer until you delete it in Storage.",
    dataDeleted: (size: string) => `Its data (${size}) is deleted.`,
    dataFailed: "Its data could not be deleted:",
    dataDeleting: "Deleting its data…",
    dataUntouched: "Its data was not touched.",
    cancelled: { install: "Installation cancelled.", uninstall: "Uninstalling cancelled." } as Step,
    timedOut: {
      install: "Installation took longer than 15 minutes and was stopped.",
      uninstall: "Uninstalling took longer than 15 minutes and was stopped.",
    } as Step,
    timedOutHint: "Check your connection and try again.",
    network: "Could not reach the npm registry.",
    networkHint: "Check your internet connection or proxy, then try again.",
    shadowed: (path: ReactNode): ReactNode => <>Another copy at {path} runs first in a terminal.</>,
    showLog: "Show log",
    hideLog: "Hide log",
    tryAgain: "Try again",
    addAccount: "Add an account",
    close: "Close",
    done: "Done",
    log: "Output log",
    waitingOutput: "Waiting for output…",
  },
  details: {
    installFirst: (name: string) => `Install ${name} to connect an account and run health checks.`,
    about: (name: string) => `About ${name}`,
    docs: "Documentation",
    github: "GitHub",
    installFromTerminal: "Install from a terminal",
    copyInstall: "Copy the install command",
    installedAt: "Installed at",
    notInstalledHere: "Not installed on this computer.",
    doesNotStart: "does not start",
    runsFirst: "runs first",
    notUsed: "not used",
    uninstall: "Uninstall",
    extraLabel: (name: string) => `More than one copy of ${name}`,
    extra: (n: number, bin: ReactNode, path: ReactNode, version: string, manager: string): ReactNode =>
      n === 2 ? (
        <>
          2 copies of {bin} are installed. A terminal runs {path} ({version}, {manager}); the other is never used and
          can confuse updates. Remove it with the program that installed it:
        </>
      ) : (
        <>
          {n} copies of {bin} are installed. A terminal runs {path} ({version}, {manager}); the others are never used
          and can confuse updates. Remove them with the program that installed them:
        </>
      ),
    removeCopy: (path: string) => `Copy the command that removes ${path}`,
    kind: { config: "config", state: "state", cache: "cache" } as Step,
  },
  uninstall: {
    title: (names: string) => `Uninstall ${names}?`,
    keep: "Keep it",
    uninstall: "Uninstall",
    andDelete: "Uninstall and delete data",
    together: (names: string) => `Uninstall removes ${names} together: they are one program.`,
    removes: (command: ReactNode, copies: number): ReactNode => (
      <>
        This removes the {command} command
        {copies === 2
          ? " (both copies, each with the program that installed it)"
          : copies > 2
            ? ` (all ${copies} copies, each with the program that installed it)`
            : ""}
        . Your profiles, storage and settings stay on this computer unless you delete them below.
      </>
    ),
    services:
      "If you set up background services with it (a server or a timer), remove them first with the tool itself.",
    alsoDelete: (name: string) => `Also delete ${name}'s data`,
    noData: "It has no data on this computer.",
    dataWhat: "Its settings, sign-in sessions and caches. Deleted only if the uninstall succeeds.",
    sharedStays: "Messages in the shared storage stay; other tools use it. Clear them on Storage.",
    foldersFailed: (error: string) => `Could not read its folders: ${error}`,
    readingFolders: "Reading its folders",
    folders: (name: string) => `${name}'s data folders`,
    inAll: (size: string) => `${size} in all`,
  },
  health: {
    section: (name: string) => `${name} accounts and health`,
    accounts: "Accounts",
    health: "Health",
    checkHealth: "Check health",
    checking: "Checking…",
    check: "Check",
    profilesFailed: (error: string) => `Could not list profiles: ${error}`,
    loadingProfiles: "Loading profiles",
    signedIn: "signed in",
    notSignedIn: "not signed in",
    signIn: "Sign in",
    setUp: "Set up",
    noAccountHere: (name: string) => `No account yet. Name it, then sign in to ${name} here or in a terminal window.`,
    noAccountTerminal: (name: string) => `No account yet. Name it, then sign in to ${name} in a terminal window.`,
    noAccount: "No account yet.",
    finishInTerminal: "Finish signing in in the terminal window, then press Check sign-in.",
    checkSignIn: "Check sign-in",
    manual: "Add an account from a terminal; this has no sign-in window yet.",
    howToSetUp: "How to set it up",
    copyAddAccount: (name: string) => `Copy the command that adds a ${name} account`,
    checkAgain: "Check again",
    profileName: "Name for this account",
    signInHere: "Sign in here",
    openTerminal: "Open terminal",
    openTerminalToSignIn: "Open terminal to sign in",
    nameInvalid: "Use letters, digits, dots, dashes or underscores.",
    nameHintHere: (command: ReactNode): ReactNode => (
      <>
        Any short name, such as personal or work: one name per account. Sign in here shows the QR code in this window;
        the terminal runs {command}.
      </>
    ),
    nameHintTerminal: (command: ReactNode): ReactNode => (
      <>Any short name, such as personal or work: one name per account. The terminal window runs {command}.</>
    ),
    noTerminal: "No terminal could be opened. Run this yourself:",
    copySetup: "Copy the setup command",
    configProblems: "Configuration problems",
    openSettingsFolder: "Open settings folder",
    copyFix: "Copy the fix command",
    fix: "Fix:",
    technical: "Technical details",
    command: "Command",
    exitCode: "Exit code",
    none: "none",
    took: "Took",
    hidden: "Account names, numbers, addresses and tokens are hidden.",
    running: "Running the check",
    note: {
      unreadable_issue: "A configuration problem could not be read.",
      invalid_setting: "A setting is not valid.",
      unknown_problem: "Unknown problem",
      tool_error: "The tool reported an error.",
      no_config: "No configuration file yet.",
      no_data: "No local data yet. Nothing has been synced.",
      no_token: "Not signed in: no token for this profile.",
      expired: "Sign-in has expired. Connect again to renew it.",
      not_signed_in: "Not signed in yet.",
      no_problems: "No problems found.",
    } as Record<Exclude<DoctorNote, "unreadable" | "stopped">, string>,
    unreadable: (code: string) => `The tool's answer could not be read (exit code ${code}).`,
    stopped: (code: string) => `The check stopped with exit code ${code}.`,
    unknownCode: "unknown",
  },
  storage: {
    heading: "Storage",
    cannotRead: (schema: number | null) =>
      schema === null ? "Can't read storage." : `Can't read storage (schema ${schema}).`,
    updateName: (name: string) => `Update ${name}.`,
    noNewer: "No newer version is out yet.",
    moves: (to: number, names: string) => `Its next run moves storage to schema ${to}; ${names} will stop reading it.`,
    labelCannotRead: "Can't read storage",
    labelMoves: "Will move storage past what other tools read",
    labelUnknown: "Can't say whether it reads storage",
    reads: (schema: number) => `Reads storage (schema ${schema}).`,
    readsNoFile: "Reads storage. There is no storage file yet.",
    unknown: (name: string, canUpdate: boolean) =>
      `This version of ${name} can't say whether it reads storage. ${canUpdate ? `Updating ${name} adds the check.` : "A later version adds the check."}`,
    locksOut: (name: string, to: number, min: number | null, names: string) =>
      `The next time ${name} runs, it moves storage to schema ${to}; reading it will take schema ${min} or later. ${names} read only older schemas and will stop reading storage. Update them first.`,
    movesAlone: (to: number) => `Reads storage, and moves it to schema ${to} when it next runs.`,
    movesAll: (to: number) =>
      `Reads storage, and moves it to schema ${to} when it next runs. Every other installed tool can read that.`,
    behind: (schema: number | null, needs: number, speaks: number | null, name: string) => {
      const written =
        schema === null
          ? `Storage needs a tool that reads schema ${needs} or later`
          : `A newer WireCat tool moved storage to schema ${schema}; reading it takes schema ${needs} or later`
      return `${written}${speaks === null ? "" : `, and this ${name} reads up to ${speaks}`}.`
    },
    updateToRead: (name: string) => `Update ${name} to read it again.`,
    noNewerOf: (name: string) => `No newer ${name} is out yet.`,
    allRead: "All installed tools can read storage.",
    cantSayYet: (_n: number, names: string) => `${names} can't say yet; a newer version adds the check.`,
    needUpdate: (n: number, names: string) =>
      n === 1
        ? `1 tool needs an update to read storage: ${names}.`
        : `${formatNumber(n, "en")} tools need an update to read storage: ${names}.`,
    noNewerVersions: "No newer versions are out yet.",
    updateOne: (name: string) => `Update ${name}`,
    updateThem: "Update them",
  },
  upgrade: {
    title: (tool: string, to: number) => `${tool} will move storage to schema ${to}`,
    notNow: "Not now",
    updateToo: (names: string) => `Update ${names} too`,
    locksOut: (n: number, names: string, to: number, name: string) =>
      `${names} can't read schema ${to}. ${n === 1 ? "It stops" : "They stop"} working with storage the next time ${name} runs, which may be soon if it runs in the background.`,
    mayLockOut: (n: number, names: string) =>
      n === 1
        ? `${names} can't say which schema it reads, so it may stop too.`
        : `${names} can't say which schema they read, so they may stop too.`,
    stuck: (n: number, names: string) =>
      `No newer ${names} is out yet, so updating can't fix ${n === 1 ? "it" : "them"} today.`,
  },
  clear: {
    title: "No WireCat tools are installed. Delete their data too?",
    keep: "Keep data",
    delete: (size: string) => `Delete ${size}`,
    text: (size: string) =>
      `The tools left ${size} on this computer: shared storage, sessions, settings and caches. Keep it if you may install them again; delete it to remove everything. Sign-in tokens in your system keyring are not touched.`,
  },
}

export type ToolsText = typeof en

// ---------- Russian ----------

const RU_TAGLINE: Record<string, string> = {
  tg: "Ваш аккаунт Telegram для терминала и ИИ-агентов",
  max: "Боты MAX и ваш личный аккаунт из терминала",
  wa: "Ваш аккаунт WhatsApp как связанное устройство",
  zm: "Расшифровки и записи Zoom с поиском",
  drive: "Папки Google Drive как локальный текст с поиском",
  memo: "Заметки, люди и воспоминания в одном месте для вашего агента",
  email: "Ваша почта, с поиском вместе с заметками и сообщениями",
}
const RU_SUMMARY: Record<string, string> = {
  tg: "Клиент Telegram для терминала и ИИ-агентов, на вашем собственном аккаунте.",
  max: "MAX Messenger из терминала: боты через официальный Bot API и ваш личный аккаунт.",
  wa: "Ваш аккаунт WhatsApp из терминала, как связанное устройство, для агентов и скриптов.",
  zm: "Сохраняйте расшифровки и записи Zoom, ищите в них нужное и давайте агенту контекст к следующему звонку.",
  drive:
    "Импортируйте выбранные папки Google, ищите по документам локально и храните теги, заметки и воспоминания со ссылкой на источник.",
  memo: "Ваши заметки и сообщения в одном месте для ИИ-агента: поиск, теги, люди и воспоминания — на вашем компьютере. Почта приходит через Email, который входит в Memo.",
  email:
    "Gmail и другая почта IMAP в локальном хранилище Memo, через Himalaya: ищите по ней вместе с заметками и сообщениями и смотрите, как продвигается каждый импорт. Импорт никогда не меняет ваш почтовый ящик, и Memo никогда не отправляет почту.",
}
const RU_NOTE: Record<string, string> = {
  wa: "WhatsApp присылает новые сообщения, пока работает `wa serve`; синхронизацию запускать не нужно.",
}

const RU_GROUP: Record<string, string> = {
  messages: "Сообщения",
  reactions: "Реакции",
  polls: "Опросы",
  topics: "Темы",
  chats: "Чаты и группы",
  contacts: "Контакты",
  account: "Аккаунт",
  attachments: "Файлы",
  tasks: "Задачи",
}

const ru: typeof en = {
  page: {
    title: "Инструменты",
    looking: "Ищем инструменты WireCat на этом компьютере…",
    askingNpm: "Проверяем в npm, есть ли новые версии…",
    checkAgain: "Проверить снова",
    checking: "Проверяем…",
    inspectFailed: (error) => `Не удалось проверить этот компьютер: ${error}`,
    systemFailed: (error) => `Не удалось проверить Node.js и npm: ${error}`,
    checkingStorage: "Проверяем хранилище",
    list: "Инструменты WireCat",
    latestUnknown: "Не удалось узнать в npm последние версии, поэтому обновления не показаны.",
  },
  intro: {
    label: "О WireCat",
    text: "WireCat даёт вашему ИИ-агенту доступ к мессенджерам, встречам, почте и документам. У каждого сервиса есть небольшой инструмент командной строки, который запускает агент; всё остаётся на этом компьютере.",
    install: (em) => <>{em("Установите")} инструменты для сервисов, которыми пользуетесь.</>,
    signIn: (em) => <>{em("Войдите")} в аккаунт в разделе «Управление».</>,
    connect: (link) => <>{link("Подключите агента")} на странице «Агенты».</>,
    choose: "Выбрать инструменты",
    hide: "Скрыть это вступление",
  },
  tool: { tagline: RU_TAGLINE, summary: RU_SUMMARY, syncNote: RU_NOTE, group: RU_GROUP },
  row: {
    status: {
      checking: "Проверяем",
      missing: "Не установлен",
      installing: "Устанавливается",
      uninstalling: "Удаляется",
      broken: "Установлен, но не запускается",
      outdated: "Есть обновление",
      readyChecking: "Установлен, ищем обновления",
      ready: "Установлен, последняя версия",
    },
    withStorage: (status, storage) => `${status}. ${storage}`,
    partOf: (name) => `Входит в ${name}`,
    copies: (n) =>
      plural("ru", n, {
        one: "# копия установлена",
        few: "# копии установлены",
        many: "# копий установлено",
        other: "# копии установлены",
      }),
    browserApp: "Приложение в браузере",
    nodeFirst: "Сначала нужен Node.js",
    doesNotStart: "Не запускается",
    notInstalled: "Не установлен",
    cancel: "Отменить",
    updateTo: (version) => `Обновить до ${version}`,
    install: "Установить",
    fix: "Исправить",
    manage: "Управление",
  },
  install: {
    steps: {
      install: { check: "Проверка требований", install: "Установка", verify: "Проверка", done: "Готово" },
      uninstall: { check: "Поиск копий", remove: "Удаление", verify: "Проверка", done: "Готово" },
    },
    waiting: "Ждём, пока закончится текущая операция.",
    installed: (names, version, shared) =>
      shared ? `${names} ${version} установлены и запускаются.` : `${names} ${version} установлен и запускается.`,
    removed: (names, shared) => (shared ? `${names} удалены.` : `${names} удалён.`),
    dataKept: "Данные остаются на этом компьютере, пока вы не удалите их в разделе «Хранилище».",
    dataDeleted: (size) => `Его данные (${size}) удалены.`,
    dataFailed: "Не удалось удалить его данные:",
    dataDeleting: "Удаляем его данные…",
    dataUntouched: "Его данные не тронуты.",
    cancelled: { install: "Установка отменена.", uninstall: "Удаление отменено." },
    timedOut: {
      install: "Установка шла дольше 15 минут и была остановлена.",
      uninstall: "Удаление шло дольше 15 минут и было остановлено.",
    },
    timedOutHint: "Проверьте подключение и попробуйте снова.",
    network: "Не удалось связаться с реестром npm.",
    networkHint: "Проверьте подключение к интернету или прокси и попробуйте снова.",
    shadowed: (path) => <>В терминале первой запускается другая копия: {path}.</>,
    showLog: "Показать журнал",
    hideLog: "Скрыть журнал",
    tryAgain: "Попробовать снова",
    addAccount: "Добавить аккаунт",
    close: "Закрыть",
    done: "Готово",
    log: "Журнал вывода",
    waitingOutput: "Ждём вывода…",
  },
  details: {
    installFirst: (name) => `Установите ${name}, чтобы подключить аккаунт и проверять его работу.`,
    about: (name) => `О ${name}`,
    docs: "Документация",
    github: "GitHub",
    installFromTerminal: "Установка из терминала",
    copyInstall: "Скопировать команду установки",
    installedAt: "Где установлен",
    notInstalledHere: "Не установлен на этом компьютере.",
    doesNotStart: "не запускается",
    runsFirst: "запускается первой",
    notUsed: "не используется",
    uninstall: "Удалить",
    extraLabel: (name) => `Несколько копий ${name}`,
    extra: (n, bin, path, version, manager) =>
      n === 2 ? (
        <>
          Установлены 2 копии {bin}. Терминал запускает {path} ({version}, {manager}); другая копия не используется и
          может мешать обновлениям. Удалите её программой, которая её установила:
        </>
      ) : (
        <>
          Установлено копий {bin}: {n}. Терминал запускает {path} ({version}, {manager}); остальные не используются и
          могут мешать обновлениям. Удалите их программами, которые их установили:
        </>
      ),
    removeCopy: (path) => `Скопировать команду, которая удаляет ${path}`,
    kind: { config: "настройки", state: "состояние", cache: "кэш" },
  },
  uninstall: {
    title: (names) => `Удалить ${names}?`,
    keep: "Оставить",
    uninstall: "Удалить",
    andDelete: "Удалить вместе с данными",
    together: (names) => `${names} удаляются вместе: это одна программа.`,
    removes: (command, copies) => (
      <>
        Будет удалена команда {command}
        {copies === 2
          ? " (обе копии, каждая — той программой, которая её установила)"
          : copies > 2
            ? ` (${plural("ru", copies, { one: "все # копия", few: "все # копии", many: "все # копий", other: "все # копии" })}, каждая — той программой, которая её установила)`
            : ""}
        . Профили, хранилище и настройки останутся на этом компьютере, если не удалить их ниже.
      </>
    ),
    services:
      "Если вы настроили с ним фоновые службы (сервер или таймер), сначала удалите их средствами самого инструмента.",
    alsoDelete: (name) => `Удалить и данные ${name}`,
    noData: "На этом компьютере у него нет данных.",
    dataWhat: "Его настройки, сеансы входа и кэш. Удаляются, только если удаление программы прошло успешно.",
    sharedStays:
      "Сообщения в общем хранилище останутся: им пользуются другие инструменты. Очистить их можно в разделе «Хранилище».",
    foldersFailed: (error) => `Не удалось прочитать его папки: ${error}`,
    readingFolders: "Читаем его папки",
    folders: (name) => `Папки с данными ${name}`,
    inAll: (size) => `Всего ${size}`,
  },
  health: {
    section: (name) => `Аккаунты и состояние ${name}`,
    accounts: "Аккаунты",
    health: "Состояние",
    checkHealth: "Проверить состояние",
    checking: "Проверяем…",
    check: "Проверить",
    profilesFailed: (error) => `Не удалось получить список профилей: ${error}`,
    loadingProfiles: "Загружаем профили",
    signedIn: "вход выполнен",
    notSignedIn: "вход не выполнен",
    signIn: "Войти",
    setUp: "Настроить",
    noAccountHere: (name) => `Аккаунтов пока нет. Дайте аккаунту имя и войдите в ${name} здесь или в окне терминала.`,
    noAccountTerminal: (name) => `Аккаунтов пока нет. Дайте аккаунту имя и войдите в ${name} в окне терминала.`,
    noAccount: "Аккаунтов пока нет.",
    finishInTerminal: "Завершите вход в окне терминала, затем нажмите «Проверить вход».",
    checkSignIn: "Проверить вход",
    manual: "Добавьте аккаунт из терминала: окна входа для этого инструмента пока нет.",
    howToSetUp: "Как настроить",
    copyAddAccount: (name) => `Скопировать команду, которая добавляет аккаунт ${name}`,
    checkAgain: "Проверить снова",
    profileName: "Имя для этого аккаунта",
    signInHere: "Войти здесь",
    openTerminal: "Открыть терминал",
    openTerminalToSignIn: "Войти через терминал",
    nameInvalid: "Используйте буквы, цифры, точки, дефисы или подчёркивания.",
    nameHintHere: (command) => (
      <>
        Любое короткое имя, например personal или work: одно имя на аккаунт. «Войти здесь» покажет QR-код в этом окне;
        терминал запускает {command}.
      </>
    ),
    nameHintTerminal: (command) => (
      <>Любое короткое имя, например personal или work: одно имя на аккаунт. Окно терминала запускает {command}.</>
    ),
    noTerminal: "Не удалось открыть терминал. Выполните это сами:",
    copySetup: "Скопировать команду настройки",
    configProblems: "Проблемы с настройками",
    openSettingsFolder: "Открыть папку настроек",
    copyFix: "Скопировать команду исправления",
    fix: "Исправить:",
    technical: "Технические подробности",
    command: "Команда",
    exitCode: "Код выхода",
    none: "нет",
    took: "Заняло",
    hidden: "Имена аккаунтов, номера, адреса и токены скрыты.",
    running: "Идёт проверка",
    note: {
      unreadable_issue: "Не удалось прочитать проблему с настройками.",
      invalid_setting: "Настройка задана неверно.",
      unknown_problem: "Неизвестная проблема",
      tool_error: "Инструмент сообщил об ошибке.",
      no_config: "Файла настроек пока нет.",
      no_data: "Локальных данных пока нет. Ничего не синхронизировано.",
      no_token: "Вход не выполнен: для этого профиля нет токена.",
      expired: "Срок входа истёк. Подключитесь снова, чтобы продлить его.",
      not_signed_in: "Вход ещё не выполнен.",
      no_problems: "Проблем не найдено.",
    },
    unreadable: (code) => `Не удалось прочитать ответ инструмента (код выхода ${code}).`,
    stopped: (code) => `Проверка завершилась с кодом выхода ${code}.`,
    unknownCode: "неизвестен",
  },
  storage: {
    heading: "Хранилище",
    cannotRead: (schema) =>
      schema === null ? "Не может прочитать хранилище." : `Не может прочитать хранилище (схема ${schema}).`,
    updateName: (name) => `Обновите ${name}.`,
    noNewer: "Новой версии пока нет.",
    moves: (to, names) => `При следующем запуске переведёт хранилище на схему ${to}; ${names} перестанут его читать.`,
    labelCannotRead: "Не может прочитать хранилище",
    labelMoves: "Переведёт хранилище на схему, которую другие инструменты не читают",
    labelUnknown: "Не сообщает, читает ли хранилище",
    reads: (schema) => `Читает хранилище (схема ${schema}).`,
    readsNoFile: "Читает хранилище. Файла хранилища пока нет.",
    unknown: (name, canUpdate) =>
      `Эта версия ${name} не сообщает, читает ли она хранилище. ${canUpdate ? `Обновление ${name} добавит эту проверку.` : "Проверка появится в одной из следующих версий."}`,
    locksOut: (name, to, min, names) =>
      `При следующем запуске ${name} переведёт хранилище на схему ${to}; для чтения понадобится схема ${min} или новее. ${names} читают только старые схемы и перестанут читать хранилище. Сначала обновите их.`,
    movesAlone: (to) => `Читает хранилище и при следующем запуске переведёт его на схему ${to}.`,
    movesAll: (to) =>
      `Читает хранилище и при следующем запуске переведёт его на схему ${to}. Все остальные установленные инструменты её читают.`,
    behind: (schema, needs, speaks, name) => {
      const written =
        schema === null
          ? `Хранилищу нужен инструмент, который читает схему ${needs} или новее`
          : `Более новый инструмент WireCat перевёл хранилище на схему ${schema}; для чтения нужна схема ${needs} или новее`
      return `${written}${speaks === null ? "" : `, а этот ${name} читает схемы до ${speaks}`}.`
    },
    updateToRead: (name) => `Обновите ${name}, чтобы он снова мог его читать.`,
    noNewerOf: (name) => `Новой версии ${name} пока нет.`,
    allRead: "Все установленные инструменты могут читать хранилище.",
    cantSayYet: (n, names) =>
      n === 1
        ? `${names} пока не сообщает об этом; проверка появится в новой версии.`
        : `${names} пока не сообщают об этом; проверка появится в новой версии.`,
    needUpdate: (n, names) =>
      plural("ru", n, {
        one: `# инструменту нужно обновление, чтобы читать хранилище: ${names}.`,
        few: `# инструментам нужно обновление, чтобы читать хранилище: ${names}.`,
        many: `# инструментам нужно обновление, чтобы читать хранилище: ${names}.`,
        other: `# инструментам нужно обновление, чтобы читать хранилище: ${names}.`,
      }),
    noNewerVersions: "Новых версий пока нет.",
    updateOne: (name) => `Обновить ${name}`,
    updateThem: "Обновить их",
  },
  upgrade: {
    title: (tool, to) => `${tool} переведёт хранилище на схему ${to}`,
    notNow: "Не сейчас",
    updateToo: (names) => `Обновить и ${names}`,
    locksOut: (n, names, to, name) =>
      n === 1
        ? `${names} не читает схему ${to}. Он перестанет работать с хранилищем при следующем запуске ${name}, а это может случиться скоро, если ${name} работает в фоне.`
        : `${names} не читают схему ${to}. Они перестанут работать с хранилищем при следующем запуске ${name}, а это может случиться скоро, если ${name} работает в фоне.`,
    mayLockOut: (n, names) =>
      n === 1
        ? `${names} не сообщает, какую схему читает, поэтому тоже может перестать работать.`
        : `${names} не сообщают, какую схему читают, поэтому тоже могут перестать работать.`,
    stuck: (n, names) =>
      n === 1
        ? `Новой версии ${names} пока нет, поэтому обновление сегодня не поможет.`
        : `Новых версий ${names} пока нет, поэтому обновление сегодня не поможет.`,
  },
  clear: {
    title: "Инструменты WireCat не установлены. Удалить и их данные?",
    keep: "Оставить данные",
    delete: (size) => `Удалить ${size}`,
    text: (size) =>
      `Инструменты оставили на этом компьютере ${size}: общее хранилище, сеансы, настройки и кэш. Оставьте их, если, возможно, установите инструменты снова; удалите, чтобы убрать всё. Токены входа в системном хранилище ключей не затрагиваются.`,
  },
}

// ---------- Spanish ----------

const ES_TAGLINE: Record<string, string> = {
  tg: "Tu cuenta de Telegram, para el terminal y los agentes de IA",
  max: "Bots de MAX y tu cuenta personal, desde el terminal",
  wa: "Tu cuenta de WhatsApp como dispositivo vinculado",
  zm: "Transcripciones y grabaciones de Zoom, con búsqueda",
  drive: "Carpetas de Google Drive como texto local con búsqueda",
  memo: "Notas, personas y memorias en un solo lugar para tu agente",
  email: "Tu correo, con búsqueda junto a tus notas y mensajes",
}
const ES_SUMMARY: Record<string, string> = {
  tg: "Un cliente de Telegram para el terminal y para agentes de IA, con tu propia cuenta.",
  max: "MAX Messenger desde el terminal: bots mediante la Bot API oficial y tu cuenta personal.",
  wa: "Tu cuenta de WhatsApp desde el terminal, como dispositivo vinculado, para agentes y scripts.",
  zm: "Guarda transcripciones y grabaciones de Zoom, busca en lo que se dijo en las reuniones y da contexto a tu agente para la próxima llamada.",
  drive:
    "Importa carpetas de Google seleccionadas, busca en los documentos en local y guarda etiquetas, notas y memorias con su fuente.",
  memo: "Tus notas y mensajes en un solo lugar para tu agente de IA: búsqueda, etiquetas, personas y memorias, en tu ordenador. El correo llega a través de Email, que forma parte de Memo.",
  email:
    "Gmail y otro correo IMAP en el almacenamiento local de Memo, leído con Himalaya: búscalo junto a tus notas y mensajes y mira cómo va cada importación. Importar nunca cambia tu buzón, y Memo nunca envía correo.",
}
const ES_NOTE: Record<string, string> = {
  wa: "WhatsApp envía los mensajes nuevos mientras se ejecuta `wa serve`; no hay sincronización que iniciar.",
}

const ES_GROUP: Record<string, string> = {
  messages: "Mensajes",
  reactions: "Reacciones",
  polls: "Encuestas",
  topics: "Temas",
  chats: "Chats y grupos",
  contacts: "Contactos",
  account: "Cuenta",
  attachments: "Archivos",
  tasks: "Tareas",
}

const es: typeof en = {
  page: {
    title: "Herramientas",
    looking: "Buscando herramientas de WireCat en este ordenador…",
    askingNpm: "Comprobando en npm si hay versiones nuevas…",
    checkAgain: "Comprobar de nuevo",
    checking: "Comprobando…",
    inspectFailed: (error) => `No se pudo revisar este ordenador: ${error}`,
    systemFailed: (error) => `No se pudo comprobar Node.js y npm: ${error}`,
    checkingStorage: "Comprobando el almacenamiento",
    list: "Herramientas de WireCat",
    latestUnknown: "No se pudo consultar en npm las últimas versiones, así que no se muestran actualizaciones.",
  },
  intro: {
    label: "Acerca de WireCat",
    text: "WireCat da a tu agente de IA acceso a tus mensajerías, reuniones, correo y documentos. Cada servicio tiene una pequeña herramienta de línea de comandos que ejecuta tu agente; todo se queda en este ordenador.",
    install: (em) => <>{em("Instala")} las herramientas de los servicios que usas.</>,
    signIn: (em) => <>{em("Inicia sesión")} en una cuenta desde Gestionar.</>,
    connect: (link) => <>{link("Conecta tu agente")} en la página Agentes.</>,
    choose: "Elegir herramientas",
    hide: "Ocultar esta introducción",
  },
  tool: { tagline: ES_TAGLINE, summary: ES_SUMMARY, syncNote: ES_NOTE, group: ES_GROUP },
  row: {
    status: {
      checking: "Comprobando",
      missing: "No instalada",
      installing: "Instalando",
      uninstalling: "Desinstalando",
      broken: "Instalada, pero no se inicia",
      outdated: "Hay una actualización",
      readyChecking: "Instalada, buscando actualizaciones",
      ready: "Instalada y al día",
    },
    withStorage: (status, storage) => `${status}. ${storage}`,
    partOf: (name) => `Parte de ${name}`,
    copies: (n) => plural("es", n, { one: "# copia instalada", other: "# copias instaladas" }),
    browserApp: "Una app del navegador",
    nodeFirst: "Primero hace falta Node.js",
    doesNotStart: "No se inicia",
    notInstalled: "No instalada",
    cancel: "Cancelar",
    updateTo: (version) => `Actualizar a ${version}`,
    install: "Instalar",
    fix: "Arreglar",
    manage: "Gestionar",
  },
  install: {
    steps: {
      install: { check: "Comprobando requisitos", install: "Instalando", verify: "Verificando", done: "Listo" },
      uninstall: { check: "Buscando copias", remove: "Eliminando", verify: "Verificando", done: "Listo" },
    },
    waiting: "Esperando a que termine la operación en curso.",
    installed: (names, version, shared) =>
      shared ? `${names} ${version} están instaladas y funcionan.` : `${names} ${version} está instalada y funciona.`,
    removed: (names, shared) => (shared ? `${names} se han desinstalado.` : `${names} se ha desinstalado.`),
    dataKept: "Los datos se quedan en este ordenador hasta que los borres en Almacenamiento.",
    dataDeleted: (size) => `Sus datos (${size}) se han borrado.`,
    dataFailed: "No se pudieron borrar sus datos:",
    dataDeleting: "Borrando sus datos…",
    dataUntouched: "Sus datos no se han tocado.",
    cancelled: { install: "Instalación cancelada.", uninstall: "Desinstalación cancelada." },
    timedOut: {
      install: "La instalación tardó más de 15 minutos y se detuvo.",
      uninstall: "La desinstalación tardó más de 15 minutos y se detuvo.",
    },
    timedOutHint: "Comprueba tu conexión y vuelve a intentarlo.",
    network: "No se pudo conectar con el registro de npm.",
    networkHint: "Comprueba tu conexión a internet o el proxy y vuelve a intentarlo.",
    shadowed: (path) => <>En un terminal se ejecuta primero otra copia, en {path}.</>,
    showLog: "Ver registro",
    hideLog: "Ocultar registro",
    tryAgain: "Reintentar",
    addAccount: "Añadir una cuenta",
    close: "Cerrar",
    done: "Listo",
    log: "Registro de salida",
    waitingOutput: "Esperando la salida…",
  },
  details: {
    installFirst: (name) => `Instala ${name} para conectar una cuenta y comprobar su estado.`,
    about: (name) => `Acerca de ${name}`,
    docs: "Documentación",
    github: "GitHub",
    installFromTerminal: "Instalar desde un terminal",
    copyInstall: "Copiar el comando de instalación",
    installedAt: "Instalada en",
    notInstalledHere: "No está instalada en este ordenador.",
    doesNotStart: "no se inicia",
    runsFirst: "se ejecuta primero",
    notUsed: "sin uso",
    uninstall: "Desinstalar",
    extraLabel: (name) => `Más de una copia de ${name}`,
    extra: (n, bin, path, version, manager) =>
      n === 2 ? (
        <>
          Hay 2 copias de {bin} instaladas. Un terminal ejecuta {path} ({version}, {manager}); la otra nunca se usa y
          puede confundir las actualizaciones. Elimínala con el programa que la instaló:
        </>
      ) : (
        <>
          Hay {n} copias de {bin} instaladas. Un terminal ejecuta {path} ({version}, {manager}); las demás nunca se usan
          y pueden confundir las actualizaciones. Elimínalas con el programa que las instaló:
        </>
      ),
    removeCopy: (path) => `Copiar el comando que elimina ${path}`,
    kind: { config: "ajustes", state: "estado", cache: "caché" },
  },
  uninstall: {
    title: (names) => `¿Desinstalar ${names}?`,
    keep: "Conservar",
    uninstall: "Desinstalar",
    andDelete: "Desinstalar y borrar datos",
    together: (names) => `Desinstalar elimina ${names} a la vez: son un solo programa.`,
    removes: (command, copies) => (
      <>
        Esto elimina el comando {command}
        {copies === 2
          ? " (las dos copias, cada una con el programa que la instaló)"
          : copies > 2
            ? ` (las ${copies} copias, cada una con el programa que la instaló)`
            : ""}
        . Tus perfiles, almacenamiento y ajustes se quedan en este ordenador salvo que los borres abajo.
      </>
    ),
    services:
      "Si configuraste servicios en segundo plano con ella (un servidor o un temporizador), elimínalos antes con la propia herramienta.",
    alsoDelete: (name) => `Borrar también los datos de ${name}`,
    noData: "No tiene datos en este ordenador.",
    dataWhat: "Sus ajustes, sesiones iniciadas y cachés. Solo se borran si la desinstalación sale bien.",
    sharedStays:
      "Los mensajes del almacenamiento compartido se quedan; otras herramientas lo usan. Puedes vaciarlo en Almacenamiento.",
    foldersFailed: (error) => `No se pudieron leer sus carpetas: ${error}`,
    readingFolders: "Leyendo sus carpetas",
    folders: (name) => `Carpetas de datos de ${name}`,
    inAll: (size) => `${size} en total`,
  },
  health: {
    section: (name) => `Cuentas y estado de ${name}`,
    accounts: "Cuentas",
    health: "Estado",
    checkHealth: "Comprobar estado",
    checking: "Comprobando…",
    check: "Comprobar",
    profilesFailed: (error) => `No se pudieron listar los perfiles: ${error}`,
    loadingProfiles: "Cargando perfiles",
    signedIn: "sesión iniciada",
    notSignedIn: "sin sesión",
    signIn: "Iniciar sesión",
    setUp: "Configurar",
    noAccountHere: (name) =>
      `Aún no hay ninguna cuenta. Ponle un nombre e inicia sesión en ${name} aquí o en una ventana de terminal.`,
    noAccountTerminal: (name) =>
      `Aún no hay ninguna cuenta. Ponle un nombre e inicia sesión en ${name} en una ventana de terminal.`,
    noAccount: "Aún no hay ninguna cuenta.",
    finishInTerminal: "Termina de iniciar sesión en la ventana del terminal y pulsa Comprobar sesión.",
    checkSignIn: "Comprobar sesión",
    manual: "Añade una cuenta desde un terminal; esta herramienta aún no tiene ventana de inicio de sesión.",
    howToSetUp: "Cómo configurarla",
    copyAddAccount: (name) => `Copiar el comando que añade una cuenta de ${name}`,
    checkAgain: "Comprobar de nuevo",
    profileName: "Nombre para esta cuenta",
    signInHere: "Iniciar sesión aquí",
    openTerminal: "Abrir terminal",
    openTerminalToSignIn: "Iniciar sesión en el terminal",
    nameInvalid: "Usa letras, cifras, puntos, guiones o guiones bajos.",
    nameHintHere: (command) => (
      <>
        Cualquier nombre corto, como personal o work: un nombre por cuenta. Iniciar sesión aquí muestra el código QR en
        esta ventana; el terminal ejecuta {command}.
      </>
    ),
    nameHintTerminal: (command) => (
      <>
        Cualquier nombre corto, como personal o work: un nombre por cuenta. La ventana del terminal ejecuta {command}.
      </>
    ),
    noTerminal: "No se pudo abrir ningún terminal. Ejecuta esto tú:",
    copySetup: "Copiar el comando de configuración",
    configProblems: "Problemas de configuración",
    openSettingsFolder: "Abrir la carpeta de ajustes",
    copyFix: "Copiar el comando que lo arregla",
    fix: "Arreglo:",
    technical: "Detalles técnicos",
    command: "Comando",
    exitCode: "Código de salida",
    none: "ninguno",
    took: "Duró",
    hidden: "Los nombres de cuenta, números, direcciones y tokens están ocultos.",
    running: "Ejecutando la comprobación",
    note: {
      unreadable_issue: "No se pudo leer un problema de configuración.",
      invalid_setting: "Un ajuste no es válido.",
      unknown_problem: "Problema desconocido",
      tool_error: "La herramienta informó de un error.",
      no_config: "Aún no hay archivo de configuración.",
      no_data: "Aún no hay datos locales. No se ha sincronizado nada.",
      no_token: "Sin sesión: no hay token para este perfil.",
      expired: "La sesión ha caducado. Vuelve a conectar para renovarla.",
      not_signed_in: "Aún no has iniciado sesión.",
      no_problems: "No se encontraron problemas.",
    },
    unreadable: (code) => `No se pudo leer la respuesta de la herramienta (código de salida ${code}).`,
    stopped: (code) => `La comprobación terminó con el código de salida ${code}.`,
    unknownCode: "desconocido",
  },
  storage: {
    heading: "Almacenamiento",
    cannotRead: (schema) =>
      schema === null ? "No puede leer el almacenamiento." : `No puede leer el almacenamiento (esquema ${schema}).`,
    updateName: (name) => `Actualiza ${name}.`,
    noNewer: "Aún no hay una versión más nueva.",
    moves: (to, names) => `Su próxima ejecución pasa el almacenamiento al esquema ${to}; ${names} dejarán de leerlo.`,
    labelCannotRead: "No puede leer el almacenamiento",
    labelMoves: "Pasará el almacenamiento a un esquema que otras herramientas no leen",
    labelUnknown: "No dice si lee el almacenamiento",
    reads: (schema) => `Lee el almacenamiento (esquema ${schema}).`,
    readsNoFile: "Lee el almacenamiento. Aún no hay archivo de almacenamiento.",
    unknown: (name, canUpdate) =>
      `Esta versión de ${name} no dice si lee el almacenamiento. ${canUpdate ? `Actualizar ${name} añade la comprobación.` : "Una versión posterior añade la comprobación."}`,
    locksOut: (name, to, min, names) =>
      `La próxima vez que se ejecute ${name}, pasará el almacenamiento al esquema ${to}; para leerlo hará falta el esquema ${min} o posterior. ${names} solo leen esquemas anteriores y dejarán de leer el almacenamiento. Actualízalas primero.`,
    movesAlone: (to) => `Lee el almacenamiento y lo pasa al esquema ${to} en su próxima ejecución.`,
    movesAll: (to) =>
      `Lee el almacenamiento y lo pasa al esquema ${to} en su próxima ejecución. Todas las demás herramientas instaladas pueden leerlo.`,
    behind: (schema, needs, speaks, name) => {
      const written =
        schema === null
          ? `El almacenamiento necesita una herramienta que lea el esquema ${needs} o posterior`
          : `Una herramienta de WireCat más nueva pasó el almacenamiento al esquema ${schema}; para leerlo hace falta el esquema ${needs} o posterior`
      return `${written}${speaks === null ? "" : `, y este ${name} lee hasta el ${speaks}`}.`
    },
    updateToRead: (name) => `Actualiza ${name} para volver a leerlo.`,
    noNewerOf: (name) => `Aún no hay un ${name} más nuevo.`,
    allRead: "Todas las herramientas instaladas pueden leer el almacenamiento.",
    cantSayYet: (n, names) =>
      n === 1
        ? `${names} aún no lo dice; una versión más nueva añade la comprobación.`
        : `${names} aún no lo dicen; una versión más nueva añade la comprobación.`,
    needUpdate: (n, names) =>
      plural("es", n, {
        one: `# herramienta necesita una actualización para leer el almacenamiento: ${names}.`,
        other: `# herramientas necesitan una actualización para leer el almacenamiento: ${names}.`,
      }),
    noNewerVersions: "Aún no hay versiones más nuevas.",
    updateOne: (name) => `Actualizar ${name}`,
    updateThem: "Actualizarlas",
  },
  upgrade: {
    title: (tool, to) => `${tool} pasará el almacenamiento al esquema ${to}`,
    notNow: "Ahora no",
    updateToo: (names) => `Actualizar también ${names}`,
    locksOut: (n, names, to, name) =>
      n === 1
        ? `${names} no puede leer el esquema ${to}. Dejará de funcionar con el almacenamiento la próxima vez que se ejecute ${name}, y eso puede ser pronto si ${name} funciona en segundo plano.`
        : `${names} no pueden leer el esquema ${to}. Dejarán de funcionar con el almacenamiento la próxima vez que se ejecute ${name}, y eso puede ser pronto si ${name} funciona en segundo plano.`,
    mayLockOut: (n, names) =>
      n === 1
        ? `${names} no dice qué esquema lee, así que también puede dejar de funcionar.`
        : `${names} no dicen qué esquema leen, así que también pueden dejar de funcionar.`,
    stuck: (n, names) =>
      n === 1
        ? `Aún no hay una versión más nueva de ${names}, así que actualizar no lo arregla hoy.`
        : `Aún no hay versiones más nuevas de ${names}, así que actualizar no las arregla hoy.`,
  },
  clear: {
    title: "No hay herramientas de WireCat instaladas. ¿Borrar también sus datos?",
    keep: "Conservar datos",
    delete: (size) => `Borrar ${size}`,
    text: (size) =>
      `Las herramientas dejaron ${size} en este ordenador: almacenamiento compartido, sesiones, ajustes y cachés. Consérvalo si puedes volver a instalarlas; bórralo para quitarlo todo. Los tokens de inicio de sesión del llavero del sistema no se tocan.`,
  },
}

/** A tool's own text in the reader's language, or tools.json's English for a tool not translated yet. */
export const toolText = (m: ToolsText, t: CatalogTool) => ({
  tagline: m.tool.tagline[t.id] ?? t.tagline,
  summary: m.tool.summary[t.id] ?? t.summary,
  syncNote: m.tool.syncNote[t.id] ?? syncNote(t),
})

export const groupLabel = (m: ToolsText, key: string, label: string) => m.tool.group[key] ?? label

export const toolsMessages: Messages<ToolsText> = { en, ru, es }
