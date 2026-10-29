import type { ReactNode } from "react"
import type { Messages } from "@/i18n"

const en = {
  title: "About WireCat",
  summary:
    "Gives your AI agents access to your messengers, mail and drive through command-line tools that run on this computer. Your data stays here.",
  version: "Version",
  build: "Build",
  system: "System",
  links: "WireCat links",
  website: "Website",
  docs: "Documentation",
  source: "Source code",
  privacy: "Privacy policy",
  report: "Report a problem",
  madeBy: (author: string, year: number) => `Made by ${author} · © ${year}`,
  license: (link: ReactNode): ReactNode => <>Free and open source under the {link}</>,
  copied: "Copied",
  copy: "Copy version details",
  copyTitle: (text: string) => `Copy “${text}” for a bug report`,
  copiedAnnounce: "Copied to the clipboard",
  close: "Close",
}

const ru: typeof en = {
  title: "О WireCat",
  summary:
    "Даёт вашим ИИ-агентам доступ к мессенджерам, почте и диску через инструменты командной строки, которые работают на этом компьютере. Ваши данные остаются здесь.",
  version: "Версия",
  build: "Сборка",
  system: "Система",
  links: "Ссылки WireCat",
  website: "Сайт",
  docs: "Документация",
  source: "Исходный код",
  privacy: "Политика конфиденциальности",
  report: "Сообщить о проблеме",
  madeBy: (author, year) => `Автор: ${author} · © ${year}`,
  license: (link) => <>Свободное ПО с открытым исходным кодом по лицензии {link}</>,
  copied: "Скопировано",
  copy: "Скопировать сведения о версии",
  copyTitle: (text) => `Скопировать «${text}» для отчёта об ошибке`,
  copiedAnnounce: "Скопировано в буфер обмена",
  close: "Закрыть",
}

const es: typeof en = {
  title: "Acerca de WireCat",
  summary:
    "Da a tus agentes de IA acceso a tus mensajerías, tu correo y tu almacenamiento en la nube mediante herramientas de línea de comandos que se ejecutan en este ordenador. Tus datos se quedan aquí.",
  version: "Versión",
  build: "Compilación",
  system: "Sistema",
  links: "Enlaces de WireCat",
  website: "Sitio web",
  docs: "Documentación",
  source: "Código fuente",
  privacy: "Política de privacidad",
  report: "Informar de un problema",
  madeBy: (author, year) => `Hecho por ${author} · © ${year}`,
  license: (link) => <>Libre y de código abierto bajo la {link}</>,
  copied: "Copiado",
  copy: "Copiar los datos de la versión",
  copyTitle: (text) => `Copiar «${text}» para un informe de error`,
  copiedAnnounce: "Copiado al portapapeles",
  close: "Cerrar",
}

export const aboutMessages: Messages<typeof en> = { en, ru, es }
