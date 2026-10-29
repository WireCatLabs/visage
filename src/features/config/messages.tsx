import type { ReactNode } from "react"
import type { Messages } from "@/i18n"

const en = {
  shared: "WireCat (shared)",
  sharedNeedsTool: "Install Telegram, MAX or WhatsApp to change shared settings",
  notInstalled: (name: string) => `${name} is not installed`,
  profile: "Profile",
  readingProfiles: "Reading profiles",
  defaults: "Defaults (all profiles)",
  noProfiles: (tool: string) =>
    `There are no ${tool} profiles yet. Set one up in Tools, under ${tool}, then come back here.`,
  profilesFailed: (tool: string) => `Set up a profile in Tools, under ${tool}, then come back here.`,
  noProfilesHint: (tool: string) => `No ${tool} profiles yet: set one up in Tools to change a profile's own settings.`,
  chooseProfile: "Choose a profile to see its settings.",
  sharedScope:
    "Settings every WireCat tool reads, not tied to one tool or profile: a change here applies to all of them.",
  readThrough: (bin: ReactNode): ReactNode => <>Read through {bin}.</>,
  oneFile: (tool: string) => `${tool} keeps one settings file for every profile.`,
  onlyProfile: (tool: string, profile: ReactNode): ReactNode => (
    <>
      Only {tool} profile {profile}. Settings shared by every tool are under WireCat (shared).
    </>
  ),
  defaultsScope: (tool: string) =>
    `What every ${tool} profile gets unless it sets its own. Settings shared by every tool are under WireCat (shared).`,
  fromProfile: (profile: string | null) =>
    `Some values here come from a profile${profile ? ` (${profile})` : ""}, not from the defaults, so they are read-only in this view.`,
  panel: {
    shared: "Shared WireCat settings for every tool and profile",
    defaults: (tool: string) => `${tool} settings for the defaults every profile gets`,
    profile: (tool: string, profile: string) => `${tool} settings for profile ${profile}`,
    all: (tool: string) => `${tool} settings for every profile`,
  },
  tabs: "View",
  tabSettings: "Settings",
  tabJson: "JSON",
  unsaved: "unsaved",
  search: "Search settings",
  reading: "Reading settings",
  jsonDirty: "The JSON tab has unsaved changes. Save or revert them there before changing settings here.",
  file: (path: ReactNode): ReactNode => <>File: {path}</>,
  otherShared: "Other shared settings",
  discard: {
    title: "Discard unsaved JSON changes?",
    keep: "Keep editing",
    confirm: "Discard changes",
    body: "The JSON tab has changes that are not saved. Switching drops them; nothing is written to the file.",
  },
  list: {
    origin: {
      default: "default",
      defaults: "defaults",
      profile: "profile",
      environment: "environment",
      store: "shared store",
      computed: "several sources",
      file: "settings file",
      other: "other",
    },
    modifiedTitle: "Set in a file, not the built-in default",
    modified: "Changed from the default",
    masked: "Hidden because it may hold a secret or a personal path. Change it in a terminal.",
    saving: "Saving…",
    reset: "Reset",
    resetLabel: (key: string) => `Reset ${key}`,
    resetTitle: "Remove it from this layer, so the inherited or built-in value applies",
    notSet: "not set",
    add: "add",
    addToList: "Add to the list",
    remove: (item: string) => `Remove ${item}`,
    noMatch: "No setting matches.",
  },
  editor: {
    format: "Format",
    revert: "Revert",
    save: "Save",
    saving: "Saving…",
    label: "Settings as JSON",
    line: (n: number) => `Line ${n}`,
    note: (set: ReactNode, unset: ReactNode): ReactNode => (
      <>
        Saving runs one {set} or {unset} per changed setting and stops at the first one the tool refuses. Masked values
        (•••) and locked settings cannot be changed here.
      </>
    ),
    progress: "Save progress",
    steps: { waiting: "Waiting", running: "Saving", done: "Saved", failed: "Refused", skipped: "Not tried" },
  },
  categories: {
    heading: "Task categories",
    help: (other: ReactNode): ReactNode => (
      <>
        A new task takes the category whose trigger words its message matches best; with no match it goes to {other}.
        Order breaks ties.
      </>
    ),
    add: "Add category",
    removed: (name: ReactNode): ReactNode => <>Removed {name}. Tasks that have it keep it.</>,
    undo: "Undo",
    noMatch: "No category matches.",
    none: "The tool reported no categories.",
    noMeaning: "no meaning",
    hidden: "Hidden because it may hold personal data. Change it in a terminal.",
    edit: (name: string) => `Edit ${name}`,
    remove: (name: string) => `Remove ${name}`,
    fallbackTitle: (name: string) => `${name} stays: tasks that match no category go there`,
    fallbackLocked: (name: string) => `${name} cannot be removed`,
    newCategory: "New category",
    name: "Name",
    namePlaceholder: "pets",
    meaning: "What it is for",
    meaningPlaceholder: "flights, hotels, visas",
    words: "Trigger words",
    wordsPlaceholder: "flight, hotel, билет, es:vuelo",
    wordsHelp: (tag: ReactNode): ReactNode => (
      <>Comma-separated. Cyrillic words count as Russian; mark Spanish ones with {tag}.</>
    ),
    save: "Save",
    create: "Add",
    cancel: "Cancel",
  },
  reasons: {
    noTool: "Choose a tool and a profile first.",
    noShared: "None of the installed tools reports shared settings. Update Telegram, MAX or WhatsApp in Tools.",
    hidden: "This value is hidden because it may hold a secret, so it cannot be edited here.",
    notName: "Not a setting name.",
    cannotUnset: "This tool cannot remove a setting. Give it a value instead.",
    readOnly: "This setting is read-only here, so it cannot be removed.",
    valueShape: "Give a word, a number, true or false, or a list.",
    notJson: (near: string) => `Not valid JSON from ${near}. Is a comma or a quote missing?`,
    jsonEnd: "Not valid JSON: something is missing at the end.",
    notObject: 'The settings are one JSON object: { "name": value, … }',
    categoriesShape: 'Categories are one object: { "name": "meaning | words" }',
    categoryName: "A category name is one lower-case word: letters, digits and -.",
    categoryText: 'A category is one text: "meaning | trigger words".',
    categoryHidden: "This category is hidden here; change it in a terminal.",
    fallback: "other stays: tasks that match no category go there.",
    categoriesUnread: "The tool could not read the categories, so they cannot be changed.",
    keepSection: "Keep task_categories; remove categories inside it one by one.",
    meaningMissing: "Say what the category is for.",
    meaningPipe: 'The meaning cannot contain "|".',
    noName: "Give the category a name.",
    exists: (name: string) => `${name} already exists; edit it instead.`,
  },
}

export type ConfigText = typeof en

const ru: ConfigText = {
  shared: "WireCat (общие)",
  sharedNeedsTool: "Установите Telegram, MAX или WhatsApp, чтобы менять общие настройки",
  notInstalled: (name) => `${name} не установлен`,
  profile: "Профиль",
  readingProfiles: "Читаем профили",
  defaults: "По умолчанию (все профили)",
  noProfiles: (tool) =>
    `Профилей ${tool} пока нет. Создайте профиль в «Инструментах», в разделе ${tool}, и вернитесь сюда.`,
  profilesFailed: (tool) => `Создайте профиль в «Инструментах», в разделе ${tool}, и вернитесь сюда.`,
  noProfilesHint: (tool) =>
    `Профилей ${tool} пока нет: создайте профиль в «Инструментах», чтобы менять его собственные настройки.`,
  chooseProfile: "Выберите профиль, чтобы увидеть его настройки.",
  sharedScope:
    "Настройки, которые читает каждый инструмент WireCat. Они не привязаны к инструменту или профилю: изменение здесь касается всех.",
  readThrough: (bin) => <>Читаются через {bin}.</>,
  oneFile: (tool) => `У ${tool} один файл настроек для всех профилей.`,
  onlyProfile: (tool, profile) => (
    <>
      Только профиль {profile} в {tool}. Настройки, общие для всех инструментов, — в WireCat (общие).
    </>
  ),
  defaultsScope: (tool) =>
    `То, что получает каждый профиль ${tool}, если не задаёт своё. Настройки, общие для всех инструментов, — в WireCat (общие).`,
  fromProfile: (profile) =>
    `Часть значений здесь взята из профиля${profile ? ` ${profile}` : ""}, а не из настроек по умолчанию, поэтому в этом виде их не изменить.`,
  panel: {
    shared: "Общие настройки WireCat для всех инструментов и профилей",
    defaults: (tool) => `Настройки ${tool} по умолчанию для всех профилей`,
    profile: (tool, profile) => `Настройки ${tool} для профиля ${profile}`,
    all: (tool) => `Настройки ${tool} для всех профилей`,
  },
  tabs: "Вид",
  tabSettings: "Настройки",
  tabJson: "JSON",
  unsaved: "не сохранено",
  search: "Поиск настроек",
  reading: "Читаем настройки",
  jsonDirty:
    "Во вкладке JSON есть несохранённые изменения. Сохраните или отмените их там, прежде чем менять настройки здесь.",
  file: (path) => <>Файл: {path}</>,
  otherShared: "Другие общие настройки",
  discard: {
    title: "Отменить несохранённые изменения JSON?",
    keep: "Продолжить правку",
    confirm: "Отменить изменения",
    body: "Во вкладке JSON есть несохранённые изменения. При переключении они пропадут; в файл ничего не записывается.",
  },
  list: {
    origin: {
      default: "встроенное",
      defaults: "по умолчанию",
      profile: "профиль",
      environment: "окружение",
      store: "общее хранилище",
      computed: "несколько источников",
      file: "файл настроек",
      other: "другое",
    },
    modifiedTitle: "Задано в файле, а не встроенное значение",
    modified: "Изменено относительно встроенного значения",
    masked: "Скрыто, потому что может содержать секрет или личный путь. Меняйте в терминале.",
    saving: "Сохраняем…",
    reset: "Сбросить",
    resetLabel: (key) => `Сбросить ${key}`,
    resetTitle: "Убрать значение из этого слоя, чтобы действовало унаследованное или встроенное",
    notSet: "не задано",
    add: "добавить",
    addToList: "Добавить в список",
    remove: (item) => `Удалить ${item}`,
    noMatch: "Ни одна настройка не подходит.",
  },
  editor: {
    format: "Форматировать",
    revert: "Отменить",
    save: "Сохранить",
    saving: "Сохраняем…",
    label: "Настройки в JSON",
    line: (n) => `Строка ${n}`,
    note: (set, unset) => (
      <>
        При сохранении для каждой изменённой настройки выполняется {set} или {unset}; сохранение останавливается на
        первой, которую инструмент отклонит. Скрытые значения (•••) и заблокированные настройки здесь не изменить.
      </>
    ),
    progress: "Ход сохранения",
    steps: {
      waiting: "Ждёт",
      running: "Сохраняется",
      done: "Сохранено",
      failed: "Отклонено",
      skipped: "Не выполнялось",
    },
  },
  categories: {
    heading: "Категории задач",
    help: (other) => (
      <>
        Новая задача получает категорию, чьи ключевые слова лучше всего совпадают с её сообщением; без совпадений она
        попадает в {other}. При равенстве решает порядок.
      </>
    ),
    add: "Добавить категорию",
    removed: (name) => <>Категория {name} удалена. У задач, где она уже стоит, она останется.</>,
    undo: "Вернуть",
    noMatch: "Ни одна категория не подходит.",
    none: "Инструмент не сообщил ни одной категории.",
    noMeaning: "без описания",
    hidden: "Скрыто, потому что может содержать личные данные. Меняйте в терминале.",
    edit: (name) => `Изменить ${name}`,
    remove: (name) => `Удалить ${name}`,
    fallbackTitle: (name) => `${name} остаётся: сюда попадают задачи без подходящей категории`,
    fallbackLocked: (name) => `${name} нельзя удалить`,
    newCategory: "Новая категория",
    name: "Название",
    namePlaceholder: "pets",
    meaning: "Для чего она",
    meaningPlaceholder: "перелёты, отели, визы",
    words: "Ключевые слова",
    wordsPlaceholder: "билет, отель, flight, es:vuelo",
    wordsHelp: (tag) => <>Через запятую. Слова на кириллице считаются русскими; испанские помечайте {tag}.</>,
    save: "Сохранить",
    create: "Добавить",
    cancel: "Отмена",
  },
  reasons: {
    noTool: "Сначала выберите инструмент и профиль.",
    noShared:
      "Ни один установленный инструмент не сообщает общие настройки. Обновите Telegram, MAX или WhatsApp в «Инструментах».",
    hidden: "Значение скрыто, потому что может содержать секрет, поэтому здесь его не изменить.",
    notName: "Это не название настройки.",
    cannotUnset: "Этот инструмент не умеет удалять настройку. Задайте ей значение.",
    readOnly: "Эта настройка здесь только для чтения, поэтому её нельзя удалить.",
    valueShape: "Укажите слово, число, true или false либо список.",
    notJson: (near) => `JSON не разбирается начиная с ${near}. Не пропущена ли запятая или кавычка?`,
    jsonEnd: "JSON не разбирается: в конце чего-то не хватает.",
    notObject: 'Настройки — один объект JSON: { "название": значение, … }',
    categoriesShape: 'Категории — один объект: { "название": "описание | слова" }',
    categoryName: "Название категории — одно слово в нижнем регистре: латинские буквы, цифры и -.",
    categoryText: 'Категория — одна строка: "описание | ключевые слова".',
    categoryHidden: "Эта категория здесь скрыта; меняйте её в терминале.",
    fallback: "other остаётся: сюда попадают задачи без подходящей категории.",
    categoriesUnread: "Инструмент не смог прочитать категории, поэтому их нельзя изменить.",
    keepSection: "Оставьте task_categories; удаляйте категории внутри по одной.",
    meaningMissing: "Напишите, для чего эта категория.",
    meaningPipe: 'Описание не может содержать "|".',
    noName: "Дайте категории название.",
    exists: (name) => `Категория ${name} уже есть; измените её.`,
  },
}

const es: ConfigText = {
  shared: "WireCat (compartidos)",
  sharedNeedsTool: "Instala Telegram, MAX o WhatsApp para cambiar los ajustes compartidos",
  notInstalled: (name) => `${name} no está instalado`,
  profile: "Perfil",
  readingProfiles: "Leyendo perfiles",
  defaults: "Por defecto (todos los perfiles)",
  noProfiles: (tool) => `Aún no hay perfiles de ${tool}. Crea uno en Herramientas, en ${tool}, y vuelve aquí.`,
  profilesFailed: (tool) => `Crea un perfil en Herramientas, en ${tool}, y vuelve aquí.`,
  noProfilesHint: (tool) =>
    `Aún no hay perfiles de ${tool}: crea uno en Herramientas para cambiar los ajustes propios de un perfil.`,
  chooseProfile: "Elige un perfil para ver sus ajustes.",
  sharedScope:
    "Ajustes que leen todas las herramientas de WireCat, sin atarse a una herramienta ni a un perfil: un cambio aquí se aplica a todas.",
  readThrough: (bin) => <>Leídos con {bin}.</>,
  oneFile: (tool) => `${tool} guarda un solo archivo de ajustes para todos los perfiles.`,
  onlyProfile: (tool, profile) => (
    <>
      Solo el perfil {profile} de {tool}. Los ajustes que comparten todas las herramientas están en WireCat
      (compartidos).
    </>
  ),
  defaultsScope: (tool) =>
    `Lo que recibe cada perfil de ${tool} si no define lo suyo. Los ajustes que comparten todas las herramientas están en WireCat (compartidos).`,
  fromProfile: (profile) =>
    `Algunos valores de aquí vienen de un perfil${profile ? ` (${profile})` : ""}, no de los valores por defecto, así que en esta vista son de solo lectura.`,
  panel: {
    shared: "Ajustes compartidos de WireCat para todas las herramientas y perfiles",
    defaults: (tool) => `Ajustes de ${tool} por defecto para todos los perfiles`,
    profile: (tool, profile) => `Ajustes de ${tool} del perfil ${profile}`,
    all: (tool) => `Ajustes de ${tool} para todos los perfiles`,
  },
  tabs: "Vista",
  tabSettings: "Ajustes",
  tabJson: "JSON",
  unsaved: "sin guardar",
  search: "Buscar ajustes",
  reading: "Leyendo ajustes",
  jsonDirty: "La pestaña JSON tiene cambios sin guardar. Guárdalos o descártalos allí antes de cambiar ajustes aquí.",
  file: (path) => <>Archivo: {path}</>,
  otherShared: "Otros ajustes compartidos",
  discard: {
    title: "¿Descartar los cambios de JSON sin guardar?",
    keep: "Seguir editando",
    confirm: "Descartar cambios",
    body: "La pestaña JSON tiene cambios sin guardar. Si cambias, se pierden; no se escribe nada en el archivo.",
  },
  list: {
    origin: {
      default: "integrado",
      defaults: "por defecto",
      profile: "perfil",
      environment: "entorno",
      store: "almacenamiento compartido",
      computed: "varias fuentes",
      file: "archivo de ajustes",
      other: "otro",
    },
    modifiedTitle: "Definido en un archivo, no es el valor integrado",
    modified: "Cambiado respecto al valor integrado",
    masked: "Oculto porque puede contener un secreto o una ruta personal. Cámbialo en una terminal.",
    saving: "Guardando…",
    reset: "Restablecer",
    resetLabel: (key) => `Restablecer ${key}`,
    resetTitle: "Quitarlo de esta capa para que se aplique el valor heredado o el integrado",
    notSet: "sin definir",
    add: "añadir",
    addToList: "Añadir a la lista",
    remove: (item) => `Quitar ${item}`,
    noMatch: "Ningún ajuste coincide.",
  },
  editor: {
    format: "Formatear",
    revert: "Revertir",
    save: "Guardar",
    saving: "Guardando…",
    label: "Ajustes en JSON",
    line: (n) => `Línea ${n}`,
    note: (set, unset) => (
      <>
        Al guardar se ejecuta un {set} o un {unset} por cada ajuste cambiado, y se detiene en el primero que la
        herramienta rechace. Los valores ocultos (•••) y los ajustes bloqueados no se pueden cambiar aquí.
      </>
    ),
    progress: "Progreso del guardado",
    steps: {
      waiting: "En espera",
      running: "Guardando",
      done: "Guardado",
      failed: "Rechazado",
      skipped: "Sin intentar",
    },
  },
  categories: {
    heading: "Categorías de tareas",
    help: (other) => (
      <>
        Una tarea nueva recibe la categoría cuyas palabras clave encajan mejor con su mensaje; si ninguna encaja, va a{" "}
        {other}. El orden decide los empates.
      </>
    ),
    add: "Añadir categoría",
    removed: (name) => <>Se ha quitado {name}. Las tareas que ya la tienen la conservan.</>,
    undo: "Deshacer",
    noMatch: "Ninguna categoría coincide.",
    none: "La herramienta no ha devuelto ninguna categoría.",
    noMeaning: "sin descripción",
    hidden: "Oculto porque puede contener datos personales. Cámbialo en una terminal.",
    edit: (name) => `Editar ${name}`,
    remove: (name) => `Quitar ${name}`,
    fallbackTitle: (name) => `${name} se queda: ahí van las tareas que no encajan en ninguna categoría`,
    fallbackLocked: (name) => `${name} no se puede quitar`,
    newCategory: "Nueva categoría",
    name: "Nombre",
    namePlaceholder: "pets",
    meaning: "Para qué es",
    meaningPlaceholder: "vuelos, hoteles, visados",
    words: "Palabras clave",
    wordsPlaceholder: "es:vuelo, es:hotel, flight, билет",
    wordsHelp: (tag) => (
      <>Separadas por comas. Las palabras en cirílico cuentan como rusas; marca las españolas con {tag}.</>
    ),
    save: "Guardar",
    create: "Añadir",
    cancel: "Cancelar",
  },
  reasons: {
    noTool: "Elige primero una herramienta y un perfil.",
    noShared:
      "Ninguna de las herramientas instaladas devuelve ajustes compartidos. Actualiza Telegram, MAX o WhatsApp en Herramientas.",
    hidden: "Este valor está oculto porque puede contener un secreto, así que no se puede editar aquí.",
    notName: "No es un nombre de ajuste.",
    cannotUnset: "Esta herramienta no puede quitar un ajuste. Dale un valor.",
    readOnly: "Este ajuste es de solo lectura aquí, así que no se puede quitar.",
    valueShape: "Escribe una palabra, un número, true o false, o una lista.",
    notJson: (near) => `El JSON no es válido a partir de ${near}. ¿Falta una coma o unas comillas?`,
    jsonEnd: "El JSON no es válido: falta algo al final.",
    notObject: 'Los ajustes son un único objeto JSON: { "nombre": valor, … }',
    categoriesShape: 'Las categorías son un único objeto: { "nombre": "descripción | palabras" }',
    categoryName: "El nombre de una categoría es una sola palabra en minúsculas: letras, cifras y -.",
    categoryText: 'Una categoría es un solo texto: "descripción | palabras clave".',
    categoryHidden: "Esta categoría está oculta aquí; cámbiala en una terminal.",
    fallback: "other se queda: ahí van las tareas que no encajan en ninguna categoría.",
    categoriesUnread: "La herramienta no pudo leer las categorías, así que no se pueden cambiar.",
    keepSection: "Deja task_categories; quita las categorías de dentro una a una.",
    meaningMissing: "Di para qué es la categoría.",
    meaningPipe: 'La descripción no puede contener "|".',
    noName: "Ponle un nombre a la categoría.",
    exists: (name) => `${name} ya existe; edítala.`,
  },
}

export const configMessages: Messages<ConfigText> = { en, ru, es }
