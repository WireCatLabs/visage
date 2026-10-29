import type { Messages } from "@/i18n"

const en = {
  updating: "Updating…",
  updateTo: (version: string) => `Update to ${version}`,
  downloadingLabel: "Downloading the update",
  downloaded: (done: string, total: string) => `${done} of ${total}`,
  downloading: "Downloading the update…",
  later: "Later",
  hide: "Hide",
  downloadFromGitHub: "Download from GitHub",
  tryAgain: "Try again",
  install: "Install and restart",
  available: (version: string) => `WireCat ${version} is available`,
  manual:
    "This copy was installed from a Linux package, so it cannot update itself. Download the new package from GitHub and install it the same way.",
  auto: "WireCat downloads the update, installs it and opens again. Your tools, profiles and data stay as they are.",
  restarting: "Installed. WireCat is restarting…",
  failedDetail: "Try again, or download the installer from GitHub.",
  openGitHub: "Open GitHub",
  failed: "The update could not be installed.",
}

const ru: typeof en = {
  updating: "Обновление…",
  updateTo: (version) => `Обновить до ${version}`,
  downloadingLabel: "Загрузка обновления",
  downloaded: (done, total) => `${done} из ${total}`,
  downloading: "Загружается обновление…",
  later: "Позже",
  hide: "Скрыть",
  downloadFromGitHub: "Скачать с GitHub",
  tryAgain: "Попробовать снова",
  install: "Установить и перезапустить",
  available: (version) => `Вышел WireCat ${version}`,
  manual:
    "Эта копия установлена из пакета Linux, поэтому обновиться сама не может. Скачайте новый пакет с GitHub и установите его так же, как первый.",
  auto: "WireCat скачает обновление, установит его и откроется снова. Инструменты, профили и данные останутся как есть.",
  restarting: "Установлено. WireCat перезапускается…",
  failedDetail: "Попробуйте снова или скачайте установщик с GitHub.",
  openGitHub: "Открыть GitHub",
  failed: "Не удалось установить обновление.",
}

const es: typeof en = {
  updating: "Actualizando…",
  updateTo: (version) => `Actualizar a ${version}`,
  downloadingLabel: "Descargando la actualización",
  downloaded: (done, total) => `${done} de ${total}`,
  downloading: "Descargando la actualización…",
  later: "Más tarde",
  hide: "Ocultar",
  downloadFromGitHub: "Descargar de GitHub",
  tryAgain: "Reintentar",
  install: "Instalar y reiniciar",
  available: (version) => `WireCat ${version} ya está disponible`,
  manual:
    "Esta copia se instaló desde un paquete de Linux, así que no puede actualizarse sola. Descarga el nuevo paquete de GitHub e instálalo del mismo modo.",
  auto: "WireCat descarga la actualización, la instala y se vuelve a abrir. Tus herramientas, perfiles y datos se quedan como están.",
  restarting: "Instalada. WireCat se está reiniciando…",
  failedDetail: "Vuelve a intentarlo o descarga el instalador de GitHub.",
  openGitHub: "Abrir GitHub",
  failed: "No se ha podido instalar la actualización.",
}

export const updateMessages: Messages<typeof en> = { en, ru, es }
