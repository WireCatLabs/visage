import type { ReactNode } from "react"
import type { Messages } from "@/i18n"

const en = {
  title: "Settings",
  intro: "How WireCat looks on this computer, and the settings of each tool.",
  app: "WireCat",
  size: "Interface size",
  sizeHelp: (mod: string) =>
    `Text and everything around it. ${mod} + and ${mod} − change it anywhere in the app, ${mod} 0 resets it.`,
  reset: "Reset to default",
  language: "Language",
  languageHelp: "Tool names, commands and what the tools print stay as they are.",
  system: (name: string) => `System (${name})`,
  tools: "Tools",
  toolsIntro: (command: ReactNode): ReactNode => (
    <>
      Read from the tools and saved through their own {command}, so every value is checked by the tool before it is
      written.
    </>
  ),
  tool: "Tool",
}

const ru: typeof en = {
  title: "Настройки",
  intro: "Как WireCat выглядит на этом компьютере и настройки каждого инструмента.",
  app: "WireCat",
  size: "Размер интерфейса",
  sizeHelp: (mod) => `Текст и всё вокруг него. ${mod} + и ${mod} − меняют размер в любом месте, ${mod} 0 сбрасывает.`,
  reset: "Сбросить",
  language: "Язык",
  languageHelp: "Названия инструментов, команды и то, что выводят сами инструменты, не переводятся.",
  system: (name) => `Как в системе (${name})`,
  tools: "Инструменты",
  toolsIntro: (command) => (
    <>
      Читаются из инструментов и сохраняются их собственной командой {command}, поэтому инструмент проверяет каждое
      значение перед записью.
    </>
  ),
  tool: "Инструмент",
}

const es: typeof en = {
  title: "Ajustes",
  intro: "Cómo se ve WireCat en este ordenador y los ajustes de cada herramienta.",
  app: "WireCat",
  size: "Tamaño de la interfaz",
  sizeHelp: (mod) =>
    `El texto y todo lo que lo rodea. ${mod} + y ${mod} − lo cambian en cualquier parte, ${mod} 0 lo restablece.`,
  reset: "Restablecer",
  language: "Idioma",
  languageHelp: "Los nombres de las herramientas, los comandos y lo que imprimen las herramientas no se traducen.",
  system: (name) => `Sistema (${name})`,
  tools: "Herramientas",
  toolsIntro: (command) => (
    <>
      Se leen de las herramientas y se guardan con su propio {command}, así que la herramienta comprueba cada valor
      antes de escribirlo.
    </>
  ),
  tool: "Herramienta",
}

export const settingsMessages: Messages<typeof en> = { en, ru, es }
