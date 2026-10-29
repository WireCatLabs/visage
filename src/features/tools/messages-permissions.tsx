import type { ReactNode } from "react"
import { type Messages, plural } from "@/i18n"
import type { Level } from "@/platform/permissions-schemas"

type Count = { allowed: number; total: number }

const enGroups = (n: number) => plural("en", n, { one: "# group", other: "# groups" })
const EN_MEANS: Record<Level, string> = {
  allow: "run these commands, including changes, without asking",
  ask: "run these commands; a change asks for a yes in the terminal, and over MCP the agent's app decides",
  readonly: "read, but not change anything",
  deny: "not run these commands at all",
}
const EN_LEVELS: Record<Level, string> = { allow: "Allow", ask: "Ask first", readonly: "Read only", deny: "Block" }
const EN_LEVEL_INLINE: Record<Level, string> = {
  allow: "allow",
  ask: "ask first",
  readonly: "read only",
  deny: "block",
}
const ruGroups = (n: number) => plural("ru", n, { one: "# группы", few: "# групп", many: "# групп", other: "# группы" })
const ruWho = (profile: string | null) => (profile ? `с профилем ${profile}` : "в профилях без собственных настроек")
const RU_LEVEL_INLINE: Record<Level, string> = {
  allow: "«Разрешить»",
  ask: "«Спрашивать»",
  readonly: "«Только чтение»",
  deny: "«Запретить»",
}
const esGroups = (n: number) => plural("es", n, { one: "# grupo", other: "# grupos" })
const esWho = (profile: string | null) =>
  profile ? `el perfil ${profile}` : "cualquier perfil que no defina nada propio"
const ES_LEVEL_INLINE: Record<Level, string> = {
  allow: "«Permitir»",
  ask: "«Preguntar antes»",
  readonly: "«Solo lectura»",
  deny: "«Bloquear»",
}

const en = {
  permissions: {
    levels: EN_LEVELS,
    levelDefault: (label: string) => `${label} (default)`,
    states: {
      allowed: "Allowed",
      ask: "Asks first",
      readonly: "Read only",
      blocked: "Blocked",
      partial: "Partial",
    },
    partialWrite: "Partial write",
    partialRead: "Partial read",
    changesAllowed: (allowed: number, total: number) => `${allowed} of ${total} changes allowed`,
    readsAllowed: (allowed: number, total: number) => `${allowed} of ${total} reads allowed`,
    inPractice: {
      allowed: "In practice: allowed",
      ask: "In practice: asks first",
      readonly: "In practice: read only",
      blocked: "In practice: blocked",
      partial: "In practice: partial",
    },
    lockUnexplained: "The tool blocks it without saying why.",
    lockProfile: "A profile sets this, not the defaults. Choose that profile to change it.",
    lockEnv: (variable: string) => `Set by the environment variable ${variable}. Change or remove it there.`,
    overviewAll: (label: string, n: number) => `${label} for all ${enGroups(n)}`,
    overviewSome: (label: string, n: number) => `${label} for ${enGroups(n)}`,
    heading: "Permissions — what agents may do",
    closed: (overview: string, profile: string | null) => `${overview} · ${profile ? `as ${profile}` : "defaults"}`,
    readFailedShort: "Could not read them",
    blocksSome: (name: string, reason: string) =>
      `${name} blocks some commands whatever the levels below say: ${reason}.`,
    introProfile: (bin: string, profile: ReactNode, help: ReactNode): ReactNode => (
      <>
        What your agent and scripts may do through {bin} as {profile}. {help}
      </>
    ),
    introDefaults: (bin: string, help: ReactNode): ReactNode => (
      <>
        What your agent and scripts may do through {bin} in every profile that sets nothing of its own. {help}
      </>
    ),
    profile: "Profile",
    loading: "Loading permissions",
    list: (name: string) => `${name} permissions`,
    defaultsOption: "Defaults (all profiles)",
    reload: "Read permissions again",
    readFailed: (error: string) => `Could not read permissions: ${error}`,
    totals: (reads: Count, writes: Count) =>
      `${reads.allowed === reads.total ? `Reading: all ${reads.total} allowed` : `Reading: ${reads.allowed} of ${reads.total} allowed`} · ${writes.allowed === writes.total ? `Changing: all ${writes.total} allowed` : `Changing: ${writes.allowed} of ${writes.total} allowed`}`,
    chooseProfile:
      "Choose a profile to see which commands it may run. A level a profile sets wins over these defaults.",
    commandsFailed: (error: string) => `Could not list the commands: ${error}`,
    noCommands: (bin: string, name: string) =>
      `This version of ${bin} does not say which commands a profile may run, so only the levels in its settings file are shown. Update ${name} to see every command.`,
    ceiling: (deny: boolean) =>
      `Every WireCat tool here is ${deny ? "blocked" : "read only"}: you chose this when you first set up WireCat. Nothing below goes above it. Run setup again to change it.`,
    openSetup: "Open setup",
    heldFor: (level: Level) => `${EN_LEVELS[level]} for now: your first-run answer holds every tool there`,
    select: (group: string) => `${group} permission`,
    setSeparately: "Set separately",
    blocked: "Blocked",
    blockedForProfile: "Blocked for this profile",
    stillAllowed: "Still allowed",
    setSeparatelyList: (group: string) => `${group}: set separately`,
    blockedList: (group: string) => `${group}: blocked commands`,
    stillAllowedList: (group: string) => `${group}: still allowed`,
    disclosure: (blocked: number, separately: number) =>
      [
        blocked > 0 && plural("en", blocked, { one: "# blocked command", other: "# blocked commands" }),
        separately > 0 && `${separately} set separately`,
      ]
        .filter(Boolean)
        .join(" · "),
    removeKey: "Remove this key",
    fromDefaults: "from the defaults",
    allow: "Allow",
    allowAll: (key: string) => `Allow all of ${key}`,
    saving: "Saving…",
    confirmTitle: (level: string, label: string) => `${level}: ${label}?`,
    removeTitle: (label: string) => `Remove the level for ${label}?`,
    keep: "Keep it",
    remove: "Remove",
    means: (level: Level, profile: string | null): string =>
      `Agents and scripts using ${profile ? `the ${profile} profile` : "every profile that sets nothing of its own"} will ${EN_MEANS[level]}.`,
    fallsBack: (profile: string | null, from: Level) =>
      `The tool's own default then applies to ${profile ? `the ${profile} profile` : "every profile that sets nothing of its own"}. It may let more through than ${EN_LEVEL_INLINE[from]}.`,
    overridesStay: (list: ReactNode): ReactNode => <>These stay as they are: {list}.</>,
    levelInline: EN_LEVEL_INLINE,
    ceilingNoEffect: "Your first-run answer still keeps every tool read only, so this has no effect until then.",
    runs: "WireCat runs:",
    copyCommand: "Copy the command",
  },
  // Wording follows cli-base's permissions standard (WC-PERM-2, -4, -6, -11), WC-MCP-7, tg-cli's docs/permissions.md,
  // and the keys cli-core's `keyForCommand` checks each command against.
  levels: {
    open: "What do these levels mean?",
    title: "What the levels mean",
    close: "Close",
    intro: (bin: string) =>
      `Each group has one level. It applies to your agent and your scripts alike, through ${bin} on the command line or over MCP.`,
    help: {
      allow: "The agent reads and changes without asking. A few changes that cannot be undone still ask first.",
      ask: "Reading works. Each change asks for a yes in the terminal first. Over MCP nobody is at a terminal, so the change goes ahead unless the agent's app asks you itself.",
      readonly: "Reading works. Every change is refused.",
      deny: "Nothing works, not even reading. The agent still sees the commands, marked as not allowed.",
    } as Record<Level, string>,
    defaultNote:
      'The level marked "(default)" is what a group gets when nothing is set: the defaults\' level in a profile, and Allow in the defaults. Choosing it removes the setting. To stop an agent from changing something, choose Read only or Block.',
    groupsTitle: "What each group covers",
    notEvery: "Not every app has every action listed here.",
    reading: "Reading:",
    changing: "Changing:",
    groups: {
      messages: {
        reads:
          "Reading and searching messages. Every command that shows what people wrote counts as Messages too: the inbox, search, watching for new messages, and listing or downloading files.",
        changes: "Sending, editing, forwarding, pinning and deleting messages. Deleting asks first, even at Allow.",
      },
      reactions: { reads: "Seeing reactions.", changes: "Adding and removing reactions." },
      polls: { reads: "Seeing polls and their results.", changes: "Creating polls, voting and closing them." },
      topics: {
        reads: "Listing the topics of a group.",
        changes:
          "Creating and editing topics, turning topics on in a group, and deleting them. Turning on and deleting ask first, even at Allow.",
      },
      chats: {
        reads: "Listing chats and groups, their details and their members.",
        changes:
          "Changes to chats and groups, such as their settings, members and admins, invite links, muting, archiving, pinning, marking as read, leaving, deleting a chat and clearing its history. Deleting and clearing ask first, even at Allow.",
      },
      contacts: {
        reads: "Listing and showing contacts.",
        changes:
          "Adding, removing, importing, renaming and blocking contacts, and your own notes and aliases for them.",
      },
      account: {
        reads: "Seeing your own profile.",
        changes:
          "Your profile and privacy settings, and ending your other sessions where the app has it. Ending sessions asks first, and an agent over MCP can never do it.",
      },
      attachments: {
        reads:
          "Listing and downloading files is checked as Messages, and downloading as Chats too, so Block on Messages stops it. Showing a file's text needs both Files and Messages.",
        changes: "Extracting text from saved files, moving them and updating them. This stays on this computer.",
      },
      tasks: {
        reads: "Listing and showing tasks.",
        changes: "Adding, claiming, closing, updating, merging and linking tasks. This stays on this computer.",
      },
    } as Record<string, { reads: string; changes: string }>,
  },
}

const ru: typeof en = {
  permissions: {
    levels: { allow: "Разрешить", ask: "Спрашивать", readonly: "Только чтение", deny: "Запретить" },
    levelDefault: (label) => `${label} (по умолчанию)`,
    states: {
      allowed: "Разрешено",
      ask: "Спрашивает",
      readonly: "Только чтение",
      blocked: "Запрещено",
      partial: "Частично",
    },
    partialWrite: "Изменения частично",
    partialRead: "Чтение частично",
    changesAllowed: (allowed, total) => `Разрешено изменений: ${allowed} из ${total}`,
    readsAllowed: (allowed, total) => `Разрешено чтений: ${allowed} из ${total}`,
    inPractice: {
      allowed: "На деле: разрешено",
      ask: "На деле: спрашивает",
      readonly: "На деле: только чтение",
      blocked: "На деле: запрещено",
      partial: "На деле: частично",
    },
    lockUnexplained: "Инструмент запрещает это без объяснения причины.",
    lockProfile: "Это задаёт профиль, а не значения по умолчанию. Выберите этот профиль, чтобы изменить.",
    lockEnv: (variable) => `Задано переменной окружения ${variable}. Измените или удалите её там.`,
    overviewAll: (label, n) => `${label} для всех ${ruGroups(n)}`,
    overviewSome: (label, n) => `${label} для ${ruGroups(n)}`,
    heading: "Разрешения — что могут агенты",
    closed: (overview, profile) => `${overview} · ${profile ? `профиль ${profile}` : "по умолчанию"}`,
    readFailedShort: "Не удалось прочитать",
    blocksSome: (name, reason) => `${name} запрещает некоторые команды независимо от уровней ниже: ${reason}.`,
    introProfile: (bin, profile, help) => (
      <>
        Что ваш агент и скрипты могут делать через {bin} в профиле {profile}. {help}
      </>
    ),
    introDefaults: (bin, help) => (
      <>
        Что ваш агент и скрипты могут делать через {bin} во всех профилях без собственных настроек. {help}
      </>
    ),
    profile: "Профиль",
    loading: "Загружаем разрешения",
    list: (name) => `Разрешения ${name}`,
    defaultsOption: "По умолчанию (все профили)",
    reload: "Прочитать разрешения снова",
    readFailed: (error) => `Не удалось прочитать разрешения: ${error}`,
    totals: (reads, writes) =>
      `${reads.allowed === reads.total ? `Чтение: разрешено всё (${reads.total})` : `Чтение: разрешено ${reads.allowed} из ${reads.total}`} · ${writes.allowed === writes.total ? `Изменения: разрешено всё (${writes.total})` : `Изменения: разрешено ${writes.allowed} из ${writes.total}`}`,
    chooseProfile:
      "Выберите профиль, чтобы увидеть, какие команды ему доступны. Уровень, заданный в профиле, важнее этих значений по умолчанию.",
    commandsFailed: (error) => `Не удалось получить список команд: ${error}`,
    noCommands: (bin, name) =>
      `Эта версия ${bin} не сообщает, какие команды доступны профилю, поэтому показаны только уровни из файла настроек. Обновите ${name}, чтобы увидеть все команды.`,
    ceiling: (deny) =>
      `Все инструменты WireCat здесь ${deny ? "запрещены" : "только для чтения"}: вы выбрали это при первой настройке WireCat. Уровни ниже не могут быть выше. Чтобы изменить это, запустите настройку снова.`,
    openSetup: "Открыть настройку",
    heldFor: (level) =>
      `Пока действует ${RU_LEVEL_INLINE[level]}: ваш ответ при первой настройке держит все инструменты на этом уровне`,
    select: (group) => `Разрешение: ${group}`,
    setSeparately: "Задано отдельно",
    blocked: "Запрещено",
    blockedForProfile: "Запрещено для этого профиля",
    stillAllowed: "Всё ещё разрешено",
    setSeparatelyList: (group) => `${group}: задано отдельно`,
    blockedList: (group) => `${group}: запрещённые команды`,
    stillAllowedList: (group) => `${group}: всё ещё разрешено`,
    disclosure: (blocked, separately) =>
      [
        blocked > 0 &&
          plural("ru", blocked, {
            one: "# команда запрещена",
            few: "# команды запрещены",
            many: "# команд запрещено",
            other: "# команды запрещены",
          }),
        separately > 0 && `задано отдельно: ${separately}`,
      ]
        .filter(Boolean)
        .join(" · "),
    removeKey: "Удалить этот ключ",
    fromDefaults: "из значений по умолчанию",
    allow: "Разрешить",
    allowAll: (key) => `Разрешить всё в ${key}`,
    saving: "Сохраняем…",
    confirmTitle: (level, label) => `${level}: ${label}?`,
    removeTitle: (label) => `Убрать уровень для «${label}»?`,
    keep: "Оставить",
    remove: "Убрать",
    means: (level, profile) => {
      const who = ruWho(profile)
      switch (level) {
        case "allow":
          return `Агенты и скрипты ${who} смогут выполнять эти команды, включая изменения, без вопросов.`
        case "ask":
          return `Агенты и скрипты ${who} смогут выполнять эти команды; изменение потребует подтверждения в терминале, а через MCP решает приложение агента.`
        case "readonly":
          return `Агенты и скрипты ${who} смогут читать, но ничего не смогут менять.`
        case "deny":
          return `Агенты и скрипты ${who} совсем не смогут выполнять эти команды.`
      }
    },
    fallsBack: (profile, from) =>
      `Тогда ${profile ? `для профиля ${profile}` : "для профилей без собственных настроек"} действует значение по умолчанию самого инструмента. Оно может пропускать больше, чем ${RU_LEVEL_INLINE[from]}.`,
    overridesStay: (list) => <>Эти ключи не изменятся: {list}.</>,
    levelInline: RU_LEVEL_INLINE,
    ceilingNoEffect:
      "Ваш ответ при первой настройке по-прежнему держит все инструменты в режиме только для чтения, так что пока это ни на что не влияет.",
    runs: "WireCat выполнит:",
    copyCommand: "Скопировать команду",
  },
  levels: {
    open: "Что значат эти уровни?",
    title: "Что значат уровни",
    close: "Закрыть",
    intro: (bin) =>
      `У каждой группы один уровень. Он действует одинаково для агента и для скриптов — через ${bin} в командной строке или через MCP.`,
    help: {
      allow: "Агент читает и изменяет без вопросов. Несколько необратимых изменений всё равно требуют подтверждения.",
      ask: "Чтение работает. Каждое изменение сначала требует подтверждения в терминале. Через MCP за терминалом никого нет, поэтому изменение выполняется, если только приложение агента не спросит вас само.",
      readonly: "Чтение работает. Любое изменение отклоняется.",
      deny: "Ничего не работает, даже чтение. Агент всё равно видит команды, помеченные как запрещённые.",
    },
    defaultNote:
      "Уровень с пометкой «(по умолчанию)» группа получает, когда ничего не задано: уровень из значений по умолчанию в профиле и «Разрешить» в самих значениях по умолчанию. Если выбрать его, настройка удаляется. Чтобы агент ничего не менял, выберите «Только чтение» или «Запретить».",
    groupsTitle: "Что входит в каждую группу",
    notEvery: "Не у каждого приложения есть все перечисленные действия.",
    reading: "Чтение:",
    changing: "Изменение:",
    groups: {
      messages: {
        reads:
          "Чтение сообщений и поиск по ним. Каждая команда, которая показывает, что написали люди, тоже относится к «Сообщениям»: входящие, поиск, ожидание новых сообщений, список файлов и их скачивание.",
        changes:
          "Отправка, правка, пересылка, закрепление и удаление сообщений. Удаление требует подтверждения даже при «Разрешить».",
      },
      reactions: { reads: "Просмотр реакций.", changes: "Добавление и удаление реакций." },
      polls: { reads: "Просмотр опросов и их результатов.", changes: "Создание опросов, голосование и их закрытие." },
      topics: {
        reads: "Список тем группы.",
        changes:
          "Создание и правка тем, включение тем в группе и их удаление. Включение и удаление требуют подтверждения даже при «Разрешить».",
      },
      chats: {
        reads: "Список чатов и групп, их сведения и участники.",
        changes:
          "Изменения чатов и групп: настройки, участники и администраторы, ссылки-приглашения, отключение звука, архив, закрепление, отметка о прочтении, выход, удаление чата и очистка истории. Удаление и очистка требуют подтверждения даже при «Разрешить».",
      },
      contacts: {
        reads: "Список контактов и их просмотр.",
        changes:
          "Добавление, удаление, импорт, переименование и блокировка контактов, а также ваши заметки и псевдонимы для них.",
      },
      account: {
        reads: "Просмотр вашего профиля.",
        changes:
          "Настройки профиля и конфиденциальности, а также завершение других ваших сеансов, если приложение это умеет. Завершение сеансов требует подтверждения, а агент через MCP не может сделать это никогда.",
      },
      attachments: {
        reads:
          "Список файлов и скачивание проверяются как «Сообщения», а скачивание — ещё и как «Чаты», поэтому «Запретить» для «Сообщений» их останавливает. Чтобы показать текст файла, нужны и «Файлы», и «Сообщения».",
        changes:
          "Извлечение текста из сохранённых файлов, их перемещение и обновление. Всё остаётся на этом компьютере.",
      },
      tasks: {
        reads: "Список задач и их просмотр.",
        changes:
          "Добавление, взятие в работу, закрытие, обновление, слияние и связывание задач. Всё остаётся на этом компьютере.",
      },
    },
  },
}

const es: typeof en = {
  permissions: {
    levels: { allow: "Permitir", ask: "Preguntar antes", readonly: "Solo lectura", deny: "Bloquear" },
    levelDefault: (label) => `${label} (por defecto)`,
    states: {
      allowed: "Permitido",
      ask: "Pregunta antes",
      readonly: "Solo lectura",
      blocked: "Bloqueado",
      partial: "Parcial",
    },
    partialWrite: "Escritura parcial",
    partialRead: "Lectura parcial",
    changesAllowed: (allowed, total) => `${allowed} de ${total} cambios permitidos`,
    readsAllowed: (allowed, total) => `${allowed} de ${total} lecturas permitidas`,
    inPractice: {
      allowed: "En la práctica: permitido",
      ask: "En la práctica: pregunta antes",
      readonly: "En la práctica: solo lectura",
      blocked: "En la práctica: bloqueado",
      partial: "En la práctica: parcial",
    },
    lockUnexplained: "La herramienta lo bloquea sin decir por qué.",
    lockProfile: "Esto lo define un perfil, no los valores predeterminados. Elige ese perfil para cambiarlo.",
    lockEnv: (variable) => `Lo define la variable de entorno ${variable}. Cámbiala o quítala allí.`,
    overviewAll: (label, n) => `${label} en los ${esGroups(n)}`,
    overviewSome: (label, n) => `${label} en ${esGroups(n)}`,
    heading: "Permisos: qué pueden hacer los agentes",
    closed: (overview, profile) => `${overview} · ${profile ? `como ${profile}` : "predeterminados"}`,
    readFailedShort: "No se pudieron leer",
    blocksSome: (name, reason) =>
      `${name} bloquea algunos comandos digan lo que digan los niveles de abajo: ${reason}.`,
    introProfile: (bin, profile, help) => (
      <>
        Lo que tu agente y tus scripts pueden hacer con {bin} como {profile}. {help}
      </>
    ),
    introDefaults: (bin, help) => (
      <>
        Lo que tu agente y tus scripts pueden hacer con {bin} en cualquier perfil que no defina nada propio. {help}
      </>
    ),
    profile: "Perfil",
    loading: "Cargando permisos",
    list: (name) => `Permisos de ${name}`,
    defaultsOption: "Predeterminados (todos los perfiles)",
    reload: "Volver a leer los permisos",
    readFailed: (error) => `No se pudieron leer los permisos: ${error}`,
    totals: (reads, writes) =>
      `${reads.allowed === reads.total ? `Lectura: los ${reads.total} permitidos` : `Lectura: ${reads.allowed} de ${reads.total} permitidos`} · ${writes.allowed === writes.total ? `Cambios: los ${writes.total} permitidos` : `Cambios: ${writes.allowed} de ${writes.total} permitidos`}`,
    chooseProfile:
      "Elige un perfil para ver qué comandos puede ejecutar. El nivel que define un perfil manda sobre estos valores predeterminados.",
    commandsFailed: (error) => `No se pudieron listar los comandos: ${error}`,
    noCommands: (bin, name) =>
      `Esta versión de ${bin} no dice qué comandos puede ejecutar un perfil, así que solo se muestran los niveles de su archivo de ajustes. Actualiza ${name} para ver todos los comandos.`,
    ceiling: (deny) =>
      `Todas las herramientas de WireCat aquí están ${deny ? "bloqueadas" : "en solo lectura"}: lo elegiste al configurar WireCat por primera vez. Nada de lo de abajo puede pasar de ahí. Vuelve a ejecutar la configuración para cambiarlo.`,
    openSetup: "Abrir la configuración",
    heldFor: (level) =>
      `De momento, ${ES_LEVEL_INLINE[level]}: tu respuesta en la primera configuración mantiene ahí todas las herramientas`,
    select: (group) => `Permiso de ${group}`,
    setSeparately: "Definido aparte",
    blocked: "Bloqueado",
    blockedForProfile: "Bloqueado para este perfil",
    stillAllowed: "Aún permitido",
    setSeparatelyList: (group) => `${group}: definido aparte`,
    blockedList: (group) => `${group}: comandos bloqueados`,
    stillAllowedList: (group) => `${group}: aún permitido`,
    disclosure: (blocked, separately) =>
      [
        blocked > 0 && plural("es", blocked, { one: "# comando bloqueado", other: "# comandos bloqueados" }),
        separately > 0 && plural("es", separately, { one: "# definido aparte", other: "# definidos aparte" }),
      ]
        .filter(Boolean)
        .join(" · "),
    removeKey: "Quitar esta clave",
    fromDefaults: "de los valores predeterminados",
    allow: "Permitir",
    allowAll: (key) => `Permitir todo ${key}`,
    saving: "Guardando…",
    confirmTitle: (level, label) => `${level}: ¿${label}?`,
    removeTitle: (label) => `¿Quitar el nivel de ${label}?`,
    keep: "Conservar",
    remove: "Quitar",
    means: (level, profile) => {
      const who = esWho(profile)
      switch (level) {
        case "allow":
          return `Los agentes y scripts que usen ${who} podrán ejecutar estos comandos, también los cambios, sin preguntar.`
        case "ask":
          return `Los agentes y scripts que usen ${who} podrán ejecutar estos comandos; cada cambio pide un sí en el terminal, y mediante MCP decide la app del agente.`
        case "readonly":
          return `Los agentes y scripts que usen ${who} podrán leer, pero no cambiar nada.`
        case "deny":
          return `Los agentes y scripts que usen ${who} no podrán ejecutar estos comandos en absoluto.`
      }
    },
    fallsBack: (profile, from) =>
      `Entonces se aplica a ${esWho(profile)} el valor predeterminado de la propia herramienta. Puede dejar pasar más que ${ES_LEVEL_INLINE[from]}.`,
    overridesStay: (list) => <>Estas se quedan como están: {list}.</>,
    levelInline: ES_LEVEL_INLINE,
    ceilingNoEffect:
      "Tu respuesta en la primera configuración sigue dejando todas las herramientas en solo lectura, así que esto no tiene efecto hasta entonces.",
    runs: "WireCat ejecuta:",
    copyCommand: "Copiar el comando",
  },
  levels: {
    open: "¿Qué significan estos niveles?",
    title: "Qué significan los niveles",
    close: "Cerrar",
    intro: (bin) =>
      `Cada grupo tiene un nivel. Se aplica igual a tu agente y a tus scripts, con ${bin} en la línea de comandos o mediante MCP.`,
    help: {
      allow:
        "El agente lee y cambia sin preguntar. Algunos cambios que no se pueden deshacer siguen preguntando antes.",
      ask: "La lectura funciona. Cada cambio pide antes un sí en el terminal. Mediante MCP no hay nadie en un terminal, así que el cambio sigue adelante salvo que la app del agente te pregunte a ti.",
      readonly: "La lectura funciona. Se rechaza cualquier cambio.",
      deny: "No funciona nada, ni siquiera leer. El agente sigue viendo los comandos, marcados como no permitidos.",
    },
    defaultNote:
      "El nivel marcado como «(por defecto)» es el que recibe un grupo cuando no hay nada definido: el nivel de los valores predeterminados en un perfil, y Permitir en los valores predeterminados. Elegirlo quita el ajuste. Para que un agente no cambie algo, elige Solo lectura o Bloquear.",
    groupsTitle: "Qué cubre cada grupo",
    notEvery: "No todas las apps tienen todas las acciones de esta lista.",
    reading: "Lectura:",
    changing: "Cambios:",
    groups: {
      messages: {
        reads:
          "Leer y buscar mensajes. Todo comando que muestre lo que escribió la gente cuenta también como Mensajes: la bandeja de entrada, la búsqueda, esperar mensajes nuevos y listar o descargar archivos.",
        changes: "Enviar, editar, reenviar, fijar y borrar mensajes. Borrar pregunta antes, incluso con Permitir.",
      },
      reactions: { reads: "Ver reacciones.", changes: "Añadir y quitar reacciones." },
      polls: { reads: "Ver encuestas y sus resultados.", changes: "Crear encuestas, votar y cerrarlas." },
      topics: {
        reads: "Listar los temas de un grupo.",
        changes:
          "Crear y editar temas, activar los temas en un grupo y borrarlos. Activar y borrar preguntan antes, incluso con Permitir.",
      },
      chats: {
        reads: "Listar chats y grupos, sus detalles y sus miembros.",
        changes:
          "Cambios en chats y grupos, como sus ajustes, miembros y administradores, enlaces de invitación, silenciar, archivar, fijar, marcar como leído, salir, borrar un chat y vaciar su historial. Borrar y vaciar preguntan antes, incluso con Permitir.",
      },
      contacts: {
        reads: "Listar y mostrar contactos.",
        changes: "Añadir, quitar, importar, renombrar y bloquear contactos, y tus propias notas y alias para ellos.",
      },
      account: {
        reads: "Ver tu propio perfil.",
        changes:
          "Tu perfil y tus ajustes de privacidad, y cerrar tus otras sesiones cuando la app lo permite. Cerrar sesiones pregunta antes, y un agente mediante MCP nunca puede hacerlo.",
      },
      attachments: {
        reads:
          "Listar y descargar archivos se comprueba como Mensajes, y descargar también como Chats, así que Bloquear en Mensajes lo impide. Mostrar el texto de un archivo necesita Archivos y Mensajes.",
        changes: "Extraer texto de archivos guardados, moverlos y actualizarlos. Esto se queda en este ordenador.",
      },
      tasks: {
        reads: "Listar y mostrar tareas.",
        changes: "Añadir, reclamar, cerrar, actualizar, fusionar y enlazar tareas. Esto se queda en este ordenador.",
      },
    },
  },
}

export type PermissionsText = (typeof en)["permissions"]
export const permissionsMessages: Messages<typeof en> = { en, ru, es }
