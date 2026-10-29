import type { ReactNode } from "react"
import { type Messages, plural } from "@/i18n"

// Quoted words in the app steps are the labels ChatGPT and Claude show, in English: their translated menus are not
// known here, and “Allow” is what WireCat's own login page prints.

const en = {
  steps: {
    choose: "Choose the app",
    address: "Public address",
    start: "Start the server",
    reach: "Check the address",
    connect: "Add it in the app",
    test: "Test it",
  },
  rail: {
    label: "Steps",
    step: (n: number) => `Step ${n}: `,
    done: ", done",
    current: ", current step",
    notDone: ", not done yet",
    change: "Change",
    runningOn: (port: number) => `Running on port ${port}`,
    published: "Published",
    notChecked: "Not checked",
    added: "Added",
  },
  progress: { busy: "In progress", done: "Done", todo: "Not started", failed: "Failed" },
  theApp: "the app",
  calledTitle: (app: string, tool: string) => `${app} can now use your ${tool}`,
  addIn: (app: string) => `Add it in ${app}`,

  choose: (tool: string) => `Which app should use ${tool}? The steps after this one are written for it.`,
  apps: {
    chatgpt: {
      name: "ChatGPT",
      hint: "chatgpt.com, as a plugin",
      limits:
        "On ChatGPT in the browser for Business, Enterprise and Edu; on Pro it can only read. Workspace admins may have to allow it.",
      help: "OpenAI's help page",
    },
    claude: {
      name: "Claude",
      hint: "claude.ai, as a connector",
      limits:
        "On every plan; the free plan allows one custom connector. On Team and Enterprise an owner adds it under Organization settings, then each member presses “Connect”.",
      help: "Anthropic's help page",
    },
    other: {
      name: "Another app",
      hint: "any app that takes a remote MCP server",
      limits: "The app must reach the internet address above from its own servers and log in with OAuth.",
      help: "",
    },
  },
  appSteps: {
    consent:
      "A WireCat login page opens. Check it names the app you are connecting, type the login code and press “Allow”.",
    old: "If an earlier WireCat connection to this computer is listed, with another address or through another tunnel, remove it first.",
    name: "Give it a name.",
    chatgptOpen: "Open ChatGPT in the browser and go to “Plugins”.",
    chatgptAdd: "Press the “+” button, then “Add custom MCP server”.",
    chatgptUrl: "Under “Connection”, paste this address.",
    chatgptAuth: "For authentication, choose “OAuth”.",
    chatgptCreate: "Tick “I understand and want to continue”, then press “Create as a plugin”.",
    chatgptUse: "Install the plugin, start a new chat, type @ and pick it.",
    claudeOpen: "Open claude.ai and go to “Customize”, then “Connectors”.",
    claudeAdd: "Press “+ Add”, then “Add custom connector”.",
    claudeUrl: "Paste this address as the MCP server URL, then press “Continue”.",
    claudeAuth: "Under “OAuth client”, choose “Register automatically”, then press “Add”.",
    claudeUse: "In a chat, press “+”, then “Connectors”, and turn it on.",
    otherUrl: "In the app's settings, add a remote MCP server (some apps say connector) with this address.",
    otherAuth: "If it asks how to log in, choose OAuth, and let it register itself.",
  },
  appLinks: { plugins: "Open Plugins", connectors: "Open Connectors" },
  prompts: {
    tg: "List my last 3 Telegram chats.",
    max: "List my last 3 MAX chats.",
    wa: "List my last 3 WhatsApp chats.",
    drive: "List the 3 Google Drive files I changed last.",
    memo: "List my 3 most recent notes.",
  } as Record<string, string>,
  promptOther: (tool: string) => `What can you do with ${tool}?`,

  address: {
    intro: (tool: string, app: string) =>
      `${tool} runs on this computer and ${app} runs on its own servers, so it needs an address on the internet that leads here. It stays the same, and only the paths of this server are open; every app still has to log in with a code from WireCat.`,
    willBe: (address: ReactNode): ReactNode => <>The address will be {address}.</>,
    onTailscaleName: "The address will be on this computer's Tailscale name.",
    cloudflareNext: (bin: string) =>
      `Next, WireCat starts the Cloudflare tunnel for it and ${bin}'s server in the background. Both keep running until you stop them; after a restart of the computer, start them here again.`,
    tailscaleNext: (bin: string) =>
      `Next, WireCat turns on Tailscale Funnel for it and starts ${bin}'s server in the background. It keeps running until you stop it, and the address stays the same next time.`,
    start: "Start the server",
    ownIntro: (port: string) =>
      `Type the https address of your tunnel (cloudflared, ngrok, or a Tailscale Funnel you run) and point it at 127.0.0.1:${port} on this computer.`,
    ownLabel: "The tunnel's address",
    ownPaths: (id: string) =>
      `With a path such as /${id}, the tunnel must also route /.well-known/oauth-authorization-server/${id} and /.well-known/oauth-protected-resource/${id} here.`,
    otherPort: "Use another port",
    port: "Port on this computer",
    legend: "How the address reaches this computer",
    tailscale: {
      title: "Tailscale Funnel",
      hint: "Recommended. Free, and the encryption ends on this computer, so Tailscale cannot read your messages.",
    },
    cloudflare: {
      title: "Cloudflare tunnel (your own domain)",
      hint: "For a Cloudflare account with your own domain on it.",
    },
    own: { title: "A tunnel I run myself", hint: "cloudflared, ngrok or a Funnel you set up: you type its address." },
    problem: {
      url: "Type the tunnel's https address, such as https://laptop.tail1234.ts.net, or with a path of its own: …/tg",
      port: "Choose a port from 1024 to 65535",
    },
  },

  start: {
    funnel: (bin: string) => `Turn on Tailscale Funnel for ${bin}'s address`,
    tunnel: (bin: string) => `Start the Cloudflare tunnel with ${bin}'s paths`,
    server: (bin: string) => `Start ${bin}'s server and wait until it answers`,
    approve: (link: ReactNode): ReactNode => (
      <>Tailscale asks you to approve Funnel for your network in the page that opened in your browser. {link}</>
    ),
    openAgain: "Open it again",
    stop: "Stop",
    portInUse: "Another program uses this port. Go back, open “Use another port”, choose another port and start again.",
    nothingLeft: "Nothing was left running. Try again, or go back and change the address or port.",
    tryAgain: "Try again",
    back: "Back to the address",
  },

  copy: {
    address: "Copy the server address",
    name: "Copy the name",
    codeSoon: "The code appears here in a moment.",
  },

  reach: {
    intro: (app: string, bin: string, host: ReactNode): ReactNode => (
      <>
        {app} reaches {bin} from its own servers, so WireCat asks public DNS for {host} the way the app will, then opens
        the address from the internet's side.
      </>
    ),
    publishingFunnel: "Tailscale is publishing your address…",
    publishingDns: "Waiting for the address to appear in public DNS…",
    dnsUnknown: "Public DNS could not be asked from this computer",
    asking: "Asking public DNS…",
    published: "The address is published",
    barLabel: "Waiting for Tailscale to publish the address",
    barValue: (minutes: number) => `${minutes} of up to 10 minutes`,
    wait: (funnel: boolean, minutes: number, app: string) =>
      `${
        funnel
          ? "A new Funnel address can take up to 10 minutes to appear on the internet."
          : "A new DNS record usually appears within minutes."
      } ${
        minutes > 0
          ? `WireCat checks every 15 seconds and moves on by itself; ${minutes} min so far.`
          : "WireCat checks every 15 seconds and moves on by itself."
      } Until then ${app} would say it cannot reach the address, so the next step waits.`,
    slowFunnel:
      "It is taking longer than Tailscale says. Keep this open; turning Funnel off and on again starts the wait over.",
    slowDns: (host: string) =>
      `It is taking longer than usual. Check that ${host} is listed on Cloudflare's DNS page for your domain.`,
    selfUnreachable: (app: string) =>
      `This computer cannot open its own public address, which is usual, so the last part is tested by ${app}.`,
    wrongFunnel: (bin: string, status: number) =>
      `The address answers, but not with ${bin}'s server (it said ${status}). Another Funnel or tunnel may use it. Check Server details, or go back and use another port.`,
    wrongTunnel: (bin: string, status: number, app: string) =>
      `The address answers, but not with ${bin}'s server (it said ${status}). Cloudflare may be checking visitors on your domain (Bot Fight Mode, or "I'm Under Attack" mode), which stops ${app} too; turn it off for the domain in Cloudflare's Security settings. Or another tunnel uses the name.`,
    checking: "Checking…",
    again: "Check again",
    goOn: "Go on anyway",
    goOnUnchecked: "Go on without the check",
    unknownHelp: (app: string) =>
      `No public DNS service answered from this computer (some networks block them), so WireCat cannot see whether the address is published. If ${app} says it cannot reach the address, wait up to 10 minutes after the tunnel started and try again there.`,
    live: (host: string) => `${host} answers on the internet.`,
    unchecked: (host: string) => `Not checked whether ${host} answers on the internet.`,
  },

  connect: {
    intro: (bin: string, app: string) =>
      `${bin}'s server is running. Do this in ${app}; WireCat watches for it to log in.`,
    added: "I added it, test the connection",
    discovery: (app: string) => `If ${app} says it couldn't discover OAuth settings`,
    discoveryWhy:
      "This message usually means the address is not on the internet yet: the app could not reach the server at all. A new address can take up to 10 minutes to appear, and the step “Check the address” waits for it. Wait, then add the server in the app again.",
    discoveryValues:
      "If the address is published and the app still says it, and its form offers advanced OAuth settings, these are the values, read from the running server:",
    authorization: "Authorization URL",
    copyAuthorization: "Copy the authorization URL",
    token: "Token URL",
    copyToken: "Copy the token URL",
    registration: "Registration URL",
    copyRegistration: "Copy the registration URL",
    issuer: "Issuer",
    copyIssuer: "Copy the issuer",
  },

  off: {
    funnel: (app: string) =>
      `Tailscale Funnel is off for this server, so ${app} cannot reach it. Turn it on again; the address stays the same, though it can take up to 10 minutes to be reachable again.`,
    turningOn: "Turning Funnel on…",
    turnOn: "Turn Funnel on",
    tunnel: (app: string) =>
      `The Cloudflare tunnel is not running, so ${app} cannot reach this server. Start it again; the address stays the same.`,
    starting: "Starting the tunnel…",
    start: "Start the tunnel",
  },

  test: {
    loggedIn: (app: string) => `${app} logged in`,
    selfNamed: "(the name the app gave itself)",
    waitingLogin: (app: string) => `Waiting for ${app} to log in…`,
    firstCall: "First call arrived:",
    at: (time: string) => ` at ${time}`,
    waitingCall: "Waiting for the first call…",
    finishLogin: (app: string) =>
      `Finish the login in ${app}: it opens a WireCat page that asks for the login code from the step before.`,
    askNow: (app: string, tool: string) =>
      `Now ask ${app} something that needs ${tool}, in a new chat with it turned on:`,
    copyPrompt: "Copy the test prompt",
    noCounts: (bin: string, app: string, tool: string) =>
      `This version of ${bin} does not report calls, so check the answer in ${app}. Update ${tool} on the Tools page to see calls here.`,
    reached: (app: string, bin: string) =>
      `${app} reached ${bin} through the internet address, logged in and called a tool. From now on this panel shows when it last did.`,
    finish: "Finish",
    back: (app: string) => `Back to the steps in ${app}`,
  },

  next: {
    title: "What next",
    ask: (app: string) => `Ask ${app} something, in a chat with it turned on:`,
    copyPrompt: "Copy a prompt to try",
    another: "Connect another app",
    too: (tool: string) => `Connect ${tool} too`,
    logs: "See its calls in Logs",
  },

  trouble: {
    title: (app: string) => `Nothing has logged in yet. What ${app} says decides the fix:`,
    unreachable: "It couldn't reach or connect to the server:",
    unreachableFix: (url: ReactNode): ReactNode => (
      <>
        check the address is exactly {url}, with /mcp at the end. A new address can also take up to 10 minutes to appear
        on the internet; try again in the app after that.
      </>
    ),
    badCode: "The login page says the code is wrong or expired:",
    badCodeFix: "each code works for 10 minutes. Type the one in the step before as it is now.",
    noPage: "No WireCat login page opened:",
    noPageFix: (app: string) => `choose OAuth as the authentication in ${app}, and remove and add the server again.`,
  },

  activity: {
    justNow: "just now",
    minutes: (n: number) => `${n} min ago`,
    hours: (n: number) => `${n} h ago`,
    yesterday: "yesterday",
    days: (n: number) => plural("en", n, { one: "# day ago", other: "# days ago" }),
    lastCall: (ago: string, tool: string, today: number | null) =>
      `last call ${ago} · ${tool}${today ? ` · ${today} today` : ""}`,
    connected: (ago: string) => `connected ${ago}, no calls yet`,
    loggedIn: (ago: string) => `logged in ${ago}`,
    noName: "An app with no name",
  },
}

const ru: typeof en = {
  steps: {
    choose: "Выберите приложение",
    address: "Публичный адрес",
    start: "Запуск сервера",
    reach: "Проверка адреса",
    connect: "Добавьте в приложение",
    test: "Проверка связи",
  },
  rail: {
    label: "Шаги",
    step: (n) => `Шаг ${n}: `,
    done: ", готово",
    current: ", текущий шаг",
    notDone: ", ещё не готово",
    change: "Изменить",
    runningOn: (port) => `Работает на порту ${port}`,
    published: "Опубликован",
    notChecked: "Не проверен",
    added: "Добавлено",
  },
  progress: { busy: "Выполняется", done: "Готово", todo: "Не начато", failed: "Не удалось" },
  theApp: "приложение",
  calledTitle: (app, tool) => `Теперь ${app} может работать с вашим ${tool}`,
  addIn: (app) => `Добавьте в ${app}`,

  choose: (tool) => `Какое приложение будет работать с ${tool}? Следующие шаги написаны для него.`,
  apps: {
    chatgpt: {
      name: "ChatGPT",
      hint: "chatgpt.com, как плагин",
      limits:
        "В ChatGPT в браузере на тарифах Business, Enterprise и Edu; на Pro — только чтение. Возможно, это должен разрешить администратор рабочего пространства.",
      help: "Справка OpenAI",
    },
    claude: {
      name: "Claude",
      hint: "claude.ai, как коннектор",
      limits:
        "На всех тарифах; на бесплатном можно добавить один свой коннектор. В Team и Enterprise его добавляет владелец в Organization settings, затем каждый участник нажимает «Connect».",
      help: "Справка Anthropic",
    },
    other: {
      name: "Другое приложение",
      hint: "любое приложение, которое принимает удалённый MCP-сервер",
      limits: "Приложение должно достучаться до интернет-адреса выше со своих серверов и войти через OAuth.",
      help: "",
    },
  },
  appSteps: {
    consent:
      "Откроется страница входа WireCat. Проверьте, что на ней названо подключаемое приложение, введите код входа и нажмите «Allow».",
    old: "Если в списке есть прежнее подключение WireCat к этому компьютеру, с другим адресом или через другой туннель, сначала удалите его.",
    name: "Дайте ему имя.",
    chatgptOpen: "Откройте ChatGPT в браузере и перейдите в «Plugins».",
    chatgptAdd: "Нажмите кнопку «+», затем «Add custom MCP server».",
    chatgptUrl: "В разделе «Connection» вставьте этот адрес.",
    chatgptAuth: "В способе входа выберите «OAuth».",
    chatgptCreate: "Отметьте «I understand and want to continue», затем нажмите «Create as a plugin».",
    chatgptUse: "Установите плагин, начните новый чат, наберите @ и выберите его.",
    claudeOpen: "Откройте claude.ai и перейдите в «Customize», затем в «Connectors».",
    claudeAdd: "Нажмите «+ Add», затем «Add custom connector».",
    claudeUrl: "Вставьте этот адрес как адрес MCP-сервера и нажмите «Continue».",
    claudeAuth: "В разделе «OAuth client» выберите «Register automatically», затем нажмите «Add».",
    claudeUse: "В чате нажмите «+», затем «Connectors», и включите его.",
    otherUrl:
      "В настройках приложения добавьте удалённый MCP-сервер (в некоторых приложениях — коннектор) с этим адресом.",
    otherAuth: "Если приложение спросит, как входить, выберите OAuth и разрешите ему зарегистрироваться самому.",
  },
  appLinks: { plugins: "Открыть Plugins", connectors: "Открыть Connectors" },
  prompts: {
    tg: "Покажи мои последние 3 чата в Telegram.",
    max: "Покажи мои последние 3 чата в MAX.",
    wa: "Покажи мои последние 3 чата в WhatsApp.",
    drive: "Покажи 3 файла в Google Drive, которые я менял последними.",
    memo: "Покажи мои 3 последние заметки.",
  },
  promptOther: (tool) => `Что ты умеешь делать с ${tool}?`,

  address: {
    intro: (tool, app) =>
      `${tool} работает на этом компьютере, а ${app} — на своих серверах, поэтому нужен адрес в интернете, который ведёт сюда. Он не меняется, открыты только пути этого сервера, а каждое приложение всё равно входит по коду из WireCat.`,
    willBe: (address) => <>Адрес будет {address}.</>,
    onTailscaleName: "Адрес будет на имени этого компьютера в Tailscale.",
    cloudflareNext: (bin) =>
      `Дальше WireCat запустит для него туннель Cloudflare и сервер ${bin} в фоне. Оба работают, пока вы их не остановите; после перезагрузки компьютера запустите их здесь снова.`,
    tailscaleNext: (bin) =>
      `Дальше WireCat включит для него Tailscale Funnel и запустит сервер ${bin} в фоне. Он работает, пока вы его не остановите, а адрес в следующий раз будет тем же.`,
    start: "Запустить сервер",
    ownIntro: (port) =>
      `Введите https-адрес вашего туннеля (cloudflared, ngrok или ваш собственный Tailscale Funnel) и направьте его на 127.0.0.1:${port} на этом компьютере.`,
    ownLabel: "Адрес туннеля",
    ownPaths: (id) =>
      `С путём вроде /${id} туннель должен также вести сюда /.well-known/oauth-authorization-server/${id} и /.well-known/oauth-protected-resource/${id}.`,
    otherPort: "Другой порт",
    port: "Порт на этом компьютере",
    legend: "Как адрес ведёт на этот компьютер",
    tailscale: {
      title: "Tailscale Funnel",
      hint: "Рекомендуем. Бесплатно, и шифрование заканчивается на этом компьютере, поэтому Tailscale не может читать ваши сообщения.",
    },
    cloudflare: {
      title: "Туннель Cloudflare (свой домен)",
      hint: "Для аккаунта Cloudflare, где есть ваш собственный домен.",
    },
    own: { title: "Свой туннель", hint: "cloudflared, ngrok или настроенный вами Funnel: вы вводите его адрес." },
    problem: {
      url: "Введите https-адрес туннеля, например https://laptop.tail1234.ts.net, или с собственным путём: …/tg",
      port: "Выберите порт от 1024 до 65535",
    },
  },

  start: {
    funnel: (bin) => `Включить Tailscale Funnel для адреса ${bin}`,
    tunnel: (bin) => `Запустить туннель Cloudflare с путями ${bin}`,
    server: (bin) => `Запустить сервер ${bin} и дождаться ответа`,
    approve: (link) => (
      <>Tailscale просит одобрить Funnel для вашей сети на странице, которая открылась в браузере. {link}</>
    ),
    openAgain: "Открыть ещё раз",
    stop: "Остановить",
    portInUse:
      "Этот порт занят другой программой. Вернитесь назад, откройте «Другой порт», выберите другой порт и запустите снова.",
    nothingLeft: "Ничего не осталось запущенным. Попробуйте ещё раз или вернитесь и измените адрес или порт.",
    tryAgain: "Попробовать снова",
    back: "Назад к адресу",
  },

  copy: {
    address: "Скопировать адрес сервера",
    name: "Скопировать имя",
    codeSoon: "Код сейчас появится здесь.",
  },

  reach: {
    intro: (app, bin, host) => (
      <>
        {app} обращается к {bin} со своих серверов, поэтому WireCat спрашивает публичный DNS о {host} так же, как это
        сделает приложение, а затем открывает адрес со стороны интернета.
      </>
    ),
    publishingFunnel: "Tailscale публикует ваш адрес…",
    publishingDns: "Ждём, пока адрес появится в публичном DNS…",
    dnsUnknown: "С этого компьютера не удалось обратиться к публичному DNS",
    asking: "Спрашиваем публичный DNS…",
    published: "Адрес опубликован",
    barLabel: "Ждём, пока Tailscale опубликует адрес",
    barValue: (minutes) => `${minutes} из 10 минут максимум`,
    wait: (funnel, minutes, app) =>
      `${
        funnel
          ? "Новый адрес Funnel может появиться в интернете не сразу, до 10 минут."
          : "Новая DNS-запись обычно появляется за несколько минут."
      } ${
        minutes > 0
          ? `WireCat проверяет каждые 15 секунд и сам перейдёт дальше; прошло ${minutes} мин.`
          : "WireCat проверяет каждые 15 секунд и сам перейдёт дальше."
      } До этого ${app} сообщит, что не может открыть адрес, поэтому следующий шаг ждёт.`,
    slowFunnel:
      "Это дольше, чем обещает Tailscale. Не закрывайте окно: если выключить и снова включить Funnel, ожидание начнётся заново.",
    slowDns: (host) => `Это дольше обычного. Проверьте, что ${host} есть на странице DNS вашего домена в Cloudflare.`,
    selfUnreachable: (app) =>
      `Этот компьютер не может открыть собственный публичный адрес, это обычно, поэтому последнюю часть проверит ${app}.`,
    wrongFunnel: (bin, status) =>
      `Адрес отвечает, но это не сервер ${bin} (ответ: ${status}). Возможно, его занял другой Funnel или туннель. Посмотрите «Сведения о сервере» или вернитесь и выберите другой порт.`,
    wrongTunnel: (bin, status, app) =>
      `Адрес отвечает, но это не сервер ${bin} (ответ: ${status}). Возможно, Cloudflare проверяет посетителей вашего домена (Bot Fight Mode или режим "I'm Under Attack") и не пускает ${app}; отключите это для домена в разделе Security в Cloudflare. Или это имя занял другой туннель.`,
    checking: "Проверяем…",
    again: "Проверить снова",
    goOn: "Всё равно продолжить",
    goOnUnchecked: "Продолжить без проверки",
    unknownHelp: (app) =>
      `С этого компьютера не ответил ни один публичный DNS-сервис (некоторые сети их блокируют), поэтому WireCat не может проверить, опубликован ли адрес. Если ${app} сообщит, что не может открыть адрес, подождите до 10 минут после запуска туннеля и попробуйте там снова.`,
    live: (host) => `${host} отвечает из интернета.`,
    unchecked: (host) => `Не проверено, отвечает ли ${host} из интернета.`,
  },

  connect: {
    intro: (bin, _app) => `Сервер ${bin} работает. Сделайте следующее в приложении; WireCat заметит, когда оно войдёт.`,
    added: "Готово, проверить связь",
    discovery: (app) => `Если ${app} пишет, что не удалось найти настройки OAuth (couldn't discover OAuth settings)`,
    discoveryWhy:
      "Обычно это значит, что адреса ещё нет в интернете: приложение вообще не достучалось до сервера. Новый адрес может появляться до 10 минут, и шаг «Проверка адреса» ждёт его. Подождите и добавьте сервер в приложении снова.",
    discoveryValues:
      "Если адрес опубликован, а приложение всё равно так пишет и в его форме есть расширенные настройки OAuth, вот значения из работающего сервера:",
    authorization: "Authorization URL",
    copyAuthorization: "Скопировать Authorization URL",
    token: "Token URL",
    copyToken: "Скопировать Token URL",
    registration: "Registration URL",
    copyRegistration: "Скопировать Registration URL",
    issuer: "Issuer",
    copyIssuer: "Скопировать Issuer",
  },

  off: {
    funnel: (app) =>
      `Tailscale Funnel для этого сервера выключен, поэтому ${app} до него не достучится. Включите его снова: адрес останется тем же, но снова заработать может через время, до 10 минут.`,
    turningOn: "Включаем Funnel…",
    turnOn: "Включить Funnel",
    tunnel: (app) =>
      `Туннель Cloudflare не запущен, поэтому ${app} не достучится до этого сервера. Запустите его снова: адрес останется тем же.`,
    starting: "Запускаем туннель…",
    start: "Запустить туннель",
  },

  test: {
    loggedIn: (app) => `Вход выполнен: ${app}`,
    selfNamed: "(так приложение назвало себя само)",
    waitingLogin: (app) => `Ждём входа: ${app}…`,
    firstCall: "Пришёл первый вызов:",
    at: (time) => ` в ${time}`,
    waitingCall: "Ждём первого вызова…",
    finishLogin: (app) =>
      `Завершите вход в ${app}: откроется страница WireCat, где нужно ввести код входа из предыдущего шага.`,
    askNow: (app, tool) =>
      `Теперь спросите ${app} о чём-нибудь, для чего нужен ${tool}, в новом чате, где включён коннектор:`,
    copyPrompt: "Скопировать проверочный запрос",
    noCounts: (bin, _app, tool) =>
      `Эта версия ${bin} не сообщает о вызовах, поэтому проверьте ответ в самом чате. Обновите ${tool} на странице «Инструменты», чтобы видеть вызовы здесь.`,
    reached: (app, bin) =>
      `${app} обращается к ${bin} через интернет-адрес: вход выполнен, инструмент вызван. Теперь эта панель показывает, когда был последний вызов.`,
    finish: "Готово",
    back: (app) => `Назад к шагам (${app})`,
  },

  next: {
    title: "Что дальше",
    ask: (app) => `Спросите ${app} о чём-нибудь в чате, где включён коннектор:`,
    copyPrompt: "Скопировать запрос",
    another: "Подключить другое приложение",
    too: (tool) => `Подключить и ${tool}`,
    logs: "Смотреть вызовы в Журнале",
  },

  trouble: {
    title: (app) => `Пока никто не вошёл. Что делать, зависит от того, что пишет ${app}:`,
    unreachable: "Не удалось достучаться или подключиться к серверу:",
    unreachableFix: (url) => (
      <>
        проверьте, что адрес в точности {url}, с /mcp в конце. Новый адрес также может появляться в интернете до 10
        минут; после этого попробуйте в приложении снова.
      </>
    ),
    badCode: "Страница входа пишет, что код неверный или устарел:",
    badCodeFix: "каждый код действует 10 минут. Введите тот, что сейчас показан в предыдущем шаге.",
    noPage: "Страница входа WireCat не открылась:",
    noPageFix: (_app) =>
      `выберите OAuth как способ входа в настройках подключения, удалите сервер и добавьте его снова.`,
  },

  activity: {
    justNow: "только что",
    minutes: (n) => `${n} мин назад`,
    hours: (n) => `${n} ч назад`,
    yesterday: "вчера",
    days: (n) =>
      plural("ru", n, { one: "# день назад", few: "# дня назад", many: "# дней назад", other: "# дня назад" }),
    lastCall: (ago, tool, today) => `последний вызов ${ago} · ${tool}${today ? ` · сегодня: ${today}` : ""}`,
    connected: (ago) => `подключение ${ago}, вызовов пока нет`,
    loggedIn: (ago) => `вход ${ago}`,
    noName: "Приложение без имени",
  },
}

const es: typeof en = {
  steps: {
    choose: "Elige la app",
    address: "Dirección pública",
    start: "Inicia el servidor",
    reach: "Comprueba la dirección",
    connect: "Añádelo en la app",
    test: "Pruébalo",
  },
  rail: {
    label: "Pasos",
    step: (n) => `Paso ${n}: `,
    done: ", hecho",
    current: ", paso actual",
    notDone: ", aún no hecho",
    change: "Cambiar",
    runningOn: (port) => `Funciona en el puerto ${port}`,
    published: "Publicada",
    notChecked: "Sin comprobar",
    added: "Añadido",
  },
  progress: { busy: "En curso", done: "Hecho", todo: "Sin empezar", failed: "Ha fallado" },
  theApp: "la app",
  calledTitle: (app, tool) => `${app} ya puede usar tu ${tool}`,
  addIn: (app) => `Añádelo en ${app}`,

  choose: (tool) => `¿Qué app debe usar ${tool}? Los pasos siguientes están escritos para ella.`,
  apps: {
    chatgpt: {
      name: "ChatGPT",
      hint: "chatgpt.com, como plugin",
      limits:
        "En ChatGPT en el navegador para Business, Enterprise y Edu; en Pro solo puede leer. Puede que los administradores del espacio de trabajo tengan que permitirlo.",
      help: "Ayuda de OpenAI",
    },
    claude: {
      name: "Claude",
      hint: "claude.ai, como conector",
      limits:
        "En todos los planes; el plan gratuito permite un conector personalizado. En Team y Enterprise lo añade un propietario en Organization settings y luego cada miembro pulsa «Connect».",
      help: "Ayuda de Anthropic",
    },
    other: {
      name: "Otra app",
      hint: "cualquier app que acepte un servidor MCP remoto",
      limits:
        "La app tiene que llegar a la dirección de internet de arriba desde sus propios servidores e iniciar sesión con OAuth.",
      help: "",
    },
  },
  appSteps: {
    consent:
      "Se abre una página de inicio de sesión de WireCat. Comprueba que nombra la app que estás conectando, escribe el código de acceso y pulsa «Allow».",
    old: "Si aparece una conexión anterior de WireCat a este ordenador, con otra dirección o por otro túnel, quítala primero.",
    name: "Ponle un nombre.",
    chatgptOpen: "Abre ChatGPT en el navegador y ve a «Plugins».",
    chatgptAdd: "Pulsa el botón «+» y luego «Add custom MCP server».",
    chatgptUrl: "En «Connection», pega esta dirección.",
    chatgptAuth: "Como autenticación, elige «OAuth».",
    chatgptCreate: "Marca «I understand and want to continue» y pulsa «Create as a plugin».",
    chatgptUse: "Instala el plugin, abre un chat nuevo, escribe @ y elígelo.",
    claudeOpen: "Abre claude.ai y ve a «Customize» y luego a «Connectors».",
    claudeAdd: "Pulsa «+ Add» y luego «Add custom connector».",
    claudeUrl: "Pega esta dirección como URL del servidor MCP y pulsa «Continue».",
    claudeAuth: "En «OAuth client», elige «Register automatically» y pulsa «Add».",
    claudeUse: "En un chat, pulsa «+», luego «Connectors», y actívalo.",
    otherUrl:
      "En los ajustes de la app, añade un servidor MCP remoto (algunas apps lo llaman conector) con esta dirección.",
    otherAuth: "Si pregunta cómo iniciar sesión, elige OAuth y deja que se registre sola.",
  },
  appLinks: { plugins: "Abrir Plugins", connectors: "Abrir Connectors" },
  prompts: {
    tg: "Enumera mis 3 últimos chats de Telegram.",
    max: "Enumera mis 3 últimos chats de MAX.",
    wa: "Enumera mis 3 últimos chats de WhatsApp.",
    drive: "Enumera los 3 archivos de Google Drive que cambié por última vez.",
    memo: "Enumera mis 3 notas más recientes.",
  },
  promptOther: (tool) => `¿Qué puedes hacer con ${tool}?`,

  address: {
    intro: (tool, app) =>
      `${tool} funciona en este ordenador y ${app} en sus propios servidores, así que necesita una dirección en internet que lleve hasta aquí. No cambia, y solo quedan abiertas las rutas de este servidor; cada app sigue teniendo que iniciar sesión con un código de WireCat.`,
    willBe: (address) => <>La dirección será {address}.</>,
    onTailscaleName: "La dirección estará en el nombre de Tailscale de este ordenador.",
    cloudflareNext: (bin) =>
      `A continuación, WireCat inicia el túnel de Cloudflare para ella y el servidor de ${bin} en segundo plano. Los dos siguen funcionando hasta que los detengas; si reinicias el ordenador, vuelve a iniciarlos aquí.`,
    tailscaleNext: (bin) =>
      `A continuación, WireCat activa Tailscale Funnel para ella e inicia el servidor de ${bin} en segundo plano. Sigue funcionando hasta que lo detengas, y la dirección será la misma la próxima vez.`,
    start: "Iniciar el servidor",
    ownIntro: (port) =>
      `Escribe la dirección https de tu túnel (cloudflared, ngrok o un Tailscale Funnel que gestiones tú) y apúntalo a 127.0.0.1:${port} en este ordenador.`,
    ownLabel: "Dirección del túnel",
    ownPaths: (id) =>
      `Con una ruta como /${id}, el túnel también debe traer aquí /.well-known/oauth-authorization-server/${id} y /.well-known/oauth-protected-resource/${id}.`,
    otherPort: "Usar otro puerto",
    port: "Puerto en este ordenador",
    legend: "Cómo llega la dirección a este ordenador",
    tailscale: {
      title: "Tailscale Funnel",
      hint: "Recomendado. Gratis, y el cifrado termina en este ordenador, así que Tailscale no puede leer tus mensajes.",
    },
    cloudflare: {
      title: "Túnel de Cloudflare (tu propio dominio)",
      hint: "Para una cuenta de Cloudflare con tu propio dominio.",
    },
    own: {
      title: "Un túnel que gestiono yo",
      hint: "cloudflared, ngrok o un Funnel que configuraste: escribes su dirección.",
    },
    problem: {
      url: "Escribe la dirección https del túnel, como https://laptop.tail1234.ts.net, o con una ruta propia: …/tg",
      port: "Elige un puerto entre 1024 y 65535",
    },
  },

  start: {
    funnel: (bin) => `Activar Tailscale Funnel para la dirección de ${bin}`,
    tunnel: (bin) => `Iniciar el túnel de Cloudflare con las rutas de ${bin}`,
    server: (bin) => `Iniciar el servidor de ${bin} y esperar a que responda`,
    approve: (link) => (
      <>Tailscale te pide que apruebes Funnel para tu red en la página que se abrió en el navegador. {link}</>
    ),
    openAgain: "Volver a abrirla",
    stop: "Detener",
    portInUse:
      "Otro programa usa este puerto. Vuelve atrás, abre «Usar otro puerto», elige otro puerto y vuelve a empezar.",
    nothingLeft: "No ha quedado nada en marcha. Inténtalo de nuevo o vuelve atrás y cambia la dirección o el puerto.",
    tryAgain: "Reintentar",
    back: "Volver a la dirección",
  },

  copy: {
    address: "Copiar la dirección del servidor",
    name: "Copiar el nombre",
    codeSoon: "El código aparecerá aquí en un momento.",
  },

  reach: {
    intro: (app, bin, host) => (
      <>
        {app} llega a {bin} desde sus propios servidores, así que WireCat pregunta al DNS público por {host} igual que
        lo hará la app y luego abre la dirección desde el lado de internet.
      </>
    ),
    publishingFunnel: "Tailscale está publicando tu dirección…",
    publishingDns: "Esperando a que la dirección aparezca en el DNS público…",
    dnsUnknown: "No se ha podido consultar el DNS público desde este ordenador",
    asking: "Consultando el DNS público…",
    published: "La dirección está publicada",
    barLabel: "Esperando a que Tailscale publique la dirección",
    barValue: (minutes) => `${minutes} de 10 minutos como máximo`,
    wait: (funnel, minutes, app) =>
      `${
        funnel
          ? "Una dirección nueva de Funnel puede tardar hasta 10 minutos en aparecer en internet."
          : "Un registro DNS nuevo suele aparecer en pocos minutos."
      } ${
        minutes > 0
          ? `WireCat comprueba cada 15 segundos y sigue solo; van ${minutes} min.`
          : "WireCat comprueba cada 15 segundos y sigue solo."
      } Hasta entonces ${app} diría que no puede llegar a la dirección, así que el paso siguiente espera.`,
    slowFunnel:
      "Está tardando más de lo que dice Tailscale. Deja esto abierto; si apagas y vuelves a encender Funnel, la espera empieza de nuevo.",
    slowDns: (host) =>
      `Está tardando más de lo normal. Comprueba que ${host} aparece en la página DNS de tu dominio en Cloudflare.`,
    selfUnreachable: (app) =>
      `Este ordenador no puede abrir su propia dirección pública, algo habitual, así que la última parte la prueba ${app}.`,
    wrongFunnel: (bin, status) =>
      `La dirección responde, pero no con el servidor de ${bin} (respondió ${status}). Puede que la use otro Funnel o túnel. Mira «Detalles del servidor» o vuelve atrás y usa otro puerto.`,
    wrongTunnel: (bin, status, app) =>
      `La dirección responde, pero no con el servidor de ${bin} (respondió ${status}). Puede que Cloudflare esté comprobando a los visitantes de tu dominio (Bot Fight Mode o el modo "I'm Under Attack"), lo que también frena a ${app}; desactívalo para el dominio en los ajustes de Security de Cloudflare. O bien otro túnel usa el nombre.`,
    checking: "Comprobando…",
    again: "Volver a comprobar",
    goOn: "Seguir de todos modos",
    goOnUnchecked: "Seguir sin comprobar",
    unknownHelp: (app) =>
      `Ningún servicio de DNS público ha respondido desde este ordenador (algunas redes los bloquean), así que WireCat no puede saber si la dirección está publicada. Si ${app} dice que no puede llegar a la dirección, espera hasta 10 minutos desde que arrancó el túnel y vuelve a intentarlo allí.`,
    live: (host) => `${host} responde en internet.`,
    unchecked: (host) => `No se ha comprobado si ${host} responde en internet.`,
  },

  connect: {
    intro: (bin, app) =>
      `El servidor de ${bin} está en marcha. Haz esto en ${app}; WireCat estará atento a cuando inicie sesión.`,
    added: "Ya lo añadí, probar la conexión",
    discovery: (app) => `Si ${app} dice que no pudo descubrir los ajustes de OAuth (couldn't discover OAuth settings)`,
    discoveryWhy:
      "Este mensaje suele significar que la dirección aún no está en internet: la app no llegó al servidor en absoluto. Una dirección nueva puede tardar hasta 10 minutos en aparecer, y el paso «Comprueba la dirección» la espera. Espera y vuelve a añadir el servidor en la app.",
    discoveryValues:
      "Si la dirección está publicada y la app lo sigue diciendo, y su formulario ofrece ajustes avanzados de OAuth, estos son los valores, leídos del servidor en marcha:",
    authorization: "Authorization URL",
    copyAuthorization: "Copiar la Authorization URL",
    token: "Token URL",
    copyToken: "Copiar la Token URL",
    registration: "Registration URL",
    copyRegistration: "Copiar la Registration URL",
    issuer: "Issuer",
    copyIssuer: "Copiar el Issuer",
  },

  off: {
    funnel: (app) =>
      `Tailscale Funnel está desactivado para este servidor, así que ${app} no puede llegar a él. Vuelve a activarlo; la dirección sigue siendo la misma, aunque puede tardar hasta 10 minutos en volver a estar accesible.`,
    turningOn: "Activando Funnel…",
    turnOn: "Activar Funnel",
    tunnel: (app) =>
      `El túnel de Cloudflare no está en marcha, así que ${app} no puede llegar a este servidor. Vuelve a iniciarlo; la dirección sigue siendo la misma.`,
    starting: "Iniciando el túnel…",
    start: "Iniciar el túnel",
  },

  test: {
    loggedIn: (app) => `${app} ha iniciado sesión`,
    selfNamed: "(el nombre que la app se dio a sí misma)",
    waitingLogin: (app) => `Esperando a que ${app} inicie sesión…`,
    firstCall: "Ha llegado la primera llamada:",
    at: (time) => ` a las ${time}`,
    waitingCall: "Esperando la primera llamada…",
    finishLogin: (app) =>
      `Termina el inicio de sesión en ${app}: abre una página de WireCat que pide el código de acceso del paso anterior.`,
    askNow: (app, tool) => `Ahora pide a ${app} algo que necesite ${tool}, en un chat nuevo con el conector activado:`,
    copyPrompt: "Copiar la petición de prueba",
    noCounts: (bin, app, tool) =>
      `Esta versión de ${bin} no informa de las llamadas, así que comprueba la respuesta en ${app}. Actualiza ${tool} en la página Herramientas para ver las llamadas aquí.`,
    reached: (app, bin) =>
      `${app} llegó a ${bin} por la dirección de internet, inició sesión y llamó a una herramienta. A partir de ahora este panel muestra cuándo lo hizo por última vez.`,
    finish: "Terminar",
    back: (app) => `Volver a los pasos en ${app}`,
  },

  next: {
    title: "Y ahora",
    ask: (app) => `Pide algo a ${app}, en un chat con el conector activado:`,
    copyPrompt: "Copiar una petición para probar",
    another: "Conectar otra app",
    too: (tool) => `Conectar también ${tool}`,
    logs: "Ver sus llamadas en Registros",
  },

  trouble: {
    title: (app) => `Todavía no ha iniciado sesión nada. Lo que diga ${app} decide la solución:`,
    unreachable: "No pudo llegar o conectarse al servidor:",
    unreachableFix: (url) => (
      <>
        comprueba que la dirección es exactamente {url}, con /mcp al final. Una dirección nueva también puede tardar
        hasta 10 minutos en aparecer en internet; después, vuelve a intentarlo en la app.
      </>
    ),
    badCode: "La página de inicio de sesión dice que el código es incorrecto o ha caducado:",
    badCodeFix: "cada código vale 10 minutos. Escribe el que aparece ahora en el paso anterior.",
    noPage: "No se abrió ninguna página de inicio de sesión de WireCat:",
    noPageFix: (app) => `elige OAuth como autenticación en ${app}, y quita y vuelve a añadir el servidor.`,
  },

  activity: {
    justNow: "ahora mismo",
    minutes: (n) => `hace ${n} min`,
    hours: (n) => `hace ${n} h`,
    yesterday: "ayer",
    days: (n) => plural("es", n, { one: "hace # día", other: "hace # días" }),
    lastCall: (ago, tool, today) => `última llamada ${ago} · ${tool}${today ? ` · hoy: ${today}` : ""}`,
    connected: (ago) => `conectada ${ago}, aún sin llamadas`,
    loggedIn: (ago) => `inició sesión ${ago}`,
    noName: "Una app sin nombre",
  },
}

export const connectMessages: Messages<typeof en> = { en, ru, es }
