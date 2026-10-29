import type { ReactNode } from "react"
import { type Messages, plural } from "@/i18n"
import type { PasswordProblem, Strength } from "./backup-password"
import type { Progress } from "./backup-store"

const ruForms = (n: number, [one, few, many]: [string, string, string]) =>
  plural("ru", n, { one, few, many, other: few })

const en = {
  backups: "Backups",
  backupsIntro: (folder: ReactNode): ReactNode => (
    <>
      A copy of the whole storage database, in {folder}. Without a password it is a plain zip: keep it somewhere
      private.
    </>
  ),
  backUpNow: "Back up now",
  protect: "Protect with a password",
  protectHelp: "The tool compresses and encrypts the backup itself. Opening it later asks for the password.",
  backupFailed: (error: string) => `The backup did not finish: ${error}`,
  made: (encrypted: boolean, name: ReactNode, size: ReactNode, from: ReactNode, took: ReactNode): ReactNode => (
    <>
      {encrypted ? "Backed up with a password to" : "Backed up to"} {name} · {size} from {from} in {took}
    </>
  ),
  copyNeeds: "Tools keep using storage while it is copied. You need about one and a half times its size free.",
  cleared: (schema: number) =>
    `Storage was cleared. It is empty at schema ${schema} and fills again with the next sync or import.`,
  clearBackupFailed: "The backup did not finish, so nothing was deleted.",
  readingBackups: "Reading backups",
  noBackups: "No backups yet.",
  backupsLabel: "Backups on this computer",
  encrypted: "Encrypted with a password",
  showFile: (name: string) => `Show ${name} in the file manager`,
  howToRestore: "How to restore",
  restoreZip: (ext: ReactNode, command: ReactNode): ReactNode => (
    <>
      To restore a {ext}: unzip it, then run {command}.
    </>
  ),
  restoreSealed: (ext: ReactNode, command: ReactNode): ReactNode => (
    <>
      To restore a {ext}: run {command}; it asks for the password.
    </>
  ),
  openBackups: "Open backups folder",
  clearStorage: "Clear storage",
  clearAsking: "Asking the tool what clearing would delete…",
  clearNoTool: "Install Telegram, WhatsApp or MAX: clearing is done by a messenger tool.",
  clearOld: (bin: string) =>
    `Clearing needs a newer ${bin}, one that lists what clearing would delete. Update ${bin} on the Tools page.`,
  clearNothing: "Storage is not created yet, so there is nothing to clear.",
  clearWhat: "Deletes every message, chat, email, document and meeting in storage. Settings and sign-ins stay.",
  clearing: "Clearing…",
  clearOpen: "Clear storage…",

  password: "Password",
  repeat: "Repeat password",
  showPassword: "Show password",
  hidePassword: "Hide password",
  strength: (level: Strength) => `Strength: ${["Too short", "Weak", "Fair", "Strong"][level]}`,
  longer: "Longer is stronger.",
  problem: (problem: PasswordProblem, min: number) =>
    ({
      empty: "Type a password.",
      space: "A password cannot start or end with a space.",
      short: `Use at least ${min} characters.`,
      repeat: "Type the password again.",
      differ: "The two passwords differ.",
    })[problem],
  match: "The passwords match.",
  lose: "If you lose it, the backup cannot be opened. WireCat does not keep it.",

  step: {
    starting: "Checking disk space",
    copying: "Copying storage",
    compressing: "Compressing",
    encrypting: "Encrypting",
  } as Record<Progress["step"], string>,
  cantStop: "Can't stop",
  cancel: "Cancel",

  clearTitle: "Clear storage?",
  keepStorage: "Keep storage",
  backUpAndClear: "Back up and clear",
  clearWithout: "Clear without a backup",
  cannotUndo: "It cannot be undone",
  clearWarning: (undone: ReactNode): ReactNode => (
    <>This deletes everything in storage, for every tool and account. {undone} except from a backup.</>
  ),
  askingDeleted: "Asking what would be deleted",
  previewError: (error: string) => `Could not ask what would be deleted: ${error}`,
  whatDeleted: "What is deleted",
  storageFiles: (size: ReactNode): ReactNode => <>The storage files, {size}:</>,
  filesDeleted: "Files deleted",
  tablesWithRows: (tables: number, rows: number, command: ReactNode): ReactNode => (
    <>
      {plural("en", tables, { one: "# table", other: "# tables" })} with{" "}
      {plural("en", rows, { one: "# row", other: "# rows" })}, read by {command}:
    </>
  ),
  tablesEmptied: "Tables emptied",
  whatStays: "What stays",
  stays: (folder: ReactNode, schema: string): ReactNode => (
    <>
      Each tool's settings, profiles and sign-ins, tokens in the system keyring, and backups in {folder}. Storage starts
      again empty at schema {schema}, and the next sync or import fills it, scheduled ones included.
    </>
  ),
  inUse:
    "A sync, an import, a server or an agent's WireCat MCP connection has storage open right now. Clearing is refused until it finishes, or until you close those agent sessions.",
  backUpFirst: "Back up first",
  backUpFirstHelp:
    "A zip in the backups folder before anything is deleted. If the backup fails or you cancel it, nothing is deleted.",
  typeToConfirm: (word: ReactNode): ReactNode => <>Type {word} to confirm</>,
  /** Typed to enable the button: a click alone is too easy for a deletion nobody gets back. */
  confirmWord: "clear",
  clearingStorage: "Clearing storage…",
  cannotPreview: "The installed tool cannot say what clearing would delete, so clearing is off.",
}

const ru: typeof en = {
  backups: "Резервные копии",
  backupsIntro: (folder) => (
    <>
      Копия всей базы данных хранилища в папке {folder}. Без пароля это обычный zip: храните его там, куда нет доступа у
      посторонних.
    </>
  ),
  backUpNow: "Сделать копию",
  protect: "Защитить паролем",
  protectHelp: "Инструмент сам сжимает и шифрует копию. Чтобы потом открыть её, понадобится пароль.",
  backupFailed: (error) => `Копия не сделана: ${error}`,
  made: (encrypted, name, size, from, took) => (
    <>
      {encrypted ? "Копия с паролем готова:" : "Копия готова:"} {name} · {size} из {from} за {took}
    </>
  ),
  copyNeeds:
    "Пока хранилище копируется, инструменты продолжают с ним работать. Свободного места нужно примерно в полтора раза больше его размера.",
  cleared: (schema) =>
    `Хранилище очищено. Сейчас оно пустое, на схеме ${schema}, и заполнится снова при следующей синхронизации или импорте.`,
  clearBackupFailed: "Резервная копия не завершилась, поэтому ничего не удалено.",
  readingBackups: "Читаем резервные копии",
  noBackups: "Резервных копий пока нет.",
  backupsLabel: "Резервные копии на этом компьютере",
  encrypted: "Зашифрована паролем",
  showFile: (name) => `Показать ${name} в файловом менеджере`,
  howToRestore: "Как восстановить",
  restoreZip: (ext, command) => (
    <>
      Чтобы восстановить {ext}: распакуйте его и выполните {command}.
    </>
  ),
  restoreSealed: (ext, command) => (
    <>
      Чтобы восстановить {ext}: выполните {command}, команда спросит пароль.
    </>
  ),
  openBackups: "Открыть папку с копиями",
  clearStorage: "Очистить хранилище",
  clearAsking: "Спрашиваем инструмент, что удалит очистка…",
  clearNoTool: "Установите Telegram, WhatsApp или MAX: очистку выполняет инструмент мессенджера.",
  clearOld: (bin) =>
    `Для очистки нужен более новый ${bin}, который умеет показать, что будет удалено. Обновите ${bin} на странице «Инструменты».`,
  clearNothing: "Хранилище ещё не создано, очищать нечего.",
  clearWhat: "Удаляет все сообщения, чаты, письма, документы и встречи в хранилище. Настройки и входы остаются.",
  clearing: "Очищаем…",
  clearOpen: "Очистить хранилище…",

  password: "Пароль",
  repeat: "Повторите пароль",
  showPassword: "Показать пароль",
  hidePassword: "Скрыть пароль",
  strength: (level) => `Надёжность: ${["недостаточная", "низкая", "средняя", "высокая"][level]}`,
  longer: "Чем длиннее, тем надёжнее.",
  problem: (problem, min) =>
    ({
      empty: "Введите пароль.",
      space: "Пароль не может начинаться или заканчиваться пробелом.",
      short: ruForms(min, ["Нужен хотя бы # символ.", "Нужно хотя бы # символа.", "Нужно хотя бы # символов."]),
      repeat: "Введите пароль ещё раз.",
      differ: "Пароли не совпадают.",
    })[problem],
  match: "Пароли совпадают.",
  lose: "Если вы его потеряете, копию будет не открыть. WireCat пароль не хранит.",

  step: {
    starting: "Проверяем место на диске",
    copying: "Копируем хранилище",
    compressing: "Сжимаем",
    encrypting: "Шифруем",
  },
  cantStop: "Не остановить",
  cancel: "Отменить",

  clearTitle: "Очистить хранилище?",
  keepStorage: "Не очищать",
  backUpAndClear: "Сделать копию и очистить",
  clearWithout: "Очистить без копии",
  cannotUndo: "Отменить это нельзя",
  clearWarning: (undone) => (
    <>
      Будет удалено всё содержимое хранилища, для всех инструментов и аккаунтов. {undone}, можно только восстановить из
      резервной копии.
    </>
  ),
  askingDeleted: "Выясняем, что будет удалено",
  previewError: (error) => `Не удалось узнать, что будет удалено: ${error}`,
  whatDeleted: "Что удаляется",
  storageFiles: (size) => <>Файлы хранилища, {size}:</>,
  filesDeleted: "Удаляемые файлы",
  tablesWithRows: (tables, rows, command) => (
    <>
      {ruForms(tables, ["# таблица", "# таблицы", "# таблиц"])}, в них{" "}
      {ruForms(rows, ["# строка", "# строки", "# строк"])}. Данные получены командой {command}:
    </>
  ),
  tablesEmptied: "Очищаемые таблицы",
  whatStays: "Что остаётся",
  stays: (folder, schema) => (
    <>
      Настройки, профили и входы каждого инструмента, токены в системном хранилище ключей и резервные копии в папке{" "}
      {folder}. Хранилище начнётся заново, пустым, на схеме {schema}, и его заполнит следующая синхронизация или импорт,
      в том числе запланированные.
    </>
  ),
  inUse:
    "Хранилище сейчас открыто: его держит синхронизация, импорт, сервер или подключение агента к WireCat MCP. Очистка не сработает, пока они не закончат или пока вы не закроете эти сеансы агентов.",
  backUpFirst: "Сначала сделать копию",
  backUpFirstHelp:
    "Zip-архив в папке с копиями, ещё до удаления. Если копирование не удастся или вы его отмените, ничего не удалится.",
  typeToConfirm: (word) => <>Введите {word}, чтобы подтвердить</>,
  confirmWord: "очистить",
  clearingStorage: "Очищаем хранилище…",
  cannotPreview: "Установленный инструмент не может сказать, что удалит очистка, поэтому очистка недоступна.",
}

const es: typeof en = {
  backups: "Copias de seguridad",
  backupsIntro: (folder) => (
    <>
      Una copia de toda la base de datos del almacenamiento, en {folder}. Sin contraseña es un zip normal: guárdalo en
      un sitio privado.
    </>
  ),
  backUpNow: "Hacer copia ahora",
  protect: "Proteger con contraseña",
  protectHelp: "La herramienta comprime y cifra la copia ella misma. Al abrirla después, te pedirá la contraseña.",
  backupFailed: (error) => `La copia no terminó: ${error}`,
  made: (encrypted, name, size, from, took) => (
    <>
      {encrypted ? "Copia con contraseña guardada en" : "Copia guardada en"} {name} · {size} de {from} en {took}
    </>
  ),
  copyNeeds:
    "Las herramientas siguen usando el almacenamiento mientras se copia. Necesitas libre alrededor de una vez y media su tamaño.",
  cleared: (schema) =>
    `Se vació el almacenamiento. Está vacío en el esquema ${schema} y se vuelve a llenar con la próxima sincronización o importación.`,
  clearBackupFailed: "La copia no terminó, así que no se borró nada.",
  readingBackups: "Leyendo las copias",
  noBackups: "Aún no hay copias.",
  backupsLabel: "Copias en este ordenador",
  encrypted: "Cifrada con contraseña",
  showFile: (name) => `Mostrar ${name} en el gestor de archivos`,
  howToRestore: "Cómo restaurar",
  restoreZip: (ext, command) => (
    <>
      Para restaurar un {ext}: descomprímelo y ejecuta {command}.
    </>
  ),
  restoreSealed: (ext, command) => (
    <>
      Para restaurar un {ext}: ejecuta {command}; te pedirá la contraseña.
    </>
  ),
  openBackups: "Abrir la carpeta de copias",
  clearStorage: "Vaciar el almacenamiento",
  clearAsking: "Preguntando a la herramienta qué borraría el vaciado…",
  clearNoTool: "Instala Telegram, WhatsApp o MAX: el vaciado lo hace una herramienta de mensajería.",
  clearOld: (bin) =>
    `Para vaciar hace falta un ${bin} más nuevo, uno que diga qué se borraría. Actualiza ${bin} en la página Herramientas.`,
  clearNothing: "El almacenamiento aún no existe, así que no hay nada que vaciar.",
  clearWhat:
    "Borra todos los mensajes, chats, correos, documentos y reuniones del almacenamiento. Los ajustes y los inicios de sesión se quedan.",
  clearing: "Vaciando…",
  clearOpen: "Vaciar el almacenamiento…",

  password: "Contraseña",
  repeat: "Repite la contraseña",
  showPassword: "Mostrar contraseña",
  hidePassword: "Ocultar contraseña",
  strength: (level) => `Seguridad: ${["insuficiente", "baja", "media", "alta"][level]}`,
  longer: "Cuanto más larga, más segura.",
  problem: (problem, min) =>
    ({
      empty: "Escribe una contraseña.",
      space: "La contraseña no puede empezar ni terminar con un espacio.",
      short: plural("es", min, { one: "Usa al menos # carácter.", other: "Usa al menos # caracteres." }),
      repeat: "Escribe la contraseña otra vez.",
      differ: "Las dos contraseñas no coinciden.",
    })[problem],
  match: "Las contraseñas coinciden.",
  lose: "Si la pierdes, la copia no se podrá abrir. WireCat no la guarda.",

  step: {
    starting: "Comprobando el espacio en disco",
    copying: "Copiando el almacenamiento",
    compressing: "Comprimiendo",
    encrypting: "Cifrando",
  },
  cantStop: "No se puede parar",
  cancel: "Cancelar",

  clearTitle: "¿Vaciar el almacenamiento?",
  keepStorage: "Conservar",
  backUpAndClear: "Hacer copia y vaciar",
  clearWithout: "Vaciar sin copia",
  cannotUndo: "No se puede deshacer",
  clearWarning: (undone) => (
    <>
      Esto borra todo lo que hay en el almacenamiento, para todas las herramientas y cuentas. {undone}, salvo desde una
      copia de seguridad.
    </>
  ),
  askingDeleted: "Preguntando qué se borraría",
  previewError: (error) => `No se pudo preguntar qué se borraría: ${error}`,
  whatDeleted: "Qué se borra",
  storageFiles: (size) => <>Los archivos del almacenamiento, {size}:</>,
  filesDeleted: "Archivos que se borran",
  tablesWithRows: (tables, rows, command) => (
    <>
      {plural("es", tables, { one: "# tabla", other: "# tablas" })} con{" "}
      {plural("es", rows, { one: "# fila", other: "# filas" })}, según {command}:
    </>
  ),
  tablesEmptied: "Tablas que se vacían",
  whatStays: "Qué se queda",
  stays: (folder, schema) => (
    <>
      Los ajustes, perfiles e inicios de sesión de cada herramienta, los tokens del llavero del sistema y las copias en{" "}
      {folder}. El almacenamiento vuelve a empezar vacío en el esquema {schema}, y la próxima sincronización o
      importación lo llena, incluidas las programadas.
    </>
  ),
  inUse:
    "Una sincronización, una importación, un servidor o la conexión MCP de WireCat de un agente tiene el almacenamiento abierto ahora mismo. El vaciado se rechaza hasta que termine, o hasta que cierres esas sesiones del agente.",
  backUpFirst: "Hacer copia antes",
  backUpFirstHelp:
    "Un zip en la carpeta de copias antes de borrar nada. Si la copia falla o la cancelas, no se borra nada.",
  typeToConfirm: (word) => <>Escribe {word} para confirmar</>,
  confirmWord: "vaciar",
  clearingStorage: "Vaciando el almacenamiento…",
  cannotPreview: "La herramienta instalada no puede decir qué borraría el vaciado, así que está desactivado.",
}

export const backupMessages: Messages<typeof en> = { en, ru, es }
