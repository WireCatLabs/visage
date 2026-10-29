import type { ReactNode } from "react"
import type { Messages } from "@/i18n"

type Os = "linux" | "macos" | "windows"

const en = {
  yourComputer: "Your computer",
  checking: "Checking this computer",
  missing: (program: string) => `${program} missing`,
  nodeSettings: (version: string, managed: boolean) =>
    managed ? `Node.js ${version}, set up by WireCat: settings` : `Node.js ${version}: settings`,
  nodeDialog: "WireCat's Node.js",
  close: "Close",

  managedActive: (version: ReactNode, dir: ReactNode): ReactNode => (
    <>
      Node.js {version} in {dir}, used for WireCat tools.
    </>
  ),
  managedIdle: (version: ReactNode, dir: ReactNode): ReactNode => (
    <>
      Node.js {version} in {dir}. Your own Node.js is used first.
    </>
  ),
  userPath: "your user PATH",
  startupFile: "your shell's startup file",
  readingPath: "Reading your PATH settings…",
  onPath: (where: ReactNode): ReactNode => <>On PATH through {where}. Terminals opened from now on find it.</>,
  removeFromPath: "Remove from PATH",
  addFolder: (where: ReactNode): ReactNode => (
    <>
      “Add to PATH” puts this folder in front of {where}, marked as added by WireCat Desktop, so you can remove it here
      later:
    </>
  ),
  addLine: (where: ReactNode): ReactNode => (
    <>
      “Add to PATH” puts this line at the end of {where}, marked as added by WireCat Desktop, so you can remove it here
      later:
    </>
  ),
  shellNotEdited: (shell: string) =>
    `Your shell (${shell}) is not one WireCat edits. Add this line to its startup file yourself:`,
  copyLine: "Copy the line",
  addToPath: "Add to PATH",
  removeWarning: "This deletes the folder above and its PATH line. Tools installed with it must be uninstalled first.",
  keepIt: "Keep it",
  remove: "Remove",
  removeNode: "Remove WireCat's Node.js",

  nodeForTools: "Node.js for WireCat tools",
  managedTitle: (version: string) => `WireCat set up Node.js ${version} for its tools`,
  managedBody: "Tools install and run with it here. Add it to PATH so they also work in a terminal.",
  adminTitle: "npm needs administrator rights to install tools",
  missingTitle: "Node.js is needed to install WireCat tools",
  oldTitle: (version: string) => `Node.js ${version} is too old for WireCat tools`,
  adminBody: (prefix: string) =>
    `npm installs into ${prefix}, a system folder. WireCat can set up its own Node.js in your user folder instead; your current one stays as it is.`,
  needBody: (requirement: string) =>
    `WireCat Desktop runs without it, but its tools need ${requirement}. WireCat can set it up in your user folder, without administrator rights.`,
  setUp: "Set up Node.js for me",
  installMyself: "I'll install it myself",
  offer: (release: ReactNode, site: string): ReactNode => (
    <>
      {release} from {site}, checked against its published checksums.
    </>
  ),
  offerUnknown: (site: string) => `The latest LTS from ${site}, checked against its published checksums.`,
  asking: (site: string) => `Asking ${site} for the latest LTS…`,
  steps: { check: "Check", download: "Download", verify: "Verify", unpack: "Unpack" },
  downloading: "Downloading Node.js",
  ofTotal: (received: string, total: string) => `${received} of ${total}`,
  verifying: (site: string) => `Comparing the download with the checksum ${site} publishes…`,
  unpackInto: (dir: string) => `Unpacking into ${dir}…`,
  unpackHome: "Unpacking into your user folder…",
  cancel: "Cancel",
  tryAgain: "Try again",
  adminManual: (bin: ReactNode): ReactNode => (
    <>Point npm at a folder in your home, then add that folder's {bin} to your PATH and check again.</>
  ),
  copyCommand: "Copy the command",
  install: {
    linux: (requirement: string) =>
      `Install ${requirement}. Use nvm or fnm, or your distribution's NodeSource package; the version in the default repositories is often too old. Then check again.`,
    macos: (requirement: string) =>
      `Install ${requirement}. Use the macOS installer from nodejs.org, Homebrew (brew install node), or nvm. Then check again.`,
    windows: (requirement: string) =>
      `Install ${requirement}. Use the Windows installer from nodejs.org, or winget install OpenJS.NodeJS.LTS. Then check again.`,
  } satisfies Record<Os, unknown>,
}

const ru: typeof en = {
  yourComputer: "Ваш компьютер",
  checking: "Проверяем этот компьютер",
  missing: (program) => `${program} не найден`,
  nodeSettings: (version, managed) =>
    managed ? `Node.js ${version}, установлен WireCat: настройки` : `Node.js ${version}: настройки`,
  nodeDialog: "Node.js от WireCat",
  close: "Закрыть",

  managedActive: (version, dir) => (
    <>
      Node.js {version} в {dir}, используется для инструментов WireCat.
    </>
  ),
  managedIdle: (version, dir) => (
    <>
      Node.js {version} в {dir}. Сначала используется ваш собственный Node.js.
    </>
  ),
  userPath: "PATH вашего пользователя",
  startupFile: "файл запуска вашей оболочки",
  readingPath: "Читаем настройки PATH…",
  onPath: (where) => <>Добавлен в PATH через {where}. Терминалы, открытые с этого момента, его найдут.</>,
  removeFromPath: "Убрать из PATH",
  addFolder: (where) => (
    <>
      «Добавить в PATH» поставит эту папку в начало {where} с пометкой, что её добавил WireCat Desktop, чтобы потом её
      можно было убрать здесь:
    </>
  ),
  addLine: (where) => (
    <>
      «Добавить в PATH» допишет эту строку в самый конец, в {where}, с пометкой, что её добавил WireCat Desktop, чтобы
      потом её можно было убрать здесь:
    </>
  ),
  shellNotEdited: (shell) =>
    `WireCat не редактирует настройки вашей оболочки (${shell}). Добавьте эту строку в её файл запуска сами:`,
  copyLine: "Скопировать строку",
  addToPath: "Добавить в PATH",
  removeWarning:
    "Папка выше и её строка в PATH будут удалены. Инструменты, установленные с этим Node.js, сначала нужно удалить.",
  keepIt: "Оставить",
  remove: "Удалить",
  removeNode: "Удалить Node.js от WireCat",

  nodeForTools: "Node.js для инструментов WireCat",
  managedTitle: (version) => `WireCat установил Node.js ${version} для своих инструментов`,
  managedBody:
    "Здесь инструменты устанавливаются и работают с ним. Добавьте его в PATH, чтобы они работали и в терминале.",
  adminTitle: "npm нужны права администратора, чтобы устанавливать инструменты",
  missingTitle: "Для установки инструментов WireCat нужен Node.js",
  oldTitle: (version) => `Node.js ${version} слишком старый для инструментов WireCat`,
  adminBody: (prefix) =>
    `npm устанавливает в ${prefix}, а это системная папка. Вместо этого WireCat может установить собственный Node.js в вашу папку пользователя; текущий останется как есть.`,
  needBody: (requirement) =>
    `WireCat Desktop работает и без него, но его инструментам нужен ${requirement}. WireCat может установить его в вашу папку пользователя без прав администратора.`,
  setUp: "Установить Node.js за меня",
  installMyself: "Установлю самостоятельно",
  offer: (release, site) => (
    <>
      {release} с {site}, сверяется с опубликованными контрольными суммами.
    </>
  ),
  offerUnknown: (site) => `Последняя LTS-версия с ${site}, сверяется с опубликованными контрольными суммами.`,
  asking: (site) => `Узнаём у ${site} последнюю LTS-версию…`,
  steps: { check: "Проверка", download: "Загрузка", verify: "Сверка", unpack: "Распаковка" },
  downloading: "Загрузка Node.js",
  ofTotal: (received, total) => `${received} из ${total}`,
  verifying: (site) => `Сверяем загрузку с контрольной суммой, которую публикует ${site}…`,
  unpackInto: (dir) => `Распаковываем в ${dir}…`,
  unpackHome: "Распаковываем в вашу папку пользователя…",
  cancel: "Отмена",
  tryAgain: "Повторить",
  adminManual: (bin) => (
    <>Укажите npm папку в вашем домашнем каталоге, затем добавьте её {bin} в PATH и проверьте снова.</>
  ),
  copyCommand: "Скопировать команду",
  install: {
    linux: (requirement) =>
      `Установите ${requirement}. Используйте nvm или fnm либо пакет NodeSource для вашего дистрибутива: версия в стандартных репозиториях часто слишком старая. Затем проверьте снова.`,
    macos: (requirement) =>
      `Установите ${requirement}. Используйте установщик для macOS с nodejs.org, Homebrew (brew install node) или nvm. Затем проверьте снова.`,
    windows: (requirement) =>
      `Установите ${requirement}. Используйте установщик для Windows с nodejs.org или winget install OpenJS.NodeJS.LTS. Затем проверьте снова.`,
  },
}

const es: typeof en = {
  yourComputer: "Tu ordenador",
  checking: "Comprobando este ordenador",
  missing: (program) => `${program} no encontrado`,
  nodeSettings: (version, managed) =>
    managed ? `Node.js ${version}, instalado por WireCat: ajustes` : `Node.js ${version}: ajustes`,
  nodeDialog: "Node.js de WireCat",
  close: "Cerrar",

  managedActive: (version, dir) => (
    <>
      Node.js {version} en {dir}, usado para las herramientas de WireCat.
    </>
  ),
  managedIdle: (version, dir) => (
    <>
      Node.js {version} en {dir}. Primero se usa tu propio Node.js.
    </>
  ),
  userPath: "el PATH de tu usuario",
  startupFile: "el archivo de inicio de tu shell",
  readingPath: "Leyendo tus ajustes de PATH…",
  onPath: (where) => <>En el PATH mediante {where}. Los terminales que abras a partir de ahora lo encuentran.</>,
  removeFromPath: "Quitar del PATH",
  addFolder: (where) => (
    <>
      «Añadir al PATH» pone esta carpeta en primer lugar en {where}, marcada como añadida por WireCat Desktop, para que
      puedas quitarla aquí más adelante:
    </>
  ),
  addLine: (where) => (
    <>
      «Añadir al PATH» añade esta línea al final, en {where}, marcada como añadida por WireCat Desktop, para que puedas
      quitarla aquí más adelante:
    </>
  ),
  shellNotEdited: (shell) => `WireCat no edita tu shell (${shell}). Añade tú esta línea a su archivo de inicio:`,
  copyLine: "Copiar la línea",
  addToPath: "Añadir al PATH",
  removeWarning:
    "Esto borra la carpeta de arriba y su línea del PATH. Antes hay que desinstalar las herramientas instaladas con ella.",
  keepIt: "Conservar",
  remove: "Quitar",
  removeNode: "Quitar el Node.js de WireCat",

  nodeForTools: "Node.js para las herramientas de WireCat",
  managedTitle: (version) => `WireCat ha instalado Node.js ${version} para sus herramientas`,
  managedBody:
    "Aquí las herramientas se instalan y funcionan con él. Añádelo al PATH para que también funcionen en un terminal.",
  adminTitle: "npm necesita permisos de administrador para instalar herramientas",
  missingTitle: "Se necesita Node.js para instalar las herramientas de WireCat",
  oldTitle: (version) => `Node.js ${version} es demasiado antiguo para las herramientas de WireCat`,
  adminBody: (prefix) =>
    `npm instala en ${prefix}, una carpeta del sistema. En su lugar, WireCat puede instalar su propio Node.js en tu carpeta de usuario; el que tienes ahora se queda como está.`,
  needBody: (requirement) =>
    `WireCat Desktop funciona sin él, pero sus herramientas necesitan ${requirement}. WireCat puede instalarlo en tu carpeta de usuario, sin permisos de administrador.`,
  setUp: "Instalar Node.js por mí",
  installMyself: "Lo instalo yo",
  offer: (release, site) => (
    <>
      {release} desde {site}, comprobado con sus sumas de verificación publicadas.
    </>
  ),
  offerUnknown: (site) => `La última LTS desde ${site}, comprobada con sus sumas de verificación publicadas.`,
  asking: (site) => `Preguntando a ${site} por la última LTS…`,
  steps: { check: "Comprobar", download: "Descargar", verify: "Verificar", unpack: "Descomprimir" },
  downloading: "Descargando Node.js",
  ofTotal: (received, total) => `${received} de ${total}`,
  verifying: (site) => `Comparando la descarga con la suma de verificación que publica ${site}…`,
  unpackInto: (dir) => `Descomprimiendo en ${dir}…`,
  unpackHome: "Descomprimiendo en tu carpeta de usuario…",
  cancel: "Cancelar",
  tryAgain: "Reintentar",
  adminManual: (bin) => (
    <>Indica a npm una carpeta dentro de tu carpeta personal, añade su {bin} a tu PATH y vuelve a comprobar.</>
  ),
  copyCommand: "Copiar el comando",
  install: {
    linux: (requirement) =>
      `Instala ${requirement}. Usa nvm o fnm, o el paquete NodeSource de tu distribución; la versión de los repositorios por defecto suele ser demasiado antigua. Luego vuelve a comprobar.`,
    macos: (requirement) =>
      `Instala ${requirement}. Usa el instalador de macOS de nodejs.org, Homebrew (brew install node) o nvm. Luego vuelve a comprobar.`,
    windows: (requirement) =>
      `Instala ${requirement}. Usa el instalador de Windows de nodejs.org o winget install OpenJS.NodeJS.LTS. Luego vuelve a comprobar.`,
  },
}

export const systemMessages: Messages<typeof en> = { en, ru, es }
