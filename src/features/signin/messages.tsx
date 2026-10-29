import type { ReactNode } from "react"
import { type Messages, plural } from "@/i18n"

type Received = { chats: number; messages: number; people: number }

const en = {
  title: (name: string) => `Sign in to ${name}`,
  intro: (profile: ReactNode, name: string): ReactNode => (
    <>
      Signs {profile} in to {name} on this computer.
    </>
  ),
  starting: "Starting the sign-in",
  asking: (name: string) => `Asking ${name} how to sign in…`,
  waitingBrowser: "Waiting for you to finish in the browser…",
  historySlow: "Still waiting for the phone's history.",
  historyLinked: "Linked. Receiving your chat history from the phone.",
  keepOpen: (name: string) =>
    `Keep ${name} open on the phone; it can take a minute. Stopping now keeps what has arrived.`,
  working: "Working.",
  signedIn: (name: string, profile: string) => `${name} is signed in as ${profile}.`,
  alreadySignedIn: (name: string, profile: string) => `${name} was already signed in as ${profile}.`,
  received: ({ chats, messages, people }: Received) =>
    `Received ${plural("en", chats, { one: "# chat", other: "# chats" })}, ${plural("en", messages, {
      one: "# message",
      other: "# messages",
    })} and ${plural("en", people, { one: "# person", other: "# people" })} from the phone.`,
  needsUpdate: "This version cannot sign in here yet. Update it on the Tools page, or use Open terminal.",
  ended: "The sign-in ended without saying how.",
  continueOn: (host: string) => `Continue on ${host}.`,
  openHost: (host: string) => `Open ${host}`,
  typeCode: "Type this code on the phone.",
  typeCodeAt: (place: string) => `Type this code on the phone: ${place}.`,
  pointCamera: "Point the phone's camera at this code.",
  codeChanges: "The code changes every few seconds; the new one appears here by itself.",
  qrLabel: "QR code to scan with your phone",
  expiresIn: (seconds: number) => `This code expires in ${seconds} s.`,
  expired: "This code has expired; a new one is on its way.",
  clientIdIntro:
    "Zoom signs in through an app of your own, made once in the Zoom App Marketplace. Paste its Public Client ID.",
  howToMakeApp: "How to make the app",
  clientId: "Public Client ID",
  saving: "Saving…",
  saveAndSignIn: "Save and sign in",
  nextConnect: "Next, ChatGPT or Claude in the browser can use it too.",
  connectApp: "Connect an AI app",
  openTool: (name: string) => `Open ${name}`,
  announce: {
    stopping: "Stopping the sign-in.",
    qrReady: "The QR code is ready to scan.",
    pairReady: "A code to type on the phone is ready.",
    browser: "Continue in the browser.",
    asks: (prompt: string) => `The sign-in asks for the ${prompt}.`,
    slow: "Still waiting.",
    working: "Working.",
    done: "Signed in. Press Done to close.",
  },
  switchTo: (id: string, label: string) => {
    if (id === "qr") return "Use QR code instead"
    if (id === "phone") return "Use phone number instead"
    if (id === "browser") return "Use the browser instead"
    return `Use ${label.toLowerCase()} instead`
  },
  stopping: "Stopping…",
  stopKeep: "Stop and keep what came",
  cancel: "Cancel",
  close: "Close",
  openTerminal: "Open terminal",
  tryAgain: "Try again",
  done: "Done",
  show: (field: string) => `Show ${field.toLowerCase()}`,
  showShort: "Show",
  hide: "Hide",
  sent: "Sent. Waiting for the next step…",
  hint: (hint: string) => `Hint: ${hint}`,
  private: "Goes straight to the tool on this computer; WireCat keeps no copy.",
  continue: "Continue",
}

const ru: typeof en = {
  title: (name) => `Вход в ${name}`,
  intro: (profile, name) => (
    <>
      Выполняет вход профиля {profile} в {name} на этом компьютере.
    </>
  ),
  starting: "Начинаем вход",
  asking: (name) => `Спрашиваем у ${name}, как войти…`,
  waitingBrowser: "Ждём, пока вы закончите в браузере…",
  historySlow: "Всё ещё ждём историю с телефона.",
  historyLinked: "Устройство привязано. Получаем историю чатов с телефона.",
  keepOpen: (name) =>
    `Не закрывайте ${name} на телефоне: это может занять минуту. Если остановить сейчас, полученное сохранится.`,
  working: "Выполняется.",
  signedIn: (name, profile) => `Вход в ${name} выполнен: профиль ${profile}.`,
  alreadySignedIn: (name, profile) => `Вход в ${name} уже был выполнен: профиль ${profile}.`,
  received: ({ chats, messages, people }) =>
    `Получено с телефона: ${plural("ru", chats, { one: "# чат", few: "# чата", many: "# чатов", other: "# чата" })}, ${plural(
      "ru",
      messages,
      { one: "# сообщение", few: "# сообщения", many: "# сообщений", other: "# сообщения" },
    )} и ${plural("ru", people, { one: "# человек", few: "# человека", many: "# человек", other: "# человека" })}.`,
  needsUpdate:
    "Эта версия пока не умеет входить здесь. Обновите её на странице «Инструменты» или нажмите «Открыть терминал».",
  ended: "Вход завершился без объяснения причины.",
  continueOn: (host) => `Продолжите на ${host}.`,
  openHost: (host) => `Открыть ${host}`,
  typeCode: "Введите этот код на телефоне.",
  typeCodeAt: (place) => `Введите этот код на телефоне: ${place}.`,
  pointCamera: "Наведите камеру телефона на этот код.",
  codeChanges: "Код меняется каждые несколько секунд; новый появится здесь сам.",
  qrLabel: "QR-код для сканирования телефоном",
  expiresIn: (seconds) => `Код истечёт через ${seconds} с.`,
  expired: "Срок кода истёк; новый уже в пути.",
  clientIdIntro:
    "Zoom выполняет вход через ваше собственное приложение, созданное один раз в Zoom App Marketplace. Вставьте его Public Client ID.",
  howToMakeApp: "Как создать приложение",
  clientId: "Public Client ID",
  saving: "Сохраняем…",
  saveAndSignIn: "Сохранить и войти",
  nextConnect: "Теперь им могут пользоваться и ChatGPT или Claude в браузере.",
  connectApp: "Подключить ИИ-приложение",
  openTool: (name) => `Открыть ${name}`,
  announce: {
    stopping: "Останавливаем вход.",
    qrReady: "QR-код готов к сканированию.",
    pairReady: "Код для ввода на телефоне готов.",
    browser: "Продолжите в браузере.",
    asks: (prompt) => `Для входа нужно ввести: ${prompt}.`,
    slow: "Всё ещё ждём.",
    working: "Выполняется.",
    done: "Вход выполнен. Нажмите «Готово», чтобы закрыть.",
  },
  switchTo: (id, label) => {
    if (id === "qr") return "Войти по QR-коду"
    if (id === "phone") return "Войти по номеру телефона"
    if (id === "browser") return "Войти через браузер"
    return `Другой способ: ${label}`
  },
  stopping: "Останавливаем…",
  stopKeep: "Остановить и сохранить полученное",
  cancel: "Отмена",
  close: "Закрыть",
  openTerminal: "Открыть терминал",
  tryAgain: "Повторить",
  done: "Готово",
  show: (field) => `Показать: ${field}`,
  showShort: "Показать",
  hide: "Скрыть",
  sent: "Отправлено. Ждём следующего шага…",
  hint: (hint) => `Подсказка: ${hint}`,
  private: "Передаётся прямо инструменту на этом компьютере; WireCat не хранит копию.",
  continue: "Продолжить",
}

const es: typeof en = {
  title: (name) => `Iniciar sesión en ${name}`,
  intro: (profile, name) => (
    <>
      Inicia sesión con {profile} en {name} en este ordenador.
    </>
  ),
  starting: "Iniciando la sesión",
  asking: (name) => `Preguntando a ${name} cómo iniciar sesión…`,
  waitingBrowser: "Esperando a que termines en el navegador…",
  historySlow: "Seguimos esperando el historial del teléfono.",
  historyLinked: "Vinculado. Recibiendo tu historial de chats desde el teléfono.",
  keepOpen: (name) =>
    `Mantén ${name} abierto en el teléfono; puede tardar un minuto. Si lo detienes ahora, se conserva lo que haya llegado.`,
  working: "Trabajando.",
  signedIn: (name, profile) => `Sesión iniciada en ${name} como ${profile}.`,
  alreadySignedIn: (name, profile) => `Ya habías iniciado sesión en ${name} como ${profile}.`,
  received: ({ chats, messages, people }) =>
    `Se han recibido del teléfono ${plural("es", chats, { one: "# chat", other: "# chats" })}, ${plural(
      "es",
      messages,
      {
        one: "# mensaje",
        many: "# de mensajes",
        other: "# mensajes",
      },
    )} y ${plural("es", people, { one: "# persona", other: "# personas" })}.`,
  needsUpdate:
    "Esta versión todavía no puede iniciar sesión aquí. Actualízala en la página Herramientas o usa Abrir terminal.",
  ended: "El inicio de sesión terminó sin decir por qué.",
  continueOn: (host) => `Continúa en ${host}.`,
  openHost: (host) => `Abrir ${host}`,
  typeCode: "Escribe este código en el teléfono.",
  typeCodeAt: (place) => `Escribe este código en el teléfono: ${place}.`,
  pointCamera: "Apunta la cámara del teléfono a este código.",
  codeChanges: "El código cambia cada pocos segundos; el nuevo aparece aquí solo.",
  qrLabel: "Código QR para escanear con el teléfono",
  expiresIn: (seconds) => `Este código caduca en ${seconds} s.`,
  expired: "Este código ha caducado; ya viene uno nuevo.",
  clientIdIntro:
    "Zoom inicia sesión a través de una app tuya, creada una vez en Zoom App Marketplace. Pega su Public Client ID.",
  howToMakeApp: "Cómo crear la app",
  clientId: "Public Client ID",
  saving: "Guardando…",
  saveAndSignIn: "Guardar e iniciar sesión",
  nextConnect: "Ahora ChatGPT o Claude en el navegador también pueden usarlo.",
  connectApp: "Conectar una app de IA",
  openTool: (name) => `Abrir ${name}`,
  announce: {
    stopping: "Deteniendo el inicio de sesión.",
    qrReady: "El código QR está listo para escanear.",
    pairReady: "Ya está listo el código para escribir en el teléfono.",
    browser: "Continúa en el navegador.",
    asks: (prompt) => `El inicio de sesión pide: ${prompt}.`,
    slow: "Seguimos esperando.",
    working: "Trabajando.",
    done: "Sesión iniciada. Pulsa Listo para cerrar.",
  },
  switchTo: (id, label) => {
    if (id === "qr") return "Usar código QR"
    if (id === "phone") return "Usar número de teléfono"
    if (id === "browser") return "Usar el navegador"
    return `Usar otro método: ${label}`
  },
  stopping: "Deteniendo…",
  stopKeep: "Detener y conservar lo recibido",
  cancel: "Cancelar",
  close: "Cerrar",
  openTerminal: "Abrir terminal",
  tryAgain: "Reintentar",
  done: "Listo",
  show: (field) => `Mostrar: ${field}`,
  showShort: "Mostrar",
  hide: "Ocultar",
  sent: "Enviado. Esperando el siguiente paso…",
  hint: (hint) => `Pista: ${hint}`,
  private: "Va directo a la herramienta en este ordenador; WireCat no guarda ninguna copia.",
  continue: "Continuar",
}

export type SigninMessages = typeof en

export const signinMessages: Messages<typeof en> = { en, ru, es }
