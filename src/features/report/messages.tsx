import type { ReactNode } from "react"
import { type Lang, type Messages, plural } from "@/i18n"

type Attached = { runs: number; tools: string; logLines: number; errors: number }

const en = {
  title: "Report a problem",
  sentTitle: "Report sent",
  intro: (policy: ReactNode): ReactNode => (
    <>
      Your report becomes a public issue on GitHub, so you can follow it. Email addresses, phone numbers and tokens in
      your text are masked before it leaves this computer. For a security problem, use the {policy} instead.
    </>
  ),
  policy: "security policy",
  theApp: "The app",
  aTool: "A tool",
  summary: "Summary",
  summaryExample: "Installing Google Drive stops at “Verifying”",
  about: "About",
  steps: "What were you doing?",
  stepsHint: "The steps that lead to the problem, one per line. Numbered steps help the most.",
  stepsExample: "1. Opened Tools\n2. Pressed Install on Google Drive\n3. Waited at “Verifying”",
  happened: "What happened?",
  happenedHint: "What you saw. Copy the exact message if there was one.",
  happenedExample: "The install stopped and said “EACCES: permission denied”.",
  expected: "What did you expect?",
  expectedExample: "Google Drive to install and show a green lamp.",
  optional: "optional",
  missing: {
    summary: "Write a one-line summary of the problem.",
    about: "Choose the app or a tool.",
    happened: "Describe what went wrong.",
  },
  charactersUsed: "Characters used: ",
  whatIsSent: "What is sent",
  logsNote: (withErrors: boolean) =>
    `Recent error logs from your tools${withErrors ? ", and this window’s recent errors," : ""} are attached. They are masked, kept only on WireCat’s server for 90 days, and never shown on GitHub. They can still contain personal details you typed into a command, such as a search query.`,
  seeAttached: "See what is attached",
  seeIssue: "See the public issue",
  attached: ({ runs, tools, logLines, errors }: Attached) =>
    [
      plural("en", runs, { one: "# failed run", other: "# failed runs" }) + (tools ? ` from ${tools}` : ""),
      logLines ? `the ${logLines}-line install log` : "",
      errors
        ? plural("en", errors, { one: "# recent error from this window", other: "# recent errors from this window" })
        : "",
    ]
      .filter(Boolean)
      .join(", and ") + ".",
  notAvailable: "Not available: this computer’s details could not be read.",
  collecting: "Collecting versions and recent errors…",
  done: "Done",
  contextFailed: (error: string) => `Could not read this computer’s details: ${error}`,
  openOnGitHub: "Open on GitHub instead",
  cancel: "Cancel",
  sendTitle: "Send report (Ctrl+Enter)",
  sending: "Sending…",
  preparing: "Preparing…",
  tryAgain: "Try again",
  send: "Send report",
  thanksIssue: (n: number) => `Thank you. The report is issue #${n}.`,
  thanksSaved: "Thank you. The report is saved.",
  openIssue: "Open the issue on GitHub",
  queued: (id: string) =>
    `GitHub did not answer in time, so the issue will be opened shortly. Your report id is ${id}.`,
  reportThis: "Report this",
  reportThisTitle: "Open a report about this, filled in. You can read and change it before sending.",
}

const ruPlural = (lang: Lang, n: number, one: string, few: string, many: string) =>
  plural(lang, n, { one, few, many, other: few })

const ru: typeof en = {
  title: "Сообщить о проблеме",
  sentTitle: "Отчёт отправлен",
  intro: (policy) => (
    <>
      Отчёт станет открытым обсуждением (issue) на GitHub, чтобы вы могли за ним следить. Адреса почты, номера телефонов
      и токены в тексте скрываются ещё на этом компьютере. О проблеме с безопасностью сообщайте по {policy}.
    </>
  ),
  policy: "правилам безопасности",
  theApp: "Приложение",
  aTool: "Инструмент",
  summary: "Кратко",
  summaryExample: "Установка Google Drive останавливается на «Проверке»",
  about: "О чём",
  steps: "Что вы делали?",
  stepsHint: "Шаги, которые привели к проблеме, по одному на строку. Лучше всего — нумерованные.",
  stepsExample: "1. Открыл «Инструменты»\n2. Нажал «Установить» у Google Drive\n3. Ждал на «Проверке»",
  happened: "Что произошло?",
  happenedHint: "Что вы увидели. Если было сообщение, скопируйте его точно.",
  happenedExample: "Установка остановилась с сообщением «EACCES: permission denied».",
  expected: "Чего вы ожидали?",
  expectedExample: "Что Google Drive установится и загорится зелёный индикатор.",
  optional: "необязательно",
  missing: {
    summary: "Опишите проблему одной строкой.",
    about: "Выберите приложение или инструмент.",
    happened: "Опишите, что пошло не так.",
  },
  charactersUsed: "Использовано символов: ",
  whatIsSent: "Что отправляется",
  logsNote: (withErrors) =>
    `К отчёту прикладываются недавние журналы ошибок ваших инструментов${withErrors ? " и недавние ошибки этого окна" : ""}. Личные данные в них скрыты; они хранятся только на сервере WireCat 90 дней и никогда не показываются на GitHub. В них всё же может остаться то, что вы сами вводили в команду, например поисковый запрос.`,
  seeAttached: "Посмотреть, что прикладывается",
  seeIssue: "Посмотреть открытое обсуждение",
  attached: ({ runs, tools, logLines, errors }) =>
    [
      ruPlural("ru", runs, "# неудачный запуск", "# неудачных запуска", "# неудачных запусков") +
        (tools ? ` (${tools})` : ""),
      logLines ? `журнал установки (${ruPlural("ru", logLines, "# строка", "# строки", "# строк")})` : "",
      errors
        ? ruPlural(
            "ru",
            errors,
            "# недавняя ошибка этого окна",
            "# недавние ошибки этого окна",
            "# недавних ошибок этого окна",
          )
        : "",
    ]
      .filter(Boolean)
      .join(", ") + ".",
  notAvailable: "Недоступно: не удалось прочитать сведения об этом компьютере.",
  collecting: "Собираем версии и недавние ошибки…",
  done: "Готово",
  contextFailed: (error) => `Не удалось прочитать сведения об этом компьютере: ${error}`,
  openOnGitHub: "Открыть на GitHub",
  cancel: "Отмена",
  sendTitle: "Отправить отчёт (Ctrl+Enter)",
  sending: "Отправка…",
  preparing: "Подготовка…",
  tryAgain: "Попробовать снова",
  send: "Отправить отчёт",
  thanksIssue: (n) => `Спасибо. Отчёт стал обсуждением №${n}.`,
  thanksSaved: "Спасибо. Отчёт сохранён.",
  openIssue: "Открыть обсуждение на GitHub",
  queued: (id) => `GitHub не ответил вовремя, поэтому обсуждение откроется чуть позже. Номер вашего отчёта: ${id}.`,
  reportThis: "Сообщить",
  reportThisTitle: "Открыть заполненный отчёт об этом. Перед отправкой его можно прочитать и изменить.",
}

const es: typeof en = {
  title: "Informar de un problema",
  sentTitle: "Informe enviado",
  intro: (policy) => (
    <>
      Tu informe se convierte en una incidencia pública en GitHub, para que puedas seguirla. Los correos, números de
      teléfono y tokens de tu texto se ocultan antes de salir de este ordenador. Si es un problema de seguridad, usa la{" "}
      {policy}.
    </>
  ),
  policy: "política de seguridad",
  theApp: "La app",
  aTool: "Una herramienta",
  summary: "Resumen",
  summaryExample: "La instalación de Google Drive se queda en «Verificando»",
  about: "Sobre",
  steps: "¿Qué estabas haciendo?",
  stepsHint: "Los pasos que llevan al problema, uno por línea. Los pasos numerados son los que más ayudan.",
  stepsExample: "1. Abrí Herramientas\n2. Pulsé Instalar en Google Drive\n3. Se quedó en «Verificando»",
  happened: "¿Qué ha pasado?",
  happenedHint: "Lo que viste. Si hubo un mensaje, cópialo tal cual.",
  happenedExample: "La instalación se detuvo con «EACCES: permission denied».",
  expected: "¿Qué esperabas?",
  expectedExample: "Que Google Drive se instalara y mostrara una luz verde.",
  optional: "opcional",
  missing: {
    summary: "Escribe un resumen del problema en una línea.",
    about: "Elige la app o una herramienta.",
    happened: "Describe qué ha fallado.",
  },
  charactersUsed: "Caracteres usados: ",
  whatIsSent: "Qué se envía",
  logsNote: (withErrors) =>
    `Se adjuntan los registros de errores recientes de tus herramientas${withErrors ? " y los errores recientes de esta ventana" : ""}. Van ocultos, se guardan solo en el servidor de WireCat durante 90 días y nunca se muestran en GitHub. Aun así pueden contener datos personales que escribiste en un comando, como una búsqueda.`,
  seeAttached: "Ver qué se adjunta",
  seeIssue: "Ver la incidencia pública",
  attached: ({ runs, tools, logLines, errors }) =>
    [
      plural("es", runs, { one: "# ejecución fallida", other: "# ejecuciones fallidas" }) +
        (tools ? ` de ${tools}` : ""),
      logLines ? `el registro de instalación de ${logLines} líneas` : "",
      errors
        ? plural("es", errors, {
            one: "# error reciente de esta ventana",
            other: "# errores recientes de esta ventana",
          })
        : "",
    ]
      .filter(Boolean)
      .join(", y ") + ".",
  notAvailable: "No disponible: no se han podido leer los datos de este ordenador.",
  collecting: "Recopilando versiones y errores recientes…",
  done: "Listo",
  contextFailed: (error) => `No se han podido leer los datos de este ordenador: ${error}`,
  openOnGitHub: "Abrir en GitHub",
  cancel: "Cancelar",
  sendTitle: "Enviar informe (Ctrl+Enter)",
  sending: "Enviando…",
  preparing: "Preparando…",
  tryAgain: "Reintentar",
  send: "Enviar informe",
  thanksIssue: (n) => `Gracias. El informe es la incidencia #${n}.`,
  thanksSaved: "Gracias. El informe se ha guardado.",
  openIssue: "Abrir la incidencia en GitHub",
  queued: (id) =>
    `GitHub no ha respondido a tiempo, así que la incidencia se abrirá en breve. El identificador de tu informe es ${id}.`,
  reportThis: "Informar",
  reportThisTitle: "Abrir un informe sobre esto ya rellenado. Puedes leerlo y cambiarlo antes de enviarlo.",
}

export const reportMessages: Messages<typeof en> = { en, ru, es }
