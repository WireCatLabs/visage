import type { Messages } from "@/i18n"

const en = {
  clear: "Clear",
  clearSearch: "Clear the search",
  suggestions: "Suggestions",
  fieldHint: "field",
  searchSyntax: "Search syntax",
}

const ru: typeof en = {
  clear: "Очистить",
  clearSearch: "Очистить поиск",
  suggestions: "Подсказки",
  fieldHint: "поле",
  searchSyntax: "Синтаксис поиска",
}

const es: typeof en = {
  clear: "Borrar",
  clearSearch: "Borrar la búsqueda",
  suggestions: "Sugerencias",
  fieldHint: "campo",
  searchSyntax: "Sintaxis de búsqueda",
}

export const queryMessages: Messages<typeof en> = { en, ru, es }
