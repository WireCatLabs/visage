import type { ReactNode } from "react"
import type { Messages } from "@/i18n"

/** The Tailscale and Cloudflare steps of the Connect guide. */
const en = {
  tailscale: {
    titles: {
      install: "Install Tailscale",
      login: "Log in to Tailscale",
      funnel: "Allow Funnel",
      connect: "Connect this server",
    },
    missing: {
      blocked: "Waits for the step before it.",
      notInstalled: "Tailscale is not installed on this computer.",
      noOperator: "Tailscale is installed, but only the administrator may change its settings.",
      notRunning: "Tailscale is installed but not running.",
      needsLogin: "This computer is not logged in to Tailscale.",
      needsApproval: "Your Tailscale network's admin has not approved this computer yet.",
      stopped: "Tailscale is turned off on this computer.",
      starting: "Tailscale is still connecting.",
      unknown: "Tailscale did not say whether it is logged in.",
      noHttps: "HTTPS certificates are off for your Tailscale network.",
      noFunnel: "Your Tailscale network does not allow Funnel yet.",
      noHost: "This computer has no Tailscale name. Turn on MagicDNS.",
      portsFull:
        "All of Funnel's public addresses on this computer are in use by other servers. Remove a Funnel you set up yourself.",
    },
    opening: "Opening…",
    openTerminalMany: "Open a terminal with them",
    openTerminalOne: "Open a terminal with it",
    updatesRepo: "They add Tailscale's own update source, so your system's updates keep Tailscale current.",
    updatesPackage: "This is your distribution's own Tailscale package, so your system's updates keep it current.",
    password: "They ask for your computer password.",
    instructions: "Tailscale's instructions",
    instructionsLink: (link: ReactNode): ReactNode => <>{link}.</>,
    instructionsAndWiki: (link: ReactNode, wiki: ReactNode): ReactNode => (
      <>
        {link} and the {wiki}.
      </>
    ),
    nixosWiki: "NixOS wiki",
    noCommands: (distro: string, page: ReactNode, binaries: ReactNode): ReactNode => (
      <>
        Tailscale lists no commands for {distro}. See its {page} or the {binaries} that run on any Linux.
      </>
    ),
    linuxPage: "Linux install page",
    staticBinaries: "static binaries",
    nixos: "On NixOS, Tailscale is part of your system configuration. Add this line to it, then rebuild:",
    copyLine: "Copy the line",
    scriptTitle: "Install with Tailscale's install script",
    copyInstall: "Copy the install command",
    scriptPassword: "It asks for your computer password, because it installs a system service.",
    thenSource: (distro: string) => `Then add Tailscale's update source for ${distro}`,
    orCommands: (distro: string) => `Or install with Tailscale's commands for ${distro}`,
    commands: (distro: string) => `Install with Tailscale's commands for ${distro}`,
    noAutoUpdate: "A package installed by double-click does not update itself. The commands below do.",
    copyCommands: "Copy the commands",
    noSource: "Installed without Tailscale's update source: system updates will not update it.",
    addSource: "Add the update source",
    operator:
      "On Linux, Tailscale takes orders only from the administrator unless you name your user as its operator. Do this once: it lets WireCat log in and turn Funnel on without asking for your password each time.",
    copyCommand: "Copy the command",
    operatorHow:
      "Paste it in a terminal; it asks for your computer password. WireCat does not run it for you, because it changes who controls Tailscale. Then come back here; the step checks itself.",
    why: "Tailscale gives this computer a fixed https address on the internet, so ChatGPT or Claude in the browser can reach the server.",
    downloadMacos:
      "WireCat downloads Tailscale's official installer into Downloads and opens it. The macOS Installer then asks for your computer password, because Tailscale installs a system service.",
    downloadWindows:
      "WireCat downloads Tailscale's official installer into Downloads and opens it. Windows then asks for your computer password, because Tailscale installs a system service.",
    downloadLinux:
      "WireCat downloads Tailscale's official package into Downloads and shows it in your file manager. Double-click it: your Software app installs it and asks for your computer password.",
    downloading: "Downloading…",
    downloadInstaller: "Download and open the installer",
    downloadPackage: (ext: string) => `Download Tailscale (.${ext})`,
    checksum: "From pkgs.tailscale.com, checked against Tailscale's checksum.",
    saved: (path: ReactNode): ReactNode => <>Saved to {path}.</>,
    openedMacos:
      "The macOS Installer opened it. Follow its steps; it asks for your computer password itself. Then open Tailscale from Applications.",
    openedWindows:
      "Windows opened it. Follow its steps; it asks for your computer password itself. Then open Tailscale from the Start menu.",
    shown:
      "Your file manager shows it. Double-click it: your Software app installs it and asks for your password. If nothing opens it, run the commands below instead.",
    yourself: (link: ReactNode): ReactNode => <>Or get it yourself from {link}.</>,
    downloadPage: "Tailscale's download page",
    notRunning: "Tailscale is installed but not running.",
    startService: "Start its service once; it then starts with the computer:",
    openAppMacos: "Open the Tailscale app from Applications, then come back.",
    openAppWindows: "Open the Tailscale app from the Start menu, then come back.",
    approval:
      "You are logged in, but your Tailscale network asks its admin to approve each new computer. If that is you, approve this one on the Machines page.",
    machines: "Open the Machines page",
    stoppedMacos: "Tailscale is turned off on this computer. Turn it on from the Tailscale icon in the menu bar.",
    stoppedWindows: "Tailscale is turned off on this computer. Turn it on from the Tailscale icon next to the clock.",
    stoppedLinux: "Tailscale is turned off on this computer. Turn it on from the Tailscale icon, or with this command.",
    login:
      "Press Log in. Your browser opens a tailscale.com page that asks you to sign in with Google, Microsoft, GitHub, Apple or a passkey. New to Tailscale? The same page creates an account. This step finishes by itself when you are done there.",
    waiting: "Waiting for you in the browser…",
    pageAgain: "Open the page again",
    stop: "Stop",
    logIn: "Log in",
    https:
      "Funnel needs secure (https) addresses in your Tailscale network. On the DNS page, turn on MagicDNS if it is off, then under HTTPS Certificates choose Enable HTTPS.",
    dns: "Open the DNS page",
    certLog: "Tailscale says the computer names then appear in a public certificate log.",
    funnel:
      "Funnel is what lets the internet reach one address on this computer. Your network's access rules must allow it: on the Access controls page, open the Funnel section and add Funnel to the policy.",
    acls: "Open the Access controls page",
    stepDone: "Done",
    stepNotYet: "Not yet",
    checking: "Checking…",
    check: "Check",
    checkStep: (title: string) => `Check: ${title}`,
    unreadable: (error: string) => `Could not read Tailscale's state: ${error}`,
    reading: "Reading Tailscale's state",
    list: "Set up Tailscale Funnel",
    fullGuide: (link: ReactNode): ReactNode => <>{link} for this step on wirecat.dev.</>,
    fullGuideLink: "Full guide",
  },

  cloudflare: {
    privacy:
      "Cloudflare decrypts the traffic on its servers, so Cloudflare can read what the tools send back, your messages included. Tailscale Funnel cannot: there the encryption ends on this computer.",
    titles: {
      install: "Download cloudflared",
      account: "Connect your Cloudflare account",
      address: "Choose the address",
    },
    missing: {
      blocked: "Waits for the step before it.",
      unsupported: "Cloudflare publishes no cloudflared for this computer's processor.",
      notInstalled: "cloudflared is not on this computer yet.",
      noAccount: "WireCat is not connected to a Cloudflare account yet.",
      noAddress: "There is no address on your domain yet.",
    },
    unsupported: (link: ReactNode): ReactNode => (
      <>
        Cloudflare publishes no cloudflared for this computer's processor, so this way does not work here. Use Tailscale
        Funnel, or see {link}.
      </>
    ),
    downloads: "Cloudflare's downloads",
    install:
      "cloudflared is Cloudflare's own program that holds the tunnel open. WireCat downloads it from Cloudflare's releases on GitHub into its own folder. Nothing is installed in the system, and no password is asked.",
    downloading: "Downloading…",
    download: "Download cloudflared",
    stop: "Stop",
    checksum: "Checked against GitHub's checksum.",
    account:
      "You need a Cloudflare account with your own domain on it, that is, Cloudflare runs the domain's DNS. Press Connect: your browser opens Cloudflare, you log in, choose the domain for the address and press Authorize.",
    waiting: "Waiting for you in the browser…",
    pageAgain: "Open the page again",
    again: "Connect again to choose another name",
    connect: "Connect Cloudflare",
    noAccount: (signUp: ReactNode, addDomain: ReactNode): ReactNode => (
      <>
        No account or no domain there yet? {signUp}, then {addDomain}; Cloudflare's own steps include changing the
        domain's nameservers where you bought it.
      </>
    ),
    signUp: "Create an account",
    addDomain: "add your domain",
    name: "Type a new name under the domain you chose in Cloudflare. WireCat makes one tunnel and this one DNS record in your account; nothing else there changes.",
    nameLabel: "Address on your domain",
    stays: (host: ReactNode): ReactNode => (
      <>The tunnel for {host} stays in your Cloudflare account until you delete it there.</>
    ),
    making: "Making the address…",
    make: "Make the address",
    unreadable: (error: string) => `Could not read cloudflared's state: ${error}`,
    reading: "Reading cloudflared's state",
    list: "Set up a Cloudflare tunnel",
    yours: (host: ReactNode): ReactNode => <>{host} is yours on Cloudflare.</>,
  },
}

const ru: typeof en = {
  tailscale: {
    titles: {
      install: "Установите Tailscale",
      login: "Войдите в Tailscale",
      funnel: "Разрешите Funnel",
      connect: "Подключите этот сервер",
    },
    missing: {
      blocked: "Ждёт предыдущего шага.",
      notInstalled: "Tailscale не установлен на этом компьютере.",
      noOperator: "Tailscale установлен, но менять его настройки может только администратор.",
      notRunning: "Tailscale установлен, но не запущен.",
      needsLogin: "Этот компьютер не вошёл в Tailscale.",
      needsApproval: "Администратор вашей сети Tailscale ещё не одобрил этот компьютер.",
      stopped: "Tailscale выключен на этом компьютере.",
      starting: "Tailscale ещё подключается.",
      unknown: "Tailscale не сообщил, выполнен ли вход.",
      noHttps: "В вашей сети Tailscale выключены HTTPS-сертификаты.",
      noFunnel: "Ваша сеть Tailscale пока не разрешает Funnel.",
      noHost: "У этого компьютера нет имени в Tailscale. Включите MagicDNS.",
      portsFull:
        "Все публичные адреса Funnel на этом компьютере заняты другими серверами. Удалите Funnel, который вы настроили сами.",
    },
    opening: "Открываем…",
    openTerminalMany: "Открыть терминал с ними",
    openTerminalOne: "Открыть терминал с ней",
    updatesRepo:
      "Они добавляют источник обновлений Tailscale, поэтому системные обновления будут обновлять и Tailscale.",
    updatesPackage: "Это пакет Tailscale из вашего дистрибутива, поэтому системные обновления будут его обновлять.",
    password: "Они попросят пароль от компьютера.",
    instructions: "Инструкция Tailscale",
    instructionsLink: (link) => <>{link} (на английском).</>,
    instructionsAndWiki: (link, wiki) => (
      <>
        {link} и {wiki} (на английском).
      </>
    ),
    nixosWiki: "вики NixOS",
    noCommands: (distro, page, binaries) => (
      <>
        У Tailscale нет команд для {distro}. Смотрите его {page} или {binaries}, которые работают в любом Linux.
      </>
    ),
    linuxPage: "страницу установки для Linux",
    staticBinaries: "статические сборки",
    nixos: "В NixOS Tailscale — часть конфигурации системы. Добавьте в неё эту строку и пересоберите систему:",
    copyLine: "Скопировать строку",
    scriptTitle: "Установка скриптом Tailscale",
    copyInstall: "Скопировать команду установки",
    scriptPassword: "Он попросит пароль от компьютера, потому что устанавливает системную службу.",
    thenSource: (distro) => `Затем добавьте источник обновлений Tailscale для ${distro}`,
    orCommands: (distro) => `Или установите командами Tailscale для ${distro}`,
    commands: (distro) => `Установка командами Tailscale для ${distro}`,
    noAutoUpdate: "Пакет, установленный двойным щелчком, сам не обновляется. Команды ниже это исправят.",
    copyCommands: "Скопировать команды",
    noSource: "Установлен без источника обновлений Tailscale: системные обновления его не обновят.",
    addSource: "Добавить источник обновлений",
    operator:
      "В Linux Tailscale слушается только администратора, пока вы не назначите своего пользователя его оператором. Сделайте это один раз: тогда WireCat сможет входить и включать Funnel, не спрашивая каждый раз пароль.",
    copyCommand: "Скопировать команду",
    operatorHow:
      "Вставьте её в терминал, она попросит пароль от компьютера. WireCat не выполняет её сам, потому что она меняет, кто управляет Tailscale. Затем вернитесь сюда: шаг проверится сам.",
    why: "Tailscale даёт этому компьютеру постоянный https-адрес в интернете, чтобы ChatGPT или Claude в браузере могли достучаться до сервера.",
    downloadMacos:
      "WireCat скачает официальный установщик Tailscale в «Загрузки» и откроет его. Затем установщик macOS попросит пароль от компьютера, потому что Tailscale ставит системную службу.",
    downloadWindows:
      "WireCat скачает официальный установщик Tailscale в «Загрузки» и откроет его. Затем Windows попросит пароль от компьютера, потому что Tailscale ставит системную службу.",
    downloadLinux:
      "WireCat скачает официальный пакет Tailscale в «Загрузки» и покажет его в файловом менеджере. Дважды щёлкните по нему: менеджер приложений установит его и попросит пароль от компьютера.",
    downloading: "Скачиваем…",
    downloadInstaller: "Скачать и открыть установщик",
    downloadPackage: (ext) => `Скачать Tailscale (.${ext})`,
    checksum: "С pkgs.tailscale.com, сверено с контрольной суммой Tailscale.",
    saved: (path) => <>Сохранено в {path}.</>,
    openedMacos:
      "Установщик macOS открыл его. Следуйте его шагам, пароль от компьютера он спросит сам. Затем откройте Tailscale из папки «Программы».",
    openedWindows:
      "Windows открыла его. Следуйте его шагам, пароль от компьютера он спросит сам. Затем откройте Tailscale из меню «Пуск».",
    shown:
      "Файловый менеджер показывает его. Дважды щёлкните по нему: менеджер приложений установит его и попросит пароль. Если ничего не открывается, выполните команды ниже.",
    yourself: (link) => <>Или скачайте сами со {link}.</>,
    downloadPage: "страницы загрузки Tailscale",
    notRunning: "Tailscale установлен, но не запущен.",
    startService: "Запустите его службу один раз, дальше она будет стартовать вместе с компьютером:",
    openAppMacos: "Откройте приложение Tailscale из папки «Программы» и вернитесь сюда.",
    openAppWindows: "Откройте приложение Tailscale из меню «Пуск» и вернитесь сюда.",
    approval:
      "Вы вошли, но в вашей сети Tailscale администратор одобряет каждый новый компьютер. Если администратор — вы, одобрите этот компьютер на странице Machines.",
    machines: "Открыть страницу Machines",
    stoppedMacos: "Tailscale выключен на этом компьютере. Включите его через значок Tailscale в строке меню.",
    stoppedWindows: "Tailscale выключен на этом компьютере. Включите его через значок Tailscale рядом с часами.",
    stoppedLinux: "Tailscale выключен на этом компьютере. Включите его через значок Tailscale или этой командой.",
    login:
      "Нажмите «Войти». В браузере откроется страница tailscale.com, где можно войти через Google, Microsoft, GitHub, Apple или ключ доступа. Впервые в Tailscale? На той же странице создаётся аккаунт. Шаг завершится сам, когда вы закончите там.",
    waiting: "Ждём вас в браузере…",
    pageAgain: "Открыть страницу ещё раз",
    stop: "Остановить",
    logIn: "Войти",
    https:
      "Funnel нужны защищённые (https) адреса в вашей сети Tailscale. На странице DNS включите MagicDNS, если он выключен, затем в разделе HTTPS Certificates выберите Enable HTTPS.",
    dns: "Открыть страницу DNS",
    certLog: "По словам Tailscale, после этого имена компьютеров попадут в публичный журнал сертификатов.",
    funnel:
      "Funnel позволяет интернету достучаться до одного адреса на этом компьютере. Правила доступа вашей сети должны это разрешать: на странице Access controls откройте раздел Funnel и добавьте Funnel в политику.",
    acls: "Открыть страницу Access controls",
    stepDone: "Готово",
    stepNotYet: "Ещё нет",
    checking: "Проверяем…",
    check: "Проверить",
    checkStep: (title) => `Проверить: ${title}`,
    unreadable: (error) => `Не удалось узнать состояние Tailscale: ${error}`,
    reading: "Узнаём состояние Tailscale",
    list: "Настройка Tailscale Funnel",
    fullGuide: (link) => <>{link} к этому шагу на wirecat.dev.</>,
    fullGuideLink: "Полная инструкция",
  },

  cloudflare: {
    privacy:
      "Cloudflare расшифровывает трафик на своих серверах, поэтому Cloudflare может читать то, что возвращают инструменты, включая ваши сообщения. Tailscale Funnel не может: там шифрование заканчивается на этом компьютере.",
    titles: {
      install: "Скачайте cloudflared",
      account: "Подключите аккаунт Cloudflare",
      address: "Выберите адрес",
    },
    missing: {
      blocked: "Ждёт предыдущего шага.",
      unsupported: "Cloudflare не выпускает cloudflared для процессора этого компьютера.",
      notInstalled: "cloudflared ещё нет на этом компьютере.",
      noAccount: "WireCat ещё не подключён к аккаунту Cloudflare.",
      noAddress: "На вашем домене ещё нет адреса.",
    },
    unsupported: (link) => (
      <>
        Cloudflare не выпускает cloudflared для процессора этого компьютера, поэтому здесь этот способ не работает.
        Используйте Tailscale Funnel или посмотрите {link}.
      </>
    ),
    downloads: "загрузки Cloudflare",
    install:
      "cloudflared — собственная программа Cloudflare, которая держит туннель открытым. WireCat скачивает её из релизов Cloudflare на GitHub в свою папку. В систему ничего не устанавливается, пароль не нужен.",
    downloading: "Скачиваем…",
    download: "Скачать cloudflared",
    stop: "Остановить",
    checksum: "Сверено с контрольной суммой на GitHub.",
    account:
      "Нужен аккаунт Cloudflare с вашим собственным доменом, то есть DNS домена ведёт Cloudflare. Нажмите «Подключить»: в браузере откроется Cloudflare, вы войдёте, выберете домен для адреса и нажмёте Authorize.",
    waiting: "Ждём вас в браузере…",
    pageAgain: "Открыть страницу ещё раз",
    again: "Подключить снова, чтобы выбрать другое имя",
    connect: "Подключить Cloudflare",
    noAccount: (signUp, addDomain) => (
      <>
        Нет аккаунта или домена? {signUp}, затем {addDomain}; в шагах Cloudflare есть смена серверов имён (nameservers)
        домена там, где вы его купили.
      </>
    ),
    signUp: "Создайте аккаунт",
    addDomain: "добавьте свой домен",
    name: "Введите новое имя на домене, который вы выбрали в Cloudflare. WireCat создаст в вашем аккаунте один туннель и одну эту DNS-запись; больше там ничего не изменится.",
    nameLabel: "Адрес на вашем домене",
    stays: (host) => <>Туннель для {host} останется в вашем аккаунте Cloudflare, пока вы не удалите его там.</>,
    making: "Создаём адрес…",
    make: "Создать адрес",
    unreadable: (error) => `Не удалось узнать состояние cloudflared: ${error}`,
    reading: "Узнаём состояние cloudflared",
    list: "Настройка туннеля Cloudflare",
    yours: (host) => <>{host} теперь ваш в Cloudflare.</>,
  },
}

const es: typeof en = {
  tailscale: {
    titles: {
      install: "Instala Tailscale",
      login: "Inicia sesión en Tailscale",
      funnel: "Permite Funnel",
      connect: "Conecta este servidor",
    },
    missing: {
      blocked: "Espera al paso anterior.",
      notInstalled: "Tailscale no está instalado en este ordenador.",
      noOperator: "Tailscale está instalado, pero solo el administrador puede cambiar sus ajustes.",
      notRunning: "Tailscale está instalado, pero no está en marcha.",
      needsLogin: "Este ordenador no ha iniciado sesión en Tailscale.",
      needsApproval: "El administrador de tu red Tailscale aún no ha aprobado este ordenador.",
      stopped: "Tailscale está desactivado en este ordenador.",
      starting: "Tailscale todavía se está conectando.",
      unknown: "Tailscale no ha dicho si tiene la sesión iniciada.",
      noHttps: "Los certificados HTTPS están desactivados en tu red Tailscale.",
      noFunnel: "Tu red Tailscale todavía no permite Funnel.",
      noHost: "Este ordenador no tiene nombre de Tailscale. Activa MagicDNS.",
      portsFull:
        "Todas las direcciones públicas de Funnel de este ordenador las usan otros servidores. Quita un Funnel que configuraras tú.",
    },
    opening: "Abriendo…",
    openTerminalMany: "Abrir un terminal con ellos",
    openTerminalOne: "Abrir un terminal con él",
    updatesRepo:
      "Añaden la fuente de actualizaciones de Tailscale, así que las actualizaciones del sistema mantienen Tailscale al día.",
    updatesPackage:
      "Es el paquete de Tailscale de tu distribución, así que las actualizaciones del sistema lo mantienen al día.",
    password: "Te piden la contraseña del ordenador.",
    instructions: "Instrucciones de Tailscale",
    instructionsLink: (link) => <>{link} (en inglés).</>,
    instructionsAndWiki: (link, wiki) => (
      <>
        {link} y la {wiki} (en inglés).
      </>
    ),
    nixosWiki: "wiki de NixOS",
    noCommands: (distro, page, binaries) => (
      <>
        Tailscale no da comandos para {distro}. Consulta su {page} o los {binaries} que funcionan en cualquier Linux.
      </>
    ),
    linuxPage: "página de instalación para Linux",
    staticBinaries: "binarios estáticos",
    nixos: "En NixOS, Tailscale forma parte de la configuración del sistema. Añade esta línea y vuelve a construirlo:",
    copyLine: "Copiar la línea",
    scriptTitle: "Instalar con el script de instalación de Tailscale",
    copyInstall: "Copiar el comando de instalación",
    scriptPassword: "Te pide la contraseña del ordenador, porque instala un servicio del sistema.",
    thenSource: (distro) => `Después añade la fuente de actualizaciones de Tailscale para ${distro}`,
    orCommands: (distro) => `O instala con los comandos de Tailscale para ${distro}`,
    commands: (distro) => `Instalar con los comandos de Tailscale para ${distro}`,
    noAutoUpdate: "Un paquete instalado con doble clic no se actualiza solo. Los comandos de abajo sí.",
    copyCommands: "Copiar los comandos",
    noSource:
      "Instalado sin la fuente de actualizaciones de Tailscale: las actualizaciones del sistema no lo actualizarán.",
    addSource: "Añadir la fuente de actualizaciones",
    operator:
      "En Linux, Tailscale solo obedece al administrador, salvo que nombres a tu usuario como su operador. Hazlo una vez: así WireCat puede iniciar sesión y activar Funnel sin pedirte la contraseña cada vez.",
    copyCommand: "Copiar el comando",
    operatorHow:
      "Pégalo en un terminal; te pedirá la contraseña del ordenador. WireCat no lo ejecuta por ti, porque cambia quién controla Tailscale. Luego vuelve aquí; el paso se comprueba solo.",
    why: "Tailscale da a este ordenador una dirección https fija en internet, para que ChatGPT o Claude en el navegador puedan llegar al servidor.",
    downloadMacos:
      "WireCat descarga el instalador oficial de Tailscale en Descargas y lo abre. Después el instalador de macOS te pide la contraseña del ordenador, porque Tailscale instala un servicio del sistema.",
    downloadWindows:
      "WireCat descarga el instalador oficial de Tailscale en Descargas y lo abre. Después Windows te pide la contraseña del ordenador, porque Tailscale instala un servicio del sistema.",
    downloadLinux:
      "WireCat descarga el paquete oficial de Tailscale en Descargas y lo muestra en tu gestor de archivos. Haz doble clic: tu app de software lo instala y te pide la contraseña del ordenador.",
    downloading: "Descargando…",
    downloadInstaller: "Descargar y abrir el instalador",
    downloadPackage: (ext) => `Descargar Tailscale (.${ext})`,
    checksum: "Desde pkgs.tailscale.com, verificado con la suma de comprobación de Tailscale.",
    saved: (path) => <>Guardado en {path}.</>,
    openedMacos:
      "El instalador de macOS lo ha abierto. Sigue sus pasos; te pedirá la contraseña él mismo. Después abre Tailscale desde Aplicaciones.",
    openedWindows:
      "Windows lo ha abierto. Sigue sus pasos; te pedirá la contraseña él mismo. Después abre Tailscale desde el menú Inicio.",
    shown:
      "Tu gestor de archivos lo muestra. Haz doble clic: tu app de software lo instala y te pide la contraseña. Si nada lo abre, ejecuta los comandos de abajo.",
    yourself: (link) => <>O descárgalo tú desde la {link}.</>,
    downloadPage: "página de descargas de Tailscale",
    notRunning: "Tailscale está instalado, pero no está en marcha.",
    startService: "Inicia su servicio una vez; después arrancará con el ordenador:",
    openAppMacos: "Abre la app de Tailscale desde Aplicaciones y vuelve aquí.",
    openAppWindows: "Abre la app de Tailscale desde el menú Inicio y vuelve aquí.",
    approval:
      "Has iniciado sesión, pero tu red Tailscale pide a su administrador que apruebe cada ordenador nuevo. Si eres tú, aprueba este en la página Machines.",
    machines: "Abrir la página Machines",
    stoppedMacos:
      "Tailscale está desactivado en este ordenador. Actívalo desde el icono de Tailscale en la barra de menús.",
    stoppedWindows:
      "Tailscale está desactivado en este ordenador. Actívalo desde el icono de Tailscale junto al reloj.",
    stoppedLinux:
      "Tailscale está desactivado en este ordenador. Actívalo desde el icono de Tailscale o con este comando.",
    login:
      "Pulsa Iniciar sesión. El navegador abre una página de tailscale.com que te pide entrar con Google, Microsoft, GitHub, Apple o una llave de acceso. ¿Nuevo en Tailscale? La misma página crea una cuenta. Este paso termina solo cuando acabes allí.",
    waiting: "Esperándote en el navegador…",
    pageAgain: "Volver a abrir la página",
    stop: "Detener",
    logIn: "Iniciar sesión",
    https:
      "Funnel necesita direcciones seguras (https) en tu red Tailscale. En la página DNS, activa MagicDNS si está desactivado y luego, en HTTPS Certificates, elige Enable HTTPS.",
    dns: "Abrir la página DNS",
    certLog:
      "Tailscale avisa de que los nombres de los ordenadores aparecerán entonces en un registro público de certificados.",
    funnel:
      "Funnel es lo que permite que internet llegue a una dirección de este ordenador. Las reglas de acceso de tu red deben permitirlo: en la página Access controls, abre la sección Funnel y añade Funnel a la política.",
    acls: "Abrir la página Access controls",
    stepDone: "Hecho",
    stepNotYet: "Todavía no",
    checking: "Comprobando…",
    check: "Comprobar",
    checkStep: (title) => `Comprobar: ${title}`,
    unreadable: (error) => `No se pudo leer el estado de Tailscale: ${error}`,
    reading: "Leyendo el estado de Tailscale",
    list: "Configurar Tailscale Funnel",
    fullGuide: (link) => <>{link} de este paso en wirecat.dev.</>,
    fullGuideLink: "Guía completa",
  },

  cloudflare: {
    privacy:
      "Cloudflare descifra el tráfico en sus servidores, así que Cloudflare puede leer lo que devuelven las herramientas, incluidos tus mensajes. Tailscale Funnel no puede: allí el cifrado termina en este ordenador.",
    titles: {
      install: "Descarga cloudflared",
      account: "Conecta tu cuenta de Cloudflare",
      address: "Elige la dirección",
    },
    missing: {
      blocked: "Espera al paso anterior.",
      unsupported: "Cloudflare no publica cloudflared para el procesador de este ordenador.",
      notInstalled: "cloudflared todavía no está en este ordenador.",
      noAccount: "WireCat todavía no está conectado a una cuenta de Cloudflare.",
      noAddress: "Todavía no hay ninguna dirección en tu dominio.",
    },
    unsupported: (link) => (
      <>
        Cloudflare no publica cloudflared para el procesador de este ordenador, así que esta vía no funciona aquí. Usa
        Tailscale Funnel o consulta {link}.
      </>
    ),
    downloads: "las descargas de Cloudflare",
    install:
      "cloudflared es el programa propio de Cloudflare que mantiene el túnel abierto. WireCat lo descarga de las versiones de Cloudflare en GitHub a su propia carpeta. No se instala nada en el sistema y no se pide ninguna contraseña.",
    downloading: "Descargando…",
    download: "Descargar cloudflared",
    stop: "Detener",
    checksum: "Verificado con la suma de comprobación de GitHub.",
    account:
      "Necesitas una cuenta de Cloudflare con tu propio dominio, es decir, que Cloudflare gestione el DNS del dominio. Pulsa Conectar: el navegador abre Cloudflare, inicias sesión, eliges el dominio para la dirección y pulsas Authorize.",
    waiting: "Esperándote en el navegador…",
    pageAgain: "Volver a abrir la página",
    again: "Conectar de nuevo para elegir otro nombre",
    connect: "Conectar Cloudflare",
    noAccount: (signUp, addDomain) => (
      <>
        ¿Aún no tienes cuenta o dominio allí? {signUp} y luego {addDomain}; los pasos de Cloudflare incluyen cambiar los
        servidores de nombres del dominio donde lo compraste.
      </>
    ),
    signUp: "Crea una cuenta",
    addDomain: "añade tu dominio",
    name: "Escribe un nombre nuevo bajo el dominio que elegiste en Cloudflare. WireCat crea un túnel y este único registro DNS en tu cuenta; nada más cambia allí.",
    nameLabel: "Dirección en tu dominio",
    stays: (host) => <>El túnel de {host} se queda en tu cuenta de Cloudflare hasta que lo borres allí.</>,
    making: "Creando la dirección…",
    make: "Crear la dirección",
    unreadable: (error) => `No se pudo leer el estado de cloudflared: ${error}`,
    reading: "Leyendo el estado de cloudflared",
    list: "Configurar un túnel de Cloudflare",
    yours: (host) => <>{host} ya es tuyo en Cloudflare.</>,
  },
}

export const tunnelMessages: Messages<typeof en> = { en, ru, es }
