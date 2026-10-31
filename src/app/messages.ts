import type { Messages } from "@/i18n"

const en = {
  nav: {
    tools: "Tools",
    agents: "Agents",
    search: "Search",
    memory: "Memory",
    storage: "Storage",
    logs: "Logs",
    settings: "Settings",
  } as Record<string, string>,
  soon: "Soon",
  sectionsNav: "Sections",
  systemNav: "Data and settings",
  finishSetup: "Finish setup",
  theme: "Theme",
  themeLight: "Light theme",
  themeSystem: "Match the system",
  themeDark: "Dark theme",
  minimise: "Minimise",
  maximise: "Maximise",
  close: "Close",
  reportProblem: "Report a problem",
  reportProblemTitle: "Tell the WireCat team what went wrong",
  pageBroke: "Something broke on this page",
  appBroke: "Something broke in WireCat",
  pageBrokeText:
    "This page hit an error it could not recover from. The rest of WireCat still works. Reload to try again.",
  appBrokeText: "The window hit an error it could not recover from. Reload to try again.",
  reload: "Reload",
}

const ru: typeof en = {
  nav: {
    tools: "Инструменты",
    agents: "Агенты",
    search: "Поиск",
    memory: "Память",
    storage: "Хранилище",
    logs: "Журнал",
    settings: "Настройки",
  },
  soon: "Скоро",
  sectionsNav: "Разделы",
  systemNav: "Данные и настройки",
  finishSetup: "Завершить настройку",
  theme: "Тема",
  themeLight: "Светлая тема",
  themeSystem: "Как в системе",
  themeDark: "Тёмная тема",
  minimise: "Свернуть",
  maximise: "Развернуть",
  close: "Закрыть",
  reportProblem: "Сообщить о проблеме",
  reportProblemTitle: "Расскажите команде WireCat, что пошло не так",
  pageBroke: "На этой странице что-то сломалось",
  appBroke: "В WireCat что-то сломалось",
  pageBrokeText:
    "На странице произошла ошибка, после которой она не может продолжить работу. Остальной WireCat работает. Перезагрузите, чтобы попробовать снова.",
  appBrokeText:
    "В окне произошла ошибка, после которой оно не может продолжить работу. Перезагрузите, чтобы попробовать снова.",
  reload: "Перезагрузить",
}

const es: typeof en = {
  nav: {
    tools: "Herramientas",
    agents: "Agentes",
    search: "Buscar",
    memory: "Memoria",
    storage: "Almacenamiento",
    logs: "Registros",
    settings: "Ajustes",
  },
  soon: "Pronto",
  sectionsNav: "Secciones",
  systemNav: "Datos y ajustes",
  finishSetup: "Terminar la configuración",
  theme: "Tema",
  themeLight: "Tema claro",
  themeSystem: "Igual que el sistema",
  themeDark: "Tema oscuro",
  minimise: "Minimizar",
  maximise: "Maximizar",
  close: "Cerrar",
  reportProblem: "Informar de un problema",
  reportProblemTitle: "Cuéntale al equipo de WireCat qué ha fallado",
  pageBroke: "Algo ha fallado en esta página",
  appBroke: "Algo ha fallado en WireCat",
  pageBrokeText:
    "Esta página ha tenido un error del que no se puede recuperar. El resto de WireCat sigue funcionando. Recarga para volver a intentarlo.",
  appBrokeText: "La ventana ha tenido un error del que no se puede recuperar. Recarga para volver a intentarlo.",
  reload: "Recargar",
}

export const appMessages: Messages<typeof en> = { en, ru, es }
