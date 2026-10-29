import type { ReactNode } from "react"
import { type CatalogTool, tools } from "@/domain/catalog"
import { type Messages, plural } from "@/i18n"
import type { StepId } from "./store"

type Page = { title: string; lead: string }
type Stop = { title: string; text: string }
type ById = Record<string, string>

const byId = (pick: (t: CatalogTool) => string | null | undefined) =>
  Object.fromEntries(tools.flatMap((t) => (pick(t) ? [[t.id, pick(t) as string]] : [])))

const en = {
  steps: {
    welcome: "Welcome",
    computer: "Your computer",
    choose: "Choose tools",
    install: "Install",
    agents: "Agents",
    signin: "Sign in",
    done: "Done",
  } as Record<StepId, string>,
  pages: {
    welcome: {
      title: "Welcome to WireCat",
      lead: "Connect your AI agent (Claude Code, Codex and others) to your own messages, mail, meetings and files.",
    },
    computer: {
      title: "Your computer",
      lead: "WireCat tools run on Node.js and install with npm. WireCat Desktop itself runs without them.",
    },
    choose: {
      title: "Choose tools",
      lead: "Pick the services your agent should reach. You can add or remove tools later.",
    },
    install: {
      title: "Install",
      lead: "Each tool is installed from npm and checked that it starts. One runs at a time.",
    },
    agents: {
      title: "Connect agents",
      lead: "Your agent learns to use each tool from a skill: a short guide to the tool's commands and when to use them.",
    },
    signin: {
      title: "Sign in",
      lead: "Signing in connects a tool to your account, so your agent can reach it. Each tool runs its own sign-in in a terminal window; you come back here when it is done.",
    },
    done: {
      title: "You are set up",
      lead: "The tools below are installed on this computer. Help, the question mark at the top, has a short tour of the window.",
    },
  } as Record<StepId, Page>,
  flow: {
    stepsNav: "Setup steps",
    later: "Set up later",
    laterNote: "Finish later from the sidebar.",
    getStarted: "Get started",
    installTools: (n: number) => plural("en", n, { one: "Install # tool", other: "Install # tools" }),
    openTools: "Open Tools",
    continue: "Continue",
    back: "Back",
    skip: "Skip",
    tour: "Take the tour",
  },
  welcome: {
    list: "What WireCat does",
    localTitle: "Everything stays on this computer",
    local:
      "The tools keep your messages, mail, meetings and files in storage on this computer, not in a WireCat cloud.",
    openTitle: "Open tools you could run yourself",
    open: "Each integration is a WireCat command-line tool from npm. This app installs them and runs their own commands.",
    agentTitle: "Your agent does the rest",
    agent: "Claude Code, Codex and other agents use the tools to search and act on your data when you ask them to.",
    time: "Setup takes a few minutes. You can skip any step.",
  },
  computer: {
    list: "Your computer",
    system: "System",
    notFound: "Not found",
    checkingComputer: "Checking this computer…",
    ready: "Ready to install WireCat tools.",
    checking: "Checking…",
    again: "Check again",
  },
  choose: {
    legend: "Tools to install",
    partOf: (name: string) => `Part of ${name}`,
    installed: "installed",
  },
  install: {
    list: "Installing",
    notInstalled: "Not installed",
    checking: "Checking…",
    queued: "Waiting for its turn",
    installing: "Installing",
    step: (label: string) => `${label}…`,
    installed: (version: ReactNode): ReactNode => <>Installed {version}</>,
    already: (version: ReactNode): ReactNode => <>Already installed {version}</>,
    tryAgain: "Try again",
    none: "No tools are chosen, so there is nothing to install.",
    choose: "Choose tools",
    rest: "Install the rest",
    note: "Installs keep going if you move on. Each one is also shown on the Tools page, with its full log.",
  },
  agents: {
    title: "How a tool adds its skill",
    text: "Some tools offer to add their skill while you sign in, in the next step: the terminal asks which agent should get it. Any tool can also add its own skill from a terminal, for Claude Code, Codex and Gemini CLI.",
    list: "Skill commands",
  },
  signIn: {
    list: "Tools to sign in to",
    looking: "Looking for installed tools",
    accounts: (tool: string) => `${tool} accounts`,
    reading: (tool: string) => `Reading ${tool} accounts`,
    added: (name: ReactNode): ReactNode => <>Account {name} is added</>,
    signedIn: (name: ReactNode): ReactNode => <>Signed in as profile {name}</>,
    signedOut: (name: ReactNode): ReactNode => <>Profile {name} is not signed in</>,
    unknown: (name: ReactNode): ReactNode => <>Profile {name}: sign-in not reported</>,
    signIn: "Sign in",
    inTerminal: "Open terminal to sign in",
    listFailed: (error: string) => `Could not list the accounts: ${error}`,
    noAccount: (tool: string) => `No account yet. Add one so your agent can use ${tool}.`,
    needs: "What it needs: ",
    willAsk: "It will ask for: ",
    guide: "How to make it",
    nameAnother: "Name for another account",
    nameThis: "Name for this account",
    addAnother: "Add another account",
    add: "Add an account",
    noneNeeded: "No installed tool needs a sign-in yet.",
    later: (n: number, names: string) =>
      n === 1
        ? `${names} can sign in once installed: open it on the Tools page and choose Manage.`
        : `${names} can sign in once installed: open each on the Tools page and choose Manage.`,
    noSignIn: (n: number, names: string) => (n === 1 ? `${names} needs no sign-in.` : `${names} need no sign-in.`),
    gives: byId((t) => t.signIn?.gives) as ById,
    asks: byId((t) => t.signIn?.asks) as ById,
  },
  done: {
    list: "Your tools",
    notInstalled: "Not installed",
    next: "What next",
    connect: (tool: string) => `Let ChatGPT or Claude use ${tool}`,
    agents: "See which agents use them",
  },
  help: {
    help: "Help",
    tour: "Take the tour",
    welcome: "Show the welcome again",
    about: "About WireCat",
  },
  tour: {
    readiness: {
      title: "Your computer",
      text: "WireCat tools run on Node.js and npm. A green lamp means it is here and new enough; hover a value to see where it was found.",
    },
    lamps: {
      title: "Status lamps",
      text: "Green: installed and current. Amber: an update is ready. Red: installed, but it does not start. A hollow ring: not installed.",
    },
    action: {
      title: "One action per tool",
      text: "Install or Update puts the latest version on this computer. Manage opens the tool's profiles, sign-in and health check.",
    },
    again: {
      title: "Check again",
      text: "Installed or removed something in a terminal? Check again looks at this computer and npm once more.",
    },
    storage: {
      title: "Storage",
      text: "How much space each tool's data takes, and a way to delete it once nothing uses it.",
    },
    logs: {
      title: "Logs",
      text: "What each tool did, run by run: the command, how long it took and what went wrong.",
    },
    help: {
      title: "Help is here",
      text: "Start this tour again, or go back to the setup steps, from this button.",
    },
  } as Record<"readiness" | "lamps" | "action" | "again" | "storage" | "logs" | "help", Stop>,
}

export type OnboardingText = typeof en
export type TourStop = keyof OnboardingText["tour"]

const ru: OnboardingText = {
  steps: {
    welcome: "Начало",
    computer: "Компьютер",
    choose: "Выбор",
    install: "Установка",
    agents: "Агенты",
    signin: "Вход",
    done: "Готово",
  },
  pages: {
    welcome: {
      title: "Добро пожаловать в WireCat",
      lead: "Подключите своего ИИ-агента (Claude Code, Codex и другие) к вашим сообщениям, почте, встречам и файлам.",
    },
    computer: {
      title: "Ваш компьютер",
      lead: "Инструменты WireCat работают на Node.js и устанавливаются через npm. Самому WireCat Desktop они не нужны.",
    },
    choose: {
      title: "Выберите инструменты",
      lead: "Отметьте сервисы, к которым агент должен получить доступ. Добавить или убрать инструменты можно и потом.",
    },
    install: {
      title: "Установка",
      lead: "Каждый инструмент ставится из npm, а затем мы проверяем, что он запускается. Установки идут по одной.",
    },
    agents: {
      title: "Подключите агентов",
      lead: "Агент учится работать с инструментом по навыку: это короткое руководство по его командам и по тому, когда их применять.",
    },
    signin: {
      title: "Вход",
      lead: "Вход связывает инструмент с вашим аккаунтом, и агент получает к нему доступ. Каждый инструмент проводит вход сам, в окне терминала; когда закончите, возвращайтесь сюда.",
    },
    done: {
      title: "Всё готово",
      lead: "Инструменты ниже установлены на этом компьютере. В «Помощи» (знак вопроса вверху) есть короткая экскурсия по окну.",
    },
  },
  flow: {
    stepsNav: "Шаги настройки",
    later: "Настроить позже",
    laterNote: "Закончить можно позже, из боковой панели.",
    getStarted: "Начать",
    installTools: (n) =>
      plural("ru", n, {
        one: "Установить # инструмент",
        few: "Установить # инструмента",
        many: "Установить # инструментов",
        other: "Установить # инструмента",
      }),
    openTools: "Открыть инструменты",
    continue: "Продолжить",
    back: "Назад",
    skip: "Пропустить",
    tour: "Пройти экскурсию",
  },
  welcome: {
    list: "Что делает WireCat",
    localTitle: "Всё остаётся на этом компьютере",
    local:
      "Инструменты хранят ваши сообщения, почту, встречи и файлы в хранилище на этом компьютере, а не в облаке WireCat.",
    openTitle: "Открытые инструменты, которые можно запускать самому",
    open: "Каждая интеграция — это консольный инструмент WireCat из npm. Приложение устанавливает их и запускает их собственные команды.",
    agentTitle: "Остальное сделает агент",
    agent:
      "Claude Code, Codex и другие агенты ищут в ваших данных и действуют с ними через эти инструменты, когда вы их об этом просите.",
    time: "Настройка займёт несколько минут. Любой шаг можно пропустить.",
  },
  computer: {
    list: "Ваш компьютер",
    system: "Система",
    notFound: "Не найден",
    checkingComputer: "Проверяем этот компьютер…",
    ready: "Всё готово для установки инструментов WireCat.",
    checking: "Проверяем…",
    again: "Проверить снова",
  },
  choose: {
    legend: "Инструменты для установки",
    partOf: (name) => `Входит в ${name}`,
    installed: "установлен",
  },
  install: {
    list: "Установка",
    notInstalled: "Не установлен",
    checking: "Проверяем…",
    queued: "Ждёт своей очереди",
    installing: "Устанавливается",
    step: (label) => `${label}…`,
    installed: (version) => <>Установлен {version}</>,
    already: (version) => <>Уже установлен {version}</>,
    tryAgain: "Попробовать снова",
    none: "Инструменты не выбраны, поэтому устанавливать нечего.",
    choose: "Выбрать инструменты",
    rest: "Установить остальные",
    note: "Установка продолжится, если вы перейдёте дальше. Каждую из них также видно на странице «Инструменты» вместе с полным журналом.",
  },
  agents: {
    title: "Как инструмент добавляет свой навык",
    text: "Некоторые инструменты предлагают добавить навык во время входа, на следующем шаге: терминал спросит, какому агенту его отдать. Любой инструмент может добавить свой навык и из терминала — для Claude Code, Codex и Gemini CLI.",
    list: "Команды для навыков",
  },
  signIn: {
    list: "Инструменты для входа",
    looking: "Ищем установленные инструменты",
    accounts: (tool) => `Аккаунты ${tool}`,
    reading: (tool) => `Читаем аккаунты ${tool}`,
    added: (name) => <>Аккаунт {name} добавлен</>,
    signedIn: (name) => <>Вход выполнен, профиль {name}</>,
    signedOut: (name) => <>Профиль {name}: вход не выполнен</>,
    unknown: (name) => <>Профиль {name}: инструмент не сообщает о входе</>,
    signIn: "Войти",
    inTerminal: "Войти в терминале",
    listFailed: (error) => `Не удалось получить список аккаунтов: ${error}`,
    noAccount: (tool) => `Аккаунта пока нет. Добавьте его, чтобы агент мог работать с ${tool}.`,
    needs: "Что нужно: ",
    willAsk: "Он попросит: ",
    guide: "Как его создать",
    nameAnother: "Имя для ещё одного аккаунта",
    nameThis: "Имя для этого аккаунта",
    addAnother: "Добавить ещё аккаунт",
    add: "Добавить аккаунт",
    noneNeeded: "Пока ни одному установленному инструменту не нужен вход.",
    later: (n, names) =>
      n === 1
        ? `В ${names} можно будет войти после установки: откройте его на странице «Инструменты» и нажмите «Управление».`
        : `В ${names} можно будет войти после установки: откройте каждый на странице «Инструменты» и нажмите «Управление».`,
    noSignIn: (_n, names) => `Для ${names} вход не нужен.`,
    gives: {
      tg: "Агент сможет читать ваши чаты в Telegram, искать в них и отправлять сообщения, когда вы попросите.",
      max: "Агент сможет читать ваши чаты в MAX, искать в них и отправлять сообщения, когда вы попросите.",
      wa: "Агент сможет читать ваши чаты в WhatsApp, искать в них и отправлять сообщения, когда вы попросите.",
      zm: "Агент сможет находить ваши встречи в Zoom и читать их расшифровки и итоги.",
      drive: "Агент сможет находить и читать ваши файлы на Google Drive. Изменять их он не сможет.",
      email:
        "Агент сможет искать в вашей почте вместе с заметками и сообщениями. Memo читает почтовый ящик, ничего в нём не меняя, и никогда не отправляет писем.",
    },
    asks: {
      tg: "В первый раз — номер телефона и код, который пришлёт Telegram: так регистрируется ваше собственное приложение Telegram. Затем QR-код, который нужно отсканировать в Telegram: «Настройки → Устройства → Подключить устройство».",
      max: "QR-код, который нужно отсканировать приложением MAX на телефоне.",
      wa: "QR-код, который нужно отсканировать в WhatsApp: «Настройки → Связанные устройства → Привязка устройства».",
      zm: "Браузер откроет Zoom, чтобы вы разрешили доступ. Сначала Zoom нужно ваше собственное приложение, которое один раз создаётся в Zoom App Marketplace.",
      drive: "Браузер откроет Google: выберите аккаунт и разрешите доступ к Drive только на чтение.",
      email:
        "Сначала аккаунт настраивается в Himalaya, почтовой программе для терминала; для Gmail — с паролем приложения. Затем имя аккаунта Himalaya и его адрес передаются в Memo.",
    },
  },
  done: {
    list: "Ваши инструменты",
    notInstalled: "Не установлен",
    next: "Что дальше",
    connect: (tool) => `Дать ChatGPT или Claude доступ к ${tool}`,
    agents: "Посмотреть, какие агенты их используют",
  },
  help: {
    help: "Помощь",
    tour: "Пройти экскурсию",
    welcome: "Снова показать приветствие",
    about: "О WireCat",
  },
  tour: {
    readiness: {
      title: "Ваш компьютер",
      text: "Инструменты WireCat работают на Node.js и npm. Зелёная лампа значит, что программа есть и её версия достаточно новая; наведите на значение, чтобы увидеть, где она найдена.",
    },
    lamps: {
      title: "Лампы состояния",
      text: "Зелёная: установлен, последняя версия. Жёлтая: есть обновление. Красная: установлен, но не запускается. Пустое кольцо: не установлен.",
    },
    action: {
      title: "Одно действие на инструмент",
      text: "«Установить» или «Обновить» ставит на компьютер последнюю версию. «Управление» открывает профили инструмента, вход и проверку состояния.",
    },
    again: {
      title: "Проверить снова",
      text: "Установили или удалили что-то в терминале? «Проверить снова» ещё раз посмотрит на этот компьютер и в npm.",
    },
    storage: {
      title: "Хранилище",
      text: "Сколько места занимают данные каждого инструмента, и как удалить их, когда они больше не нужны.",
    },
    logs: {
      title: "Журнал",
      text: "Что делал каждый инструмент, запуск за запуском: команда, сколько она шла и что пошло не так.",
    },
    help: {
      title: "Помощь здесь",
      text: "Этой кнопкой можно снова начать экскурсию или вернуться к шагам настройки.",
    },
  },
}

const es: OnboardingText = {
  steps: {
    welcome: "Bienvenida",
    computer: "Tu ordenador",
    choose: "Herramientas",
    install: "Instalación",
    agents: "Agentes",
    signin: "Inicio de sesión",
    done: "Listo",
  },
  pages: {
    welcome: {
      title: "Te damos la bienvenida a WireCat",
      lead: "Conecta tu agente de IA (Claude Code, Codex y otros) a tus propios mensajes, correo, reuniones y archivos.",
    },
    computer: {
      title: "Tu ordenador",
      lead: "Las herramientas de WireCat funcionan con Node.js y se instalan con npm. WireCat Desktop funciona sin ellos.",
    },
    choose: {
      title: "Elige herramientas",
      lead: "Marca los servicios a los que debe llegar tu agente. Puedes añadir o quitar herramientas más tarde.",
    },
    install: {
      title: "Instalación",
      lead: "Cada herramienta se instala desde npm y se comprueba que arranca. Se instalan de una en una.",
    },
    agents: {
      title: "Conecta agentes",
      lead: "Tu agente aprende a usar cada herramienta con una skill: una guía breve de sus comandos y de cuándo usarlos.",
    },
    signin: {
      title: "Inicia sesión",
      lead: "Al iniciar sesión, la herramienta se conecta a tu cuenta y tu agente puede llegar a ella. Cada herramienta hace su propio inicio de sesión en una ventana de terminal; vuelve aquí cuando termines.",
    },
    done: {
      title: "Todo listo",
      lead: "Las herramientas de abajo están instaladas en este ordenador. En Ayuda, el signo de interrogación de arriba, hay un breve recorrido por la ventana.",
    },
  },
  flow: {
    stepsNav: "Pasos de configuración",
    later: "Configurar más tarde",
    laterNote: "Termina más tarde desde la barra lateral.",
    getStarted: "Empezar",
    installTools: (n) => plural("es", n, { one: "Instalar # herramienta", other: "Instalar # herramientas" }),
    openTools: "Abrir Herramientas",
    continue: "Continuar",
    back: "Atrás",
    skip: "Omitir",
    tour: "Hacer el recorrido",
  },
  welcome: {
    list: "Qué hace WireCat",
    localTitle: "Todo se queda en este ordenador",
    local:
      "Las herramientas guardan tus mensajes, correo, reuniones y archivos en el almacenamiento de este ordenador, no en una nube de WireCat.",
    openTitle: "Herramientas abiertas que podrías ejecutar tú",
    open: "Cada integración es una herramienta de línea de comandos de WireCat publicada en npm. Esta app las instala y ejecuta sus propios comandos.",
    agentTitle: "Tu agente hace el resto",
    agent:
      "Claude Code, Codex y otros agentes usan las herramientas para buscar en tus datos y actuar sobre ellos cuando se lo pides.",
    time: "La configuración lleva unos minutos. Puedes saltarte cualquier paso.",
  },
  computer: {
    list: "Tu ordenador",
    system: "Sistema",
    notFound: "No encontrado",
    checkingComputer: "Comprobando este ordenador…",
    ready: "Listo para instalar las herramientas de WireCat.",
    checking: "Comprobando…",
    again: "Volver a comprobar",
  },
  choose: {
    legend: "Herramientas para instalar",
    partOf: (name) => `Parte de ${name}`,
    installed: "instalada",
  },
  install: {
    list: "Instalando",
    notInstalled: "Sin instalar",
    checking: "Comprobando…",
    queued: "Esperando su turno",
    installing: "Instalando",
    step: (label) => `${label}…`,
    installed: (version) => <>Instalada {version}</>,
    already: (version) => <>Ya instalada {version}</>,
    tryAgain: "Reintentar",
    none: "No has elegido ninguna herramienta, así que no hay nada que instalar.",
    choose: "Elegir herramientas",
    rest: "Instalar el resto",
    note: "Las instalaciones siguen aunque pases al siguiente paso. Cada una aparece también en la página Herramientas, con su registro completo.",
  },
  agents: {
    title: "Cómo añade una herramienta su skill",
    text: "Algunas herramientas ofrecen añadir su skill al iniciar sesión, en el siguiente paso: la terminal pregunta qué agente debe recibirla. Cualquier herramienta también puede añadir su skill desde una terminal, para Claude Code, Codex y Gemini CLI.",
    list: "Comandos de skills",
  },
  signIn: {
    list: "Herramientas en las que iniciar sesión",
    looking: "Buscando herramientas instaladas",
    accounts: (tool) => `Cuentas de ${tool}`,
    reading: (tool) => `Leyendo las cuentas de ${tool}`,
    added: (name) => <>Cuenta {name} añadida</>,
    signedIn: (name) => <>Sesión iniciada con el perfil {name}</>,
    signedOut: (name) => <>El perfil {name} no tiene la sesión iniciada</>,
    unknown: (name) => <>Perfil {name}: la herramienta no informa del inicio de sesión</>,
    signIn: "Iniciar sesión",
    inTerminal: "Iniciar sesión en la terminal",
    listFailed: (error) => `No se pudieron listar las cuentas: ${error}`,
    noAccount: (tool) => `Aún no hay ninguna cuenta. Añade una para que tu agente pueda usar ${tool}.`,
    needs: "Qué necesita: ",
    willAsk: "Te pedirá: ",
    guide: "Cómo crearla",
    nameAnother: "Nombre para otra cuenta",
    nameThis: "Nombre para esta cuenta",
    addAnother: "Añadir otra cuenta",
    add: "Añadir una cuenta",
    noneNeeded: "Ninguna herramienta instalada necesita iniciar sesión por ahora.",
    later: (n, names) =>
      n === 1
        ? `Podrás iniciar sesión en ${names} cuando esté instalada: ábrela en la página Herramientas y elige Gestionar.`
        : `Podrás iniciar sesión en ${names} cuando estén instaladas: abre cada una en la página Herramientas y elige Gestionar.`,
    noSignIn: (n, names) =>
      n === 1 ? `${names} no necesita iniciar sesión.` : `${names} no necesitan iniciar sesión.`,
    gives: {
      tg: "Tu agente podrá leer y buscar en tus chats de Telegram, y enviar mensajes cuando se lo pidas.",
      max: "Tu agente podrá leer y buscar en tus chats de MAX, y enviar mensajes cuando se lo pidas.",
      wa: "Tu agente podrá leer y buscar en tus chats de WhatsApp, y enviar mensajes cuando se lo pidas.",
      zm: "Tu agente podrá encontrar tus reuniones de Zoom y leer sus transcripciones y resúmenes.",
      drive: "Tu agente podrá encontrar y leer tus archivos de Google Drive. No puede cambiarlos.",
      email:
        "Tu agente podrá buscar en tu correo junto con tus notas y mensajes. Memo lee el buzón sin cambiarlo y nunca envía correo.",
    },
    asks: {
      tg: "La primera vez, tu número de teléfono y el código que envía Telegram, para registrar tu propia app de Telegram. Después, un código QR que escaneas en Telegram: Ajustes → Dispositivos → Vincular dispositivo.",
      max: "Un código QR que escaneas con la app de MAX en tu móvil.",
      wa: "Un código QR que escaneas en WhatsApp: Ajustes → Dispositivos vinculados → Vincular un dispositivo.",
      zm: "Tu navegador abre Zoom para que apruebes el acceso. Antes, Zoom necesita una app tuya, que se crea una sola vez en el Zoom App Marketplace.",
      drive: "Tu navegador abre Google: elige la cuenta y permite el acceso de solo lectura a Drive.",
      email:
        "Primero, la cuenta configurada en Himalaya, un programa de correo para la terminal; para Gmail, con una contraseña de aplicación. Después, el nombre de la cuenta de Himalaya y su dirección de correo, que se pasan a Memo.",
    },
  },
  done: {
    list: "Tus herramientas",
    notInstalled: "Sin instalar",
    next: "Qué sigue",
    connect: (tool) => `Deja que ChatGPT o Claude usen ${tool}`,
    agents: "Ver qué agentes las usan",
  },
  help: {
    help: "Ayuda",
    tour: "Hacer el recorrido",
    welcome: "Ver de nuevo la bienvenida",
    about: "Acerca de WireCat",
  },
  tour: {
    readiness: {
      title: "Tu ordenador",
      text: "Las herramientas de WireCat funcionan con Node.js y npm. Una luz verde significa que está instalado y es lo bastante reciente; pasa el cursor por un valor para ver dónde se encontró.",
    },
    lamps: {
      title: "Luces de estado",
      text: "Verde: instalada y al día. Ámbar: hay una actualización. Roja: instalada, pero no arranca. Un anillo vacío: sin instalar.",
    },
    action: {
      title: "Una acción por herramienta",
      text: "Instalar o Actualizar pone la última versión en este ordenador. Gestionar abre los perfiles de la herramienta, el inicio de sesión y la revisión de estado.",
    },
    again: {
      title: "Volver a comprobar",
      text: "¿Has instalado o quitado algo en una terminal? Volver a comprobar revisa de nuevo este ordenador y npm.",
    },
    storage: {
      title: "Almacenamiento",
      text: "Cuánto espacio ocupan los datos de cada herramienta, y una forma de borrarlos cuando nada los usa.",
    },
    logs: {
      title: "Registros",
      text: "Qué hizo cada herramienta, ejecución a ejecución: el comando, cuánto tardó y qué falló.",
    },
    help: {
      title: "La ayuda está aquí",
      text: "Desde este botón puedes empezar de nuevo este recorrido o volver a los pasos de configuración.",
    },
  },
}

export const onboardingMessages: Messages<OnboardingText> = { en, ru, es }
