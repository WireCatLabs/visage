import type { ReactNode } from "react"
import { type Messages, plural } from "@/i18n"

/** The MCP server section: its summary, Server details, the login code and forgetting logins. */
const en = {
  server: {
    title: "Connect an AI app",
    unreadable: "Could not read it",
    later: "Arrives with the next update",
    off: "Server off",
    noApp: "No app connected",
    anApp: "An app",
    loggedIn: (n: number) => plural("en", n, { one: "# app logged in", other: "# apps logged in" }),
    noAppYet: "Server running, no app yet",
    intro: (tool: string, bin: string) =>
      `Let ChatGPT or Claude in the browser use ${tool}, within each profile's permissions. WireCat gives this computer an internet address, starts ${bin}'s server, shows what to click in the app and checks that the app gets through. Nothing starts until you press Start the server.`,
    reading: "Reading the server's state",
    stale: (error: string) =>
      `Could not read the server's state just now (${error}); showing the last answer and trying again.`,
    notYet: (tool: string, bin: string) =>
      `This version of ${tool} cannot do it yet. It arrives with the next update of ${bin}.`,
    details: "Server details",
    list: (tool: string) => `${tool} MCP server`,
    connected: "Connected",
    callsItself: (name: ReactNode): ReactNode => <>Calls itself {name}</>,
    offWarning: "The server is off, so these apps cannot reach it now.",
    another: "Connect another app",
    startConnect: "Start and connect",
  },

  row: {
    checking: "Checking",
    unreadable: "Could not read it",
    unavailable: "Not available yet",
    off: "Off",
    older: "Runs an older version",
    starting: "Starting",
    running: "Running",
    later: (tool: string) => `Arrives with the next update of ${tool}`,
    state: (listening: boolean, since: string | null, port: string, terminal: boolean) =>
      `${listening ? "Running" : "Starting"}${since ? ` since ${since}` : ""} on port ${port}${terminal ? ", started in a terminal" : ""}`,
    startLabel: (bin: string) => `Start the MCP server for ${bin}`,
    start: "Start",
    stopLabel: (bin: string) => `Stop the MCP server for ${bin}`,
    stopping: "Stopping…",
    stop: "Stop",
    again: "Check again",
    inTerminal: "It was started in a terminal, so stop it there.",
    outdated: (bin: string) => `It runs an older version of ${bin}. Stop and start it to update.`,
    tunnelLive:
      "Reachable from the internet through your Cloudflare tunnel, which WireCat runs. Stop takes it off the tunnel.",
    tunnelOff:
      "Your Cloudflare tunnel is off, so browser apps cannot reach the server. Stop and start it to start the tunnel again.",
    leftover: (url: ReactNode, profile: string | null): ReactNode =>
      profile ? (
        <>
          An older Tailscale Funnel for profile {profile} still sends {url} to this computer. Starting the server
          replaces it.
        </>
      ) : (
        <>An older Tailscale Funnel still sends {url} to this computer. Starting the server replaces it.</>
      ),
    turningOff: "Turning off…",
    turnOff: "Turn it off",
    copying: "Copying…",
    copyConfig: "Copy config for desktop apps",
    funnelLive: "Reachable from the internet through Tailscale Funnel, which WireCat set up. Stop turns it off.",
    funnelOff:
      "Tailscale Funnel for this address is off, so browser apps cannot reach the server. Stop and start it to turn Funnel on again.",
    funnelLeft: (url: ReactNode): ReactNode => (
      <>Tailscale Funnel still sends {url} to this computer, though the server is off.</>
    ),
    turnFunnelOff: "Turn Funnel off",
    address: "Address for the browser app",
    copyAddress: "Copy the connector address",
    code: "Login code",
    until: (time: string) => ` · until ${time}`,
    noCode: "Not shown yet. It appears once the server listens.",
    apps: "Logged-in apps",
    none: "None yet.",
    noName: "An app with no name",
    callsItself: (name: ReactNode): ReactNode => <>Calls itself {name}</>,
    lastLogin: (time: string) => `last login ${time}`,
    anyName: "Any app can give itself any name. If you do not recognise one, forget all logins.",
    forget: "Forget all logins",
  },

  forget: {
    title: (bin: string) => `Forget every login to ${bin}?`,
    keep: "Keep them",
    forgetting: "Forgetting…",
    forget: "Forget all logins",
    body: "Every browser app loses access at once and must log in again with a new code. The server keeps running.",
  },

  code: {
    copy: "Copy the login code",
    once: "Each code works for one login. After an app logs in, a new one appears here.",
    used: "New code — the last one was used.",
    usedBy: (name: string) => `New code — the last one was used by ${name}.`,
    noName: "an app with no name",
  },
}

const ru: typeof en = {
  server: {
    title: "Подключить ИИ-приложение",
    unreadable: "Не удалось прочитать",
    later: "Появится в следующем обновлении",
    off: "Сервер выключен",
    noApp: "Приложения не подключены",
    anApp: "Приложение",
    loggedIn: (n) =>
      plural("ru", n, {
        one: "Вошло # приложение",
        few: "Вошли # приложения",
        many: "Вошли # приложений",
        other: "Вошли # приложения",
      }),
    noAppYet: "Сервер работает, приложений пока нет",
    intro: (tool, bin) =>
      `ChatGPT или Claude в браузере смогут работать с ${tool} в рамках разрешений каждого профиля. WireCat даст этому компьютеру адрес в интернете, запустит сервер ${bin}, покажет, что нажать в приложении, и проверит, что приложение достучалось. Ничего не запустится, пока вы не нажмёте «Запустить сервер».`,
    reading: "Узнаём состояние сервера",
    stale: (error) =>
      `Сейчас не удалось узнать состояние сервера (${error}); показываем последний ответ и пробуем снова.`,
    notYet: (tool, bin) => `Эта версия ${tool} пока так не умеет. Это появится в следующем обновлении ${bin}.`,
    details: "Сведения о сервере",
    list: (tool) => `MCP-сервер ${tool}`,
    connected: "Подключено",
    callsItself: (name) => <>Называет себя {name}</>,
    offWarning: "Сервер выключен, поэтому эти приложения сейчас не могут до него достучаться.",
    another: "Подключить другое приложение",
    startConnect: "Запустить и подключить",
  },

  row: {
    checking: "Проверяем",
    unreadable: "Не удалось прочитать",
    unavailable: "Пока недоступно",
    off: "Выключен",
    older: "Работает старая версия",
    starting: "Запускается",
    running: "Работает",
    later: (tool) => `Появится в следующем обновлении ${tool}`,
    state: (listening, since, port, terminal) =>
      `${listening ? "Работает" : "Запускается"}${since ? ` с ${since}` : ""} на порту ${port}${terminal ? ", запущен в терминале" : ""}`,
    startLabel: (bin) => `Запустить MCP-сервер ${bin}`,
    start: "Запустить",
    stopLabel: (bin) => `Остановить MCP-сервер ${bin}`,
    stopping: "Останавливаем…",
    stop: "Остановить",
    again: "Проверить снова",
    inTerminal: "Он запущен в терминале, поэтому остановите его там.",
    outdated: (bin) => `Работает старая версия ${bin}. Остановите и запустите его, чтобы обновить.`,
    tunnelLive:
      "Доступен из интернета через ваш туннель Cloudflare, который запускает WireCat. «Остановить» убирает его из туннеля.",
    tunnelOff:
      "Ваш туннель Cloudflare выключен, поэтому браузерные приложения не достучатся до сервера. Остановите и запустите сервер, чтобы снова запустить туннель.",
    leftover: (url, profile) =>
      profile ? (
        <>
          Старый Tailscale Funnel для профиля {profile} всё ещё направляет {url} на этот компьютер. Запуск сервера
          заменит его.
        </>
      ) : (
        <>Старый Tailscale Funnel всё ещё направляет {url} на этот компьютер. Запуск сервера заменит его.</>
      ),
    turningOff: "Выключаем…",
    turnOff: "Выключить",
    copying: "Копируем…",
    copyConfig: "Скопировать настройки для настольных приложений",
    funnelLive: "Доступен из интернета через Tailscale Funnel, который настроил WireCat. «Остановить» выключит его.",
    funnelOff:
      "Tailscale Funnel для этого адреса выключен, поэтому браузерные приложения не достучатся до сервера. Остановите и запустите сервер, чтобы снова включить Funnel.",
    funnelLeft: (url) => <>Tailscale Funnel всё ещё направляет {url} на этот компьютер, хотя сервер выключен.</>,
    turnFunnelOff: "Выключить Funnel",
    address: "Адрес для браузерного приложения",
    copyAddress: "Скопировать адрес коннектора",
    code: "Код входа",
    until: (time) => ` · до ${time}`,
    noCode: "Пока не показан. Появится, когда сервер начнёт принимать подключения.",
    apps: "Вошедшие приложения",
    none: "Пока нет.",
    noName: "Приложение без имени",
    callsItself: (name) => <>Называет себя {name}</>,
    lastLogin: (time) => `последний вход ${time}`,
    anyName: "Любое приложение может назвать себя как угодно. Если какое-то вам незнакомо, сбросьте все входы.",
    forget: "Сбросить все входы",
  },

  forget: {
    title: (bin) => `Сбросить все входы в ${bin}?`,
    keep: "Оставить",
    forgetting: "Сбрасываем…",
    forget: "Сбросить все входы",
    body: "Все браузерные приложения сразу потеряют доступ и должны будут войти снова с новым кодом. Сервер продолжит работать.",
  },

  code: {
    copy: "Скопировать код входа",
    once: "Каждый код действует для одного входа. Когда приложение войдёт, здесь появится новый.",
    used: "Новый код — предыдущий уже использован.",
    usedBy: (name) => `Новый код — предыдущий использован: ${name}.`,
    noName: "приложение без имени",
  },
}

const es: typeof en = {
  server: {
    title: "Conectar una app de IA",
    unreadable: "No se pudo leer",
    later: "Llega con la próxima actualización",
    off: "Servidor apagado",
    noApp: "Ninguna app conectada",
    anApp: "Una app",
    loggedIn: (n) => plural("es", n, { one: "# app con sesión iniciada", other: "# apps con sesión iniciada" }),
    noAppYet: "Servidor en marcha, aún sin apps",
    intro: (tool, bin) =>
      `Deja que ChatGPT o Claude en el navegador usen ${tool}, dentro de los permisos de cada perfil. WireCat da a este ordenador una dirección de internet, inicia el servidor de ${bin}, te muestra qué pulsar en la app y comprueba que la app llega. No se inicia nada hasta que pulses Iniciar el servidor.`,
    reading: "Leyendo el estado del servidor",
    stale: (error) =>
      `No se pudo leer el estado del servidor ahora mismo (${error}); se muestra la última respuesta y se vuelve a intentar.`,
    notYet: (tool, bin) =>
      `Esta versión de ${tool} todavía no puede hacerlo. Llegará con la próxima actualización de ${bin}.`,
    details: "Detalles del servidor",
    list: (tool) => `Servidor MCP de ${tool}`,
    connected: "Conectada",
    callsItself: (name) => <>Se llama a sí misma {name}</>,
    offWarning: "El servidor está apagado, así que estas apps no pueden llegar a él ahora.",
    another: "Conectar otra app",
    startConnect: "Iniciar y conectar",
  },

  row: {
    checking: "Comprobando",
    unreadable: "No se pudo leer",
    unavailable: "Aún no disponible",
    off: "Apagado",
    older: "Ejecuta una versión anterior",
    starting: "Iniciándose",
    running: "En marcha",
    later: (tool) => `Llega con la próxima actualización de ${tool}`,
    state: (listening, since, port, terminal) =>
      `${listening ? "En marcha" : "Iniciándose"}${since ? ` desde ${since}` : ""} en el puerto ${port}${terminal ? ", iniciado en un terminal" : ""}`,
    startLabel: (bin) => `Iniciar el servidor MCP de ${bin}`,
    start: "Iniciar",
    stopLabel: (bin) => `Detener el servidor MCP de ${bin}`,
    stopping: "Deteniendo…",
    stop: "Detener",
    again: "Volver a comprobar",
    inTerminal: "Se inició en un terminal, así que detenlo allí.",
    outdated: (bin) => `Ejecuta una versión anterior de ${bin}. Detenlo e inícialo para actualizarlo.`,
    tunnelLive:
      "Accesible desde internet por tu túnel de Cloudflare, que gestiona WireCat. Detener lo quita del túnel.",
    tunnelOff:
      "Tu túnel de Cloudflare está apagado, así que las apps del navegador no pueden llegar al servidor. Detenlo e inícialo para volver a iniciar el túnel.",
    leftover: (url, profile) =>
      profile ? (
        <>
          Un Tailscale Funnel anterior del perfil {profile} sigue enviando {url} a este ordenador. Iniciar el servidor
          lo sustituye.
        </>
      ) : (
        <>Un Tailscale Funnel anterior sigue enviando {url} a este ordenador. Iniciar el servidor lo sustituye.</>
      ),
    turningOff: "Desactivando…",
    turnOff: "Desactivarlo",
    copying: "Copiando…",
    copyConfig: "Copiar la configuración para apps de escritorio",
    funnelLive: "Accesible desde internet por Tailscale Funnel, que configuró WireCat. Detener lo desactiva.",
    funnelOff:
      "Tailscale Funnel está desactivado para esta dirección, así que las apps del navegador no pueden llegar al servidor. Detenlo e inícialo para volver a activar Funnel.",
    funnelLeft: (url) => <>Tailscale Funnel sigue enviando {url} a este ordenador, aunque el servidor está apagado.</>,
    turnFunnelOff: "Desactivar Funnel",
    address: "Dirección para la app del navegador",
    copyAddress: "Copiar la dirección del conector",
    code: "Código de acceso",
    until: (time) => ` · hasta ${time}`,
    noCode: "Aún no se muestra. Aparece en cuanto el servidor escucha.",
    apps: "Apps con sesión iniciada",
    none: "Ninguna todavía.",
    noName: "Una app sin nombre",
    callsItself: (name) => <>Se llama a sí misma {name}</>,
    lastLogin: (time) => `último inicio de sesión ${time}`,
    anyName: "Cualquier app puede darse cualquier nombre. Si no reconoces alguna, olvida todos los inicios de sesión.",
    forget: "Olvidar todos los inicios de sesión",
  },

  forget: {
    title: (bin) => `¿Olvidar todos los inicios de sesión en ${bin}?`,
    keep: "Conservarlos",
    forgetting: "Olvidando…",
    forget: "Olvidar todos",
    body: "Todas las apps del navegador pierden el acceso a la vez y tendrán que volver a iniciar sesión con un código nuevo. El servidor sigue en marcha.",
  },

  code: {
    copy: "Copiar el código de acceso",
    once: "Cada código sirve para un inicio de sesión. Cuando una app inicia sesión, aquí aparece uno nuevo.",
    used: "Código nuevo: el anterior ya se usó.",
    usedBy: (name) => `Código nuevo: el anterior lo usó ${name}.`,
    noName: "una app sin nombre",
  },
}

export const mcpMessages: Messages<typeof en> = { en, ru, es }
