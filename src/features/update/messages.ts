import type { Messages } from "@/i18n"

type Package = "deb" | "rpm"

const en = {
  updating: "Updating…",
  updateTo: (version: string) => `Update to ${version}`,
  downloadingLabel: "Downloading the update",
  downloaded: (done: string, total: string) => `${done} of ${total}`,
  downloading: "Downloading the update…",
  later: "Later",
  hide: "Hide",
  close: "Close",
  tryAgain: "Try again",
  install: "Install and restart",
  downloadAndInstall: "Download and install",
  available: (version: string) => `WireCat ${version} is available`,
  auto: "WireCat downloads the update, installs it and opens again. Your accounts and data will not be deleted.",
  package: {
    deb: "This copy was installed from a .deb package (Ubuntu, Debian, Linux Mint). WireCat downloads the new package and opens your system's installer, which asks for your password. Your accounts and data will not be deleted.",
    rpm: "This copy was installed from an .rpm package (Fedora). WireCat downloads the new package and opens your system's installer, which asks for your password. Your accounts and data will not be deleted.",
  } satisfies Record<Package, string>,
  other:
    "WireCat cannot tell how this copy was installed, so it cannot update it. Get the new version from the download page and install it the way you installed this one. Your accounts and data will not be deleted.",
  howUpdates: "How updates work",
  openDownloadPage: "Open the download page",
  opened: (file: string) =>
    `The system installer opened ${file}. Enter your password there to install it, then open WireCat again.`,
  revealed: (file: string) =>
    `${file} is in your Downloads folder. Double-click it to open the installer, enter your password, then open WireCat again.`,
  terminal: "Or install it from a terminal:",
  copyCommand: "Copy the command",
  whatsNew: (version: string) => `What's new in ${version}`,
  allReleases: "All releases on GitHub",
  restarting: "Installed. WireCat is restarting…",
  rejected: "The download did not match WireCat's signature, so it was not opened.",
  rejectedDetail: "Nothing was saved. Try again later, or get WireCat from the download page.",
  failedDetail: "Try again, or get WireCat from the download page.",
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
  close: "Закрыть",
  tryAgain: "Попробовать снова",
  install: "Установить и перезапустить",
  downloadAndInstall: "Скачать и установить",
  available: (version) => `Вышел WireCat ${version}`,
  auto: "WireCat скачает обновление, установит его и откроется снова. Ваши аккаунты и данные не удалятся.",
  package: {
    deb: "WireCat установлен из пакета .deb (Ubuntu, Debian, Linux Mint). Он скачает новый пакет и откроет установщик программ вашей системы — там нужно будет ввести пароль. Ваши аккаунты и данные не удалятся.",
    rpm: "WireCat установлен из пакета .rpm (Fedora). Он скачает новый пакет и откроет установщик программ вашей системы — там нужно будет ввести пароль. Ваши аккаунты и данные не удалятся.",
  },
  other:
    "WireCat не знает, как была установлена эта копия, поэтому не может её обновить. Скачайте новую версию на странице загрузки и установите её так же, как эту. Ваши аккаунты и данные не удалятся.",
  howUpdates: "Как устроены обновления",
  openDownloadPage: "Открыть страницу загрузки",
  opened: (file) =>
    `Файл ${file} открыт в установщике программ. Введите там пароль, а после установки снова откройте WireCat.`,
  revealed: (file) =>
    `${file} лежит в папке «Загрузки». Откройте его двойным щелчком, введите пароль, а после установки снова откройте WireCat.`,
  terminal: "Или установите из терминала:",
  copyCommand: "Скопировать команду",
  whatsNew: (version) => `Что нового в ${version}`,
  allReleases: "Все выпуски на GitHub",
  restarting: "Установлено. WireCat перезапускается…",
  rejected: "Скачанный файл не прошёл проверку подписи WireCat, поэтому он не открыт.",
  rejectedDetail: "Ничего не сохранено. Попробуйте позже или скачайте WireCat на странице загрузки.",
  failedDetail: "Попробуйте снова или скачайте WireCat на странице загрузки.",
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
  close: "Cerrar",
  tryAgain: "Reintentar",
  install: "Instalar y reiniciar",
  downloadAndInstall: "Descargar e instalar",
  available: (version) => `WireCat ${version} ya está disponible`,
  auto: "WireCat descarga la actualización, la instala y se vuelve a abrir. Tus cuentas y tus datos no se borran.",
  package: {
    deb: "Esta copia se instaló con un paquete .deb (Ubuntu, Debian, Linux Mint). WireCat descarga el paquete nuevo y abre el instalador de tu sistema, que te pedirá la contraseña. Tus cuentas y tus datos no se borran.",
    rpm: "Esta copia se instaló con un paquete .rpm (Fedora). WireCat descarga el paquete nuevo y abre el instalador de tu sistema, que te pedirá la contraseña. Tus cuentas y tus datos no se borran.",
  },
  other:
    "WireCat no sabe cómo se instaló esta copia, así que no puede actualizarla. Descarga la versión nueva en la página de descargas e instálala como instalaste esta. Tus cuentas y tus datos no se borran.",
  howUpdates: "Cómo funcionan las actualizaciones",
  openDownloadPage: "Abrir la página de descargas",
  opened: (file) =>
    `El instalador del sistema ha abierto ${file}. Escribe ahí tu contraseña para instalarlo y luego vuelve a abrir WireCat.`,
  revealed: (file) =>
    `${file} está en tu carpeta Descargas. Ábrelo con doble clic, escribe tu contraseña y luego vuelve a abrir WireCat.`,
  terminal: "O instálalo desde una terminal:",
  copyCommand: "Copiar el comando",
  whatsNew: (version) => `Novedades de la versión ${version}`,
  allReleases: "Todas las versiones en GitHub",
  restarting: "Instalada. WireCat se está reiniciando…",
  rejected: "La descarga no coincide con la firma de WireCat, así que no se ha abierto.",
  rejectedDetail: "No se ha guardado nada. Vuelve a intentarlo más tarde o descarga WireCat en la página de descargas.",
  failedDetail: "Vuelve a intentarlo o descarga WireCat en la página de descargas.",
  failed: "No se ha podido instalar la actualización.",
}

export const updateMessages: Messages<typeof en> = { en, ru, es }
