import type { Messages } from "@/i18n"

const en = {
  closeTour: "Close the tour",
  stepOf: (index: number, count: number) => `${index} of ${count}`,
  back: "Back",
  next: "Next",
  done: "Done",
  copied: "Copied",
  copiedAnnounce: "Copied to the clipboard",
  choose: "Choose…",
  stepDone: ", done",
  stepActive: ", in progress",
  stepFailed: ", failed",
}

const ru: typeof en = {
  closeTour: "Закрыть подсказки",
  stepOf: (index, count) => `${index} из ${count}`,
  back: "Назад",
  next: "Далее",
  done: "Готово",
  copied: "Скопировано",
  copiedAnnounce: "Скопировано в буфер обмена",
  choose: "Выберите…",
  stepDone: ", готово",
  stepActive: ", идёт",
  stepFailed: ", не удалось",
}

const es: typeof en = {
  closeTour: "Cerrar la guía",
  stepOf: (index, count) => `${index} de ${count}`,
  back: "Atrás",
  next: "Siguiente",
  done: "Listo",
  copied: "Copiado",
  copiedAnnounce: "Copiado al portapapeles",
  choose: "Elige…",
  stepDone: ", hecho",
  stepActive: ", en curso",
  stepFailed: ", ha fallado",
}

export const uiMessages: Messages<typeof en> = { en, ru, es }
