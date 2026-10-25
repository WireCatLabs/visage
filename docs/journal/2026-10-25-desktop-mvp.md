# 2026-10-25 — WireCat Desktop MVP

Агент: `claude-opus-5.5` · ветка: `feat/desktop-mvp` · начато: `03:20` Europe/Madrid

---

## 1. Задачи

**TASK-1 · Построить первую версию WireCat Desktop по хендоффу (Tauri 2 + React, Impeccable)**
Статус: частично.
Интерфейс собран и проверен в браузере с заглушкой Rust: каталог шести инструментов, проверка Node.js и npm,
установка и обновление с прогрессом, детали инструмента, проверки здоровья по профилям, тёмная и светлая темы.
Rust-часть написана, но не скомпилирована: на машине нет пакетов сборки Tauri для Linux (NEED-2). Коммиты
`ddbe343`, `3183377`.

**TASK-2 · Фундамент: линтеры, слои, маленькие библиотеки (valibot), настройка для агентов**
Статус: сделано.
Стандарты WireCat скопированы из whatsapp-cli (`config/wirecat/`), Biome со слоями, lefthook, gitleaks, cspell,
markdownlint, Vitest, clippy pedantic, CI, `CLAUDE.md`, `AGENTS.md`, `docs/dev/ARCHITECTURE.md`.

**TASK-3 · Удаление инструментов и очистка хранилища**
Статус: сделано (в браузере); нативная часть не проверена.
Кнопка Uninstall в панели Manage, раздел Storage, предложение удалить данные после удаления последнего
инструмента. Коммит `44653a1`.

**TASK-4 · Финальное ревью дизайна Impeccable и DESIGN.md**
Статус: сделано.
Ревью отдельным агентом: «fix» (8 правок), два раунда оценки, итог «ship». DESIGN.md написан отдельным агентом по
коду (`8461a88`); найденный им дефект контраста точек в тёмной теме исправлен (`135a3ef`). Шаг hero в
`.impeccable/build/state.json` формально открыт: инструмент не даёт закрыть его при одобренных отступлениях
(«1 A»), это записано заметками.

**TASK-5 · Первая нативная сборка и запуск**
Статус: сделано частично.
Rust собрался с первого раза, clippy pedantic дал 12 замечаний, исправлено (`ee37aba`). `pnpm check` проходит
целиком. `pnpm app` открыл настоящее окно. Реальные установка, удаление и очистка хранилища ещё не прогнаны.

**TASK-6 · Второй круг: проводник по базе, навыки агентов, логи, баг-репорты, онбординг**
Статус: исследование (4 агента), сделаны открытие папок (`25cd682`) и строка загрузки (`b33daef`). Остальное ждёт
решений NEED-4…NEED-7.

**TASK-7 · Онбординг, Logs, Config, отправка баг-репортов; хендофф для wirecat-api**
Статус: сделано, в браузере и тестах; нативно не прогнано.
Онбординг и тур (`777e55c`…`d98d874`), Logs (`333fa07`…`19342b3`), Config (`2d139d9`) — агентами в отдельных
worktree. Отправка репортов — `report.rs` и `src/features/report/`. Контракт `docs/dev/report-api.md`, хендофф
`docs/dev/plans/2026-10-25-wirecat-api-handoff.md`. Агент по `skill status` и разбивкам `store info` (NEED-4 C)
работает в cli-base/cli-core.

- **TASK-8 · OpenClaw и Hermes как агенты, публикация коннекторов.** «I'd add OpenClaw and Hermes to agents as well. also let's build an integration for them in subagents - plan and let me review. And I think we should publish the connectors and update the docs and include that in desktop with activations etc. And we might want to publish the connectors/mcps smwhere». Статус: исследование тремя агентами (OpenClaw, Hermes, каталоги MCP и навыков), затем план на ревью в `docs/dev/plans/2026-10-25-agents-openclaw-hermes.md`. Hermes установлен здесь (`~/.hermes`, 0.21.0), OpenClaw — нет.

- **TASK-9 · Загрузка без сдвигов макета (UX-3).** «when elements start loading they arent the size of final versions eg tools load with small skeleton then appear cli name and then blocks expand … avoid layout shift. same in other pages. first find the solution in subagent, then use subagent for each page to fix that». Статус: агент фазы 1 измеряет сдвиги на каждой странице и строит общие заготовки в `src/ui`; затем по агенту на страницу (Tools — после слияния работы о совместимости хранилища).

- **TASK-10 · Кнопка «Report this» у каждой ошибки.** «when smth broke in wirecat appears - allow a butto to report it as well automatically». Статус: агент делает общий блок ошибки с кнопкой, заполняющей отчёт сам (инструмент, что сломалось, команда, версии), защиту страниц от падения отрисовки и сбор последних необработанных ошибок. Отправка — только по нажатию Send в заполненном окне.

- **TASK-11 · Резервная копия и очистка хранилища.** «Let's add buttons to backup the storage (create a local backup for now in say zip) and clear storage with confirmation warning.» Копия — собственной командой инструмента `store backup` (уже есть, VACUUM INTO) и сжатие в zip в Rust. Команды очистки всего хранилища нет (`store clear` убирает только покинутые чаты) — агент открывает PR в cli-core, а кнопка в приложении выключена с объяснением, пока инструменты её не знают. Перед очисткой — предложение сделать копию и ввод слова-подтверждения.

- **TASK-12 · Раунд правок интерфейса.** Слава: про «In use: uninstall the tool to delete its data»; MCP на Agents выглядит обязательным; непонятная кнопка Check у агента — «mb use Manage like in Tools»; кнопки назад/вперёд мыши; «Open terminal to sign in» — основной (фиолетовой) кнопкой, без аккаунтов ещё заметнее; Permissions в Tools — за видимым переключателем, подсветить несколько установленных копий, больше внимания аккаунтам; убрать «WhatsApp speaks it». Статус: один агент на все пункты (кроме Logs).

- **TASK-13 · Удаление инструмента спрашивает про данные; MCP не продвигать в приложении.** Слава: «Uninstalling keeps this data - but mb uninstalling should aks if user want to remove data» и «I'd not force mcp and stick with cli, and actually in desktop not promote it». Статус: агент — флажок «также удалить данные» в диалоге удаления (только папки этого инструмента, общий склад — нет, пока им пользуются другие), MCP в Agents — в «Advanced: MCP» внутри деталей агента.

## 2. Вопросы Славы

**ASK-1 · «the size of everything is too large… let's make stuff much smaller»**
Корневой размер шрифта уменьшен примерно на 20% (около 12.5px в окне по умолчанию), отдельно уменьшены
заголовки, высота строк, иконки, боковая панель и кнопки. Коммит `966988d`, DESIGN.md обновлён.

**ASK-2 · «on hover I don't see pointer cursor change… not sure we use soft transitions»**
Курсор и переходы были не везде (UX-1, UX-2). Исправлено одним базовым правилом, коммит `966988d`.

**ASK-3 · «when the app is loading the info about cli tools it should be visible»**
Рядом с заголовком строка с текущим шагом; проверка npm запускается одновременно с поиском. Коммит `b33daef`.

**ASK-4 · «we might need to install node, npm etc for users first… might we face some issues with permissions»**
Сейчас: плашка «нужен Node.js» со ссылкой на nodejs.org и плашка про npm, которому нужны права администратора.
Права: без sudo ставить в системную папку нельзя; Node из apt/Homebrew-под-root даёт EACCES. Решение — свой Node в
папке пользователя (NEED-5).

**ASK-5 · «manage configs via a separate menu item visually and via json editing (similar to what vscode allows)»**
Раздел Config: вкладки Settings и JSON поверх `<bin> <profile> config show --json`; сохранение идёт через
`config set`/`config unset`, файл приложение само не пишет. План:
`docs/dev/plans/2026-10-25-round-2.md`, раздел 8.

**ASK-6 · Welcome: «the next button should be bigger… a lot of space below… the overall window size might be smaller»**
Отдано агенту онбординга: большая кнопка под текстом, без пустоты, окно по умолчанию меньше.

**ASK-7 · «Connect in terminal - what does it do?» и Sign in «not clear what this is for, what user will get»**
Кнопка открывает терминал и запускает вход самого инструмента (`tg <профиль> setup`, `zm <профиль> session start`,
`drive <профиль> session start`). Экран переписывается: что даёт вход, что спросит инструмент, зачем имя профиля.

**ASK-8 · «in logs I don't see successful logs» и ещё 6 правок Logs**
Успешные запуски не хранятся: настройка `record` = false по умолчанию (проверено: tg 477 из 478 failed, max 500 из
500). Агент Logs добавляет переключатель «хранить все запуски» через `config set record true --defaults`, команды с
именем инструмента, порядок фильтров, объяснение событий, короткий JSON в строку, крупнее текст, group by у значения.

**ASK-9 · «for storage I still didnt see the database explorer»**
Ещё строится агентом Agents/Storage; CLI-разбивки готовы на ветке cli-core (FIND-8).

**ASK-10 · «for config page I'd show the default right away (and show the last seelcted one maybe)… move Storage, Logs and Config at the bottom of menu»**
Config открывается на последнем выбранном инструменте и виде, иначе — на «Defaults (all profiles)» первого
установленного. Профиль сам не выбирается (правило 3): только общие настройки или то, что выбрал владелец. Storage,
Logs, Config — внизу боковой панели.

**ASK-11 · «for logs search we need a docs page and I'd link to it after It does not mean everything is broken.»**
Страница `https://wirecat.dev/en/docs/desktop/logs` (en/es/ru) в cli-docs; ссылку ставит агент Logs. Текст
пишется после слияния Logs по итоговому синтаксису.

**ASK-12 · «can we set an agent session id for the run logs? is it hard?»**
Нет, не сложно: Claude Code передаёт `CLAUDE_CODE_SESSION_ID` дочерним процессам (видно в окружении этой сессии).
Писать его должен cli-core в run.json; агент `feat/run-context` в cli-core, затем колонка «Agent» в Logs.

**ASK-13 · «track full commands and separately all arguments… more info on what went wrong… endpoint, http code… error class… backtrace»**
Сейчас run.json хранит путь команды, профиль, код ошибки, число запросов — без аргументов и без деталей ошибки;
для нераспознанной команды пишется просто `max`. Тот же агент: `argv` с маскировкой содержимого, `error` {class,
message, http, provider, stack, cause}, затем блок «What went wrong» в Logs.

**ASK-14 · «database info in Storage - migration version, any issues… I asked you before to provide table data»**
Признаю: в Storage ушли итоги и разбивки, но не список таблиц, не миграции и не проверка здоровья. Агент
`feat/store-tables` в cli-core (список таблиц, история миграций, quick_check, свободное место, бэкап), затем блоки
Database и Tables в Storage.

**ASK-15 · «the memo, zoom, drive dont send logs, but they should»**
Все три уже зависят от cli-core. zm пишет запуски, но команды `runs` нет; drive и memo не пишут вообще. Агент
`feat/runs` в zoom-cli, drive-cli, cli-memo (+ экспорт в cli-core при нужде), затем шаблоны в каталоге приложения.

**ASK-16 · «do we really need successful logs or not care about this now?»**
Сейчас не нужны. Ответ: упавшие запуски — то, что нужно для диагностики; успешные полезны для статистики и для
случая «агент сказал, что сделал, а результата нет». По умолчанию оставить выключенными; переключатель в Logs есть.

**ASK-17 · «set a proper icon… in ubuntu I get a default gear… call it WireCat and allow finding it through apps»**
GNOME связывает окно с .desktop-файлом по app id; у Tauri на Linux это имя бинарника `wirecat-desktop`. Скрипт
`bin/install-desktop-entry` собирает релиз, ставит бинарник, иконки и ярлык «WireCat» в `~/.local` (без sudo),
`--remove` убирает. Запущен на этой машине: бинарник `~/.local/bin/wirecat-desktop`, ярлык проходит
`desktop-file-validate`. Проверить: Super → WireCat.

**ASK-18 · «give me hetzner ip»**
Сервера WireCat на Hetzner ещё нет (FIND-5), поэтому и IP нет; в проектах и заметках DevOps адреса тоже нет. IP
появится после создания сервера — в консоли Hetzner. Шаблон первого запуска:
`/home/leemour/Projects/DevOps/ubuntu_setup/server/hetzner/init-config.yaml`.

**ASK-20 · «there is no logo on icon… let's use my existing hetzner server»**
Иконки были пустым синим квадратом; теперь все размеры из `cli-docs/design/logo/png/mark-blue-1024.png`
(`tauri icon`), ярлык переустановлен (`ed0dae1`). Сервер: Hetzner 142.132.239.135 (AlignIO scheduler, Asturio, n8n;
`AlignIO/Code/scheduler/docs/DEPLOYMENT.md:3`, SSH `deploy@… -p 25222`). Записано в хендофф wirecat-api.

**ASK-21 · «report a problem needs design improvement… a tempate to fill… About dropdown shoulb empty by default and trigger validation error… I'd always send logs to our server… I don't think we need to let user select it» и «make report a problem a button next to ?»**
Агент переделывает диалог: шаблон (что делали / что произошло / что ожидали), «About» пустой и обязательный с
ошибкой, логи прикрепляются всегда с честным предупреждением, кнопка «Report a problem» рядом с «?». Ответ про
галочку: галочка не нужна, достаточно ясной строки. Но по GDPR владелец обязан сказать об этом в политике
конфиденциальности (NEED-16).

**ASK-22 · «list permissions in the cli block… see if they allowed write/read and easily toggle… if permissions are custom… partial write»**
Агент строит блок Permissions в панели Manage: группы (чтение, запись, отправка, удаление…) с состоянием
Allowed / Asks / Blocked / Partial и переключателем через `config set permissions.<путь>`; источник — команды
самого CLI (rule 1).

**ASK-23 · «how does the app identify language? … switch language easily on config? English, Spanish, Russian»**
Никак: интерфейс только на английском, переводов нет. План: язык системы при первом запуске (navigator.languages в
webview), иначе английский; переключатель в Config (раздел самого приложения); en/es/ru; термины — из
`cli-docs/docs/TERMINOLOGY.md`. Начинать после слияния текущих агентов: правка задевает почти все экраны.

**ASK-24 · Полоса прокрутки, колонки Logs, термины Storage, «What is in here», вопрос про Agents**
Прокрутка: WebKitGTK стилизует только `::-webkit-scrollbar`; ползунок был почти невидим на светлой теме и чёрным при
перетаскивании на тёмной — исправлено. Колонки Logs: минимальная ширина таблицы и отступы — исправлено. Storage
(одно слово «storage», значки папок у записей, откуда данные) — передано агенту базы данных. Отчёт об Email уходит под
memo с пометкой «About: Email»; чтение логов для отчёта параллельно, не дольше 10 с.

**ASK-25 · «make sure the repo is modular and isolated, add linters for that… layers… no huge files with SRP»**
Порядок: дождаться трёх агентов → переименовать в `wirecat-desktop` → один проход архитектуры (публичный вход у каждой
фичи, запрет прямых импортов между фичами, предел строк ~300 на файл с тестом-исключением, сложность функций,
границы модулей в Rust) → перевод en/es/ru. Подробности — DEBT-1.

**ASK-26 · «do we depend on tg to get store info or all clis can do it in new releases via core update?»**
Зависим: `store info` есть только у tg, max, wa (группа команд мессенджеров в cli-core); memo и zm отвечают общей
справкой, у drive `store` — про его старую базу. Приложение спрашивает первый установленный из tg, wa, max. Агент
переносит `store info` (только чтение, работает и со схемой новее) в общую часть cli-core — после выпуска будет у всех
шести.

**ASK-27 · «in Tools I'd check compatibility against the store»**
Тот же агент: на странице Tools у каждого инструмента — может ли он читать хранилище (схема), предупреждение перед
обновлением, которое поднимет схему и отрежет старые копии других инструментов (то, что случилось в 15:05), с
предложением обновить и их.

**ASK-28 · «a lot of noise in config bc of task_categories… it's a global config not a profile, I'd separate them»**
Проверено на tg 0.91.0: `config show` — 26 настроек профиля и 65 общих (`store_settings`), из них 59
`task_categories.*` со `scope: shared`. Агент выносит общие настройки в отдельный вид «WireCat (shared)» с отдельным
редактором категорий задач; из видов профиля они уходят.

- **ASK-30 · «explain why not just wirecat/tg? what are name patterns, why dev».** Ответ: в реестре MCP имя — `<пространство>/<сервер>`, и пространство должно доказывать владение: `io.github.<org>` — вход через GitHub, или домен наоборот (`dev.wirecat` = wirecat.dev) — запись TXT в DNS или файл `/.well-known/mcp-registry-auth`. Голое `wirecat/` ничем не подтверждается, поэтому не принимается. Источник: https://modelcontextprotocol.io/registry/authentication

- **ASK-31 · «I still don't see the tables count/sizes etc displayed in storage, and I dont see data like segments in messages by cli or similar. is smone working on it?»** Ответ: экран готов, данных нет, потому что установленные инструменты этих команд ещё не знают. Разбивка (cli-core #1959) слита в 16:33, после выпуска 0.424.0 (16:10) — ждёт следующего выпуска cli-core. Таблицы (cli-core #1967) открыты, CI падает — их ведёт агент выпуска. После выпуска cli-core нужно обновить tg/max/wa и поставить новые версии.

- **ASK-32 · «exclude no command from the logs filter / also did we improve the log fields? what will be added?»** Ответ: запуски без команды скрываются по умолчанию (снимаемый фильтр, счётчик скрытых) — передано агенту Logs. Поля журнала: cli-core #1963 слит и выпущен в 0.425.0 (17:08): `cli_command`, `argv` с маскировкой, `unknown_command`, `agent {kind, session_id}`, `error {class, code, reason, message, operation, http {method, endpoint_template, status}, provider, causes, stack}`. Приложение их уже показывает (ветка feat/logs-run-context слита). Чтобы появились — tg/max/wa/zm/drive/memo должны перейти на cli-core 0.425.0 и выйти; `http.method`/`endpoint_template` ещё требуют правок в max-cli, tg-cli, whatsapp-cli (транспорт), после выпуска.

- **ASK-33 · «will uninstall remove the data?»** Ответ: нет. Удаление программы запускает только `npm/pnpm uninstall` (`src-tauri/src/install.rs`, `uninstall_steps`); данные остаются. Когда ни один установленный инструмент папку не использует, её можно удалить на Storage после подтверждения (правило 5 в CLAUDE.md). Надпись перефразируется.
- **ASK-33.a · «can we install mcp server for the web browser from here?»** Ответ: можно — приложение может добавить чужой MCP-сервер в агента его же командой (`claude mcp add …`, `codex mcp add …`), как добавляет серверы WireCat. Решение — NEED-40 / IDEA-6.

- **ASK-34 · «explain why we need separate clients? … hermes and openclaw should have their own registries, connectors, shall we register there … why mcp server? cli is just better, mcp is only needed for remote access».** Ответ: «клиент» в `mcp add` — это агент, в чьи настройки инструмент умеет записать свой MCP-сервер; у каждого агента свой способ (claude/codex — свои команды, Hermes — YAML и вопросы, OpenClaw — команда, запрещённая при работающей службе). Раз MCP не продвигаем, новые клиенты не нужны — план переписан: подключение = навык + проверка PATH. Экосистемы: OpenClaw → ClawHub (`openclaw skills install @wirecat/tg`, публикация `clawhub skill publish` из CI, сканы безопасности, MIT-0; плагины не нужны); Hermes → источники навыков (`hermes skills install`, `tap add`, поиск по ежедневному индексу из skills.sh/ClawHub/tap; наш `wirecat.dev/.well-known/skills/index.json`; позже PR в Nous). План: `docs/dev/plans/2026-10-25-agents-openclaw-hermes.md`.

## 3. Находки

**RISK-1 · zm и memo установлены дважды: npm и pnpm**
Копия npm идёт первой в PATH. Приложение показывает обе и обновляет через тот менеджер, которому принадлежит
копия. Проверено: `pnpm ls -g` и `npm ls -g` на этой машине.

**RISK-2 · Удаление инструмента не останавливает его фоновые службы**
cli-core умеет ставить systemd-юниты (`tg server install`, таймеры архива, `memo timer`). После удаления пакета
юнит останется и будет указывать на несуществующую программу. Не проверено, только чтение кода cli-core.

**FIND-1 · У CLI нет команды удаления данных**
Ни в одном из шести нет `uninstall`/`purge`; папки данных считаются по `resolvePaths` из cli-base
(`cli-base/src/paths.ts:59`). `storage.rs` повторяет эту логику — её нужно держать в синхроне.

**FIND-2 · `~/.cache` полон посторонних файлов с похожими именами**
`tg-*.txt`, `wa-*.log` и т. п. — рабочие файлы агентов. Поэтому удаление идёт только по вычисленным путям, никогда
по маскам.

**UX-1 · Не было курсора-руки на кнопках**
Tailwind v4 больше не ставит `cursor: pointer` кнопкам, а `body` ставил `default`. Теперь базовое правило в
`src/styles/index.css` для кнопок, ссылок, `summary` и подписей к полям.

**UX-2 · Плавные переходы были только у части элементов**
Кнопки и меню уже плавно меняли цвет (150 мс), ссылки и раскрывашки — нет. Теперь у всех по умолчанию.

**FIND-3 · Хранилище одно: `~/.local/share/WireCat/wirecat.db`, 3.24 ГБ, схема 29**
Telegram, WhatsApp, MAX, почта, Drive, Zoom пишут туда. Разбивка: `accounts.provider`, `chats.kind`,
`messages.sent_at`. `tg store info --json` даёт итоги за 99 мс, разбивок по мессенджерам нет ни в одной команде.
`dbstat` (размер таблиц) идёт 39 с — не в живом интерфейсе. Схема: `cli-core/src/store/sqlite/schema.ts`.

**FIND-4 · Навыки ставятся только в два места: `~/.claude/skills` и `~/.agents/skills`**
`<bin> skill install --for claude|agents|all`. Версия — `metadata.version` во frontmatter. Устарели: max (0.66 при
0.74), wa (0.1 при 0.6), drive (0.28.1 при 0.29), memo (0.93 при 0.102). Команды статуса с JSON нет.

**FIND-5 · Серверной части у WireCat нет**
wirecat.dev — статика на Cloudflare Pages; GitHub App нет; токен Cloudflare только на Pages.

**BUG-2 · `memo --help` падает с `command.crashed`; `memo help` работает**
Найдено агентом, не воспроизведено мной.

**RISK-3 · `wirecat-backup.service` в состоянии failed**
Последний запуск резервной копии архива упал. 1.65 ГБ старых копий (`backups/*.db`, `~/.cache/max-cli/*.db`).

**FIND-6 · zm пишет журналы запусков, но команды `runs` у него нет; drive и memo журналов не пишут**
Страница Logs покажет для них пустое состояние. Недостающая команда — дело CLI (правило 1).

**FIND-7 · `command` = имя инструмента в 82 запусках tg и 372 max**
Это запуски без распознанной подкоманды (опечатка или нет профиля). Показываются как «max (no command)».

**FIND-8 · `skill status` (cli-base `ba9d3a8`) и разбивки `store info` (cli-core `d11d6563`) готовы на ветках**
Не отправлены. До пользователей дойдут цепочкой выпусков: cli-base → cli-core (с 0.53 через 0.55) → tg/max.
`store info` теперь открывает базу только на чтение. В базе есть провайдер `chat` с 4 сообщениями — похоже на
тестовые данные, не тронуто.

**BUG-3 · «Keep failed runs only» ставил `record false`, а это выключает и логи упавших запусков**
`cli-core/src/cli/settings.ts:521`: упавшие хранятся, только когда `record` true или по умолчанию. Исправлено на
`config unset --defaults record` (коммит после `f2c8159`). Нашёл агент документации, подтверждено по коду.

**FIND-9 · Фоновая синхронизация memo падает с 15:09: архив на схеме 33, установлен memo 0.102.0 (читает до 29…32)**
В 15:05:15 что-то на cli-core ≥0.420 открыло `wirecat.db` и подняло схему до 33 (`schema_migrations`, только чтение).
Это обычное обновление вперёд. memo 0.103.0 (опубликован 13:19 UTC, cli-core 0.420.0) читает 33. Кто именно открыл
архив — не установлено: не `wa serve` (запущен в 02:43). Нашёл агент Email.

**FIND-10 · Ряд Email** — `partOf: memo`, общий пакет; почтовые запуски в Logs под Email; вход только копированием
`memo mail add <имя> <адрес>` (интерактивного входа у memo нет). Коммиты `d2cae10`…`5c6917e`. Пробелы в cli-memo:
вход без адреса, JSON-список почтовых ящиков, проблемы doctor по областям, источник у `sync`. В
`cli-docs/content/docs/email.mdx` неверная команда импорта.

**IDEA-1 · Agents: подключение MCP для каждого агента** — показать, зарегистрирован ли сервер MCP инструмента у
Claude Code и Codex (`<bin> mcp add` в cli-base уже знает их), и добавить/убрать одной кнопкой.

**IDEA-2 · Agents: что делал агент** — сеансы агента из журнала запусков (новые `agent.kind`/`session_id`): сколько
команд, какие упали, переход в Logs с фильтром по сеансу.

**IDEA-3 · Agents: проверка связки** — видит ли агент инструмент в своём PATH, есть ли навык, подключён ли MCP,
разрешены ли нужные команды; одна кнопка «Проверить», список того, что исправить.

**IDEA-4 · Agents: задачи, взятые агентами** — какие задачи (`tasks`) держит какой сеанс агента, и освободить
зависшие.

**IDEA-5 · Agents: просмотр навыка** — что именно в навыке, и что изменится при обновлении (разница версий).

**BUG-4 · Logs показывал ошибку memo сырым JSON вместо «arrives with the next update»**
Ответ CLI читался шестью разными способами; один не находил JSON после строки предупреждения. Теперь один
`Output::json()` в `run.rs` для всех, плюс Logs разворачивает JSON-ошибку. memo после `bin/update-memo` — 0.103.0,
синхронизация снова идёт (последний запуск: 9 новых писем).

**ASK-14 · итог** — Storage: блоки «Storage file» (файл, WAL, режим журнала, схема, свободное место, последний бэкап,
история миграций, проверка здоровья по кнопке) и «Tables» (поиск, сортировка, размеры по кнопке), одно слово
«storage», источники «via tg/wa/…», значки открытия у записей. cli-core#1967 (draft), cli-base#334 (draft, слово
`tables` в словаре — нужно одобрение владельца). Приложение `7d3d717`, `93bf62c`. Замеры: `store tables list` 4.5 с
холодный / 40 мс тёплый; размеры 0.8 с тёплый; `store check` 90–100 с.

**RISK-4 · «Check health» запускает `store check` на живом файле, который открывается на запись**
Новая версия инструмента при таком открытии поднимет схему (как в 15:05, FIND-9), и старые копии других
инструментов перестанут читать хранилище. Запускается только по кнопке. Лучше — открытие только для чтения в
`store check` (как сделано для `store info` в cli-core#1959).

**DEBT-1 · Границы модулей в приложении не проверяются так строго, как в cli-core**
cli-core: `noRestrictedImports` на каждый слой и предел строк на файл в `biome.json`. Здесь: слои domain/platform/ui
закрыты, но фичи импортируют друг друга напрямую (`../tools/` 14 раз, `../system/` 7, по одному storage/report/agents),
предел — 1000 строк из общей базы. Крупнейшие: `onboarding/steps.tsx` 487, `platform/mock.ts` 485,
`ConfigPage.tsx` 448, `domain/runs.ts` 447; Rust `node.rs` 575, `archive.rs` 500, `settings.rs` 456. В Rust границ
модулей нет вовсе. План (ASK-25): переименование → проход по архитектуре → языки.

**FIND-11 · Блок Permissions** (ASK-22) — уровни deny / readonly / ask / allow на путь команды (`cli-core/src/sends/
permissions.ts`), самый точный ключ выигрывает; ответ первой настройки «только чтение» ограничивает всё. Источники:
`config show --json` (что задал владелец) и `commands --json` (с cli-core 0.408 — можно ли профилю команду и почему).
Установленные tg 0.84, max, wa старые — на этой машине виден только запасной вид. Коммиты `668c31b`, `5df75ce`.

**FIND-12 · Пробелы в cli-core для разрешений** — `commands --json` не отдаёт уровень и ключ для разрешённых команд
(«Asks first» по умолчанию не видно); `contacts context` проверяется как `messages`, `attachments check` не проверяется
вовсе; уровни бота живут отдельно в `--bot`; `tg commands schema` пропал в 0.91.

**SEC-1 · Маскировка ключей скрыла бы уровни `account.*`** — уровни теперь проверяются по форме, а не по имени ключа.

**RISK-5 · Инструменты наследовали `TG_PROFILE` и другие `*_PROFILE` из окружения приложения** — инструмент мог бы
выбрать профиль за владельца. Исправлено: `run::command` убирает `<PREFIX>_PROFILE` всех инструментов, тест на шесть.

**BUG-5 · Установка зависала на «Verifying»**
`#[serde(rename_all = "camelCase")]` на перечислении переименовывает только варианты, не поля: событие `done` уходило
с `shadowed_by`, схема в интерфейсе требовала `shadowedBy`, разбор падал, событие молча терялось. Браузерная заглушка
отдаёт правильные имена, поэтому тесты не ловили. Исправлено `rename_all_fields`, тест на JSON; интерфейс теперь
показывает нечитаемое событие как сбой, а не теряет его. Первый настоящий запуск установки в окне — у владельца.

**FIND-13 · pnpm 11 ставит только версии старше суток** (`minimumReleaseAge` = 1440 минут по умолчанию с pnpm 11,
https://pnpm.io/settings#minimumreleaseage). tg 0.86…0.91 вышли за последние сутки — pnpm поставил 0.85.0, а
приложение проверяет новые версии через `npm view`, без этой задержки, и предлагает обновление, которое pnpm не
поставит.

**FIND-14 · Страница Agents: все пять идей** (`09f072e`, `3119474`, `829248b`). Подключение MCP —
`<bin> <профиль> mcp add claude-code|codex`, отключение — `claude mcp remove` / `codex mcp remove` только для имён
`<bin>-<профиль>`; список серверов: `codex mcp list --json`, файлы Claude Code / Cursor / Gemini / OpenCode (только
имена). Сеансы из журналов запусков; «Check» — PATH терминала, навык, `mcp check`, заблокированные команды; задачи —
`tasks list --json=id,key,claimed_by,claimed_until` без заголовков, освобождение `tasks release`. Пробелы в CLI: нет
`mcp remove` и статуса в cli-core/cli-base, `claimed_by` не в полях поиска задач, у memo нет claim/release, навык нельзя
показать установленным. На машине: WireCat-серверов MCP ни у одного агента нет; tg 0.84 и wa 0.6 слишком старые для
`mcp add`.

- **BUG-6 · Обновление навыка Memo падает: «unknown option '--json'».** Скриншот Славы, Agents → «Update the Memo skill for Claude Code?». У memo нет общего `--json` (у tg/max/wa/zm/drive есть), и его `skill install`/`skill show` берутся из cli-base без `--json` (`/home/leemour/Projects/AI/cli-memo/src/program.ts:202-217`). Ни один выпущенный инструмент пока не знает `skill status` (cli-base #332 ещё не выпущен), поэтому статус идёт через `doctor`. Исправлено в приложении: для memo каталог зовёт `skill install`/`skill show` без `--json`, а `skills.rs` читает напечатанный SKILL.md как есть. В memo `--json` для `skill` — передано агенту выпуска.

- **FIND-15 · Hermes не видит навыки WireCat сам.** Hermes 0.21.0 читает `~/.hermes/skills` и папки из `skills.external_dirs` (пусто по умолчанию), но не `~/.agents/skills` и не `~/.claude/skills`. Здесь `~/.hermes/skills/tgcli` — ручная ссылка на `~/.agents/skills/tgcli`. OpenClaw читает `~/.agents/skills` сам. План: `docs/dev/plans/2026-10-25-agents-openclaw-hermes.md`.
- **RISK-6 · npx и глобальная установка — две копии.** Каталоги MCP обычно запускают сервер через `npx`, а вход и хранилище принадлежат глобальной установке; `mcp add` уже отказывается работать из кэша npx. См. NEED-30.
- **RISK-7 · ClawHub после ClawHavoc.** В феврале 2026 341 из 2 857 навыков ClawHub оказались вредоносными; скан прячет навык, если шаги установки и переменные не объявлены.

- **PERF-1 · Данные грузятся несколько секунд.** Слава: «the data loads quite slow - a few seconds, why is that? I thought clis should respond almost instantly». Итог (замерено, машина под нагрузкой 12–36 на 24 ядрах): сами команды дешёвые и в сеть не ходят (strace), но каждый процесс CLI 0,5–0,9 с грузит свою программу целиком до разбора аргументов — `tg --version` грузит 2 009 модулей, из них ~0,4–0,55 с — общий файл cli-core, импортирующий все команды. Страница запускает 3–31 таких процессов, иногда в 2–3 раунда подряд; Tools, Storage и Agents повторяют всё при каждом заходе (кэша нет). Время до данных: Tools 1,5–2,2 с, Storage 1,5–2,1, Logs 1,6–2,2, Config 1,6–5,0, Agents 3,6–6,0. Исправления по выигрышу: (1) CLI: `--version` до импортов, ленивая загрузка команд, бандл — в cli-core/cli-base; (2) приложение: показывать прошлый результат сразу и обновлять в фоне; (3) кэш версии по пути и времени файла; (4) Config без лишнего `account list` для общих настроек, Agents — одна команда вместо 9 `tasks list`; (5) помнить «команда не поддерживается в версии X»; (6) ограничить число одновременных запусков на Agents; (7) расширить `doctor --json`; (8) Storage не переопределяет инструменты заново; (9) чтение login shell в фоне при старте; (10) кэш `npm view` на час. Скрипты: scratchpad `perf/`. Результат замера по правилу Projects/AI ещё надо положить в cli-testing (`performance/desktop/loading/`). Ответ Славы: «1 A / 2 A / 3 wait I ll review» Быстрый старт CLI (PR, не слиты): cli-core #1990 (вход `@wirecat/cli-core/cli/start`, 52 файла вместо 837; голый `--version` без загрузки программы; проверка ≤80 файлов в CI), tg-cli #718 (mtcute только при подключении: все команды tg ~200 мс быстрее уже сейчас), drive-cli #229, whatsapp-cli #251, cli-testing #228 (замер). После выпуска cli-core и одной строки в каждом bin: `--version` у tg/max/wa 56–73 мс вместо 560–970. Остальные команды по-прежнему грузят ~880 файлов cli-core (~400 мс) — решение в NEED-38. Слава одобрил слияние и выпуск этих PR («2 A»); передано агенту выпуска. — исправления в приложении (агент, отдельная ветка) и PR в cli-base/cli-core о быстром старте (агент; замер в cli-testing; без слияния до ревью). Волна 1 OpenClaw/Hermes ждёт ревью плана.

- **UX-4 · Список «About» в отчёте об ошибке некрасивый.** Слава: «about dropdown doesnt look pretty, need to style it including options and align text etc». Причина: родной `<select>` с группами; в WebKitGTK открытый список рисует система, CSS его не меняет. Агент делает общий `Select` в `src/ui` и заменяет им все родные списки (отчёт, Logs, Permissions, Config).

- **UX-5 · В правах «Tool default» вместо настоящего уровня.** Слава: «in permissions I see Tool default - instead why dont we show the actual permissions. if mixed we can use a standard status like partial write or similar». Сделано: пустой пункт списка показывает действующее состояние, которое сообщил инструмент («Read only (default)», «Partial write (default)»); «Tool default» остался только когда инструмент не говорит. Статус «Partial» стал «Partial write»/«Partial read». И: «also let's style all dropdowns so they aren't native and look nice» — передано агенту UX-4, все `<select>`.

- **RISK-8 · Диск заполнен на 98% (7,5 ГБ свободно).** Каждый рабочий каталог агента собирает Rust заново: `src-tauri/target` ~5 ГБ, 13 уже слитых каталогов держат ~69 ГБ. Агент выпадающих списков не смог прогнать clippy и тесты Rust. Скрипт `bin/free-build-space` (без `--yes` только перечисляет) удаляет только папки сборки слитых, незанятых, чистых каталогов — ждёт подтверждения Славы. Дальше: общий `CARGO_TARGET_DIR` для агентов. Ответ: «1 A» — запущено: удалено 69 ГБ, свободно 75 ГБ (80%). Работающим агентам велено собирать с `CARGO_TARGET_DIR=/home/leemour/Projects/AI/visage/src-tauri/target`.

- **FIND-16 · Где страницы прыгают при загрузке (UX-3, замер).** Общие заготовки слиты (`Skeleton chars`, `StableText`, `.reveal`, запас под полосу прокрутки, ожидание шрифтов ≤500 мс; раздел «Loading without layout shift» в `docs/dev/ARCHITECTURE.md`; `scripts/layout-shift.mjs`). Замер при замедлении ×3: список Tools уже стоит (0.0002); прыгают Tools → Manage (0.058), Agents (0.122, +489 px), Storage (0.084, +406), Logs (0.084, +289), Config (+713 px роста), онбординг Sign in (0.056). Общая причина «шрифт подменяется» исправлена для всего приложения.

- **PERF-2 · Storage спрашивает каждый инструмент дважды.** Сводка хранилища и новая проверка совместимости (слита, Tools показывает, какие инструменты не читают схему 33) обе запускают `store info` у каждого установленного инструмента. Не ломает, но удваивает ожидание. Передано агенту скорости загрузки.

- **FIND-17 · Слито: кнопки «Report this», загрузка без сдвигов (Config, Logs, онбординг), скорость загрузки.** Report this — у каждой ошибки, плюс экран «Something broke on this page» и последние 10 необработанных ошибок окна во вложении `appErrors`. Сдвиги: Config +713 px → 0; Logs 0.084 → 0.074 (остаток — вставка поздних запусков, NEED-34); онбординг Sign in 0.0545 → 0.0049, Agents 0.0103 → 0.0003. Скорость: повторный заход на Tools — 0 процессов (было 16), Storage 7 (было ~21), таблица навыков на Agents 0,7–2,1 с (было 3,3–5,2), не больше половины ядер процессов разом. Замер: `cargo test --lib -- --ignored --nocapture page_loads`. Итог `pnpm check`: 161 + 81 тест. Storage: 0.084 / +406 px → 0 / 0 px (слито позже; баннер совместимости получил постоянное место 2.75rem). Tools: 0.023 / +66 px → 0.001 / 0; Tools → Manage 0.038 → 0 (строки прав из каталога, баннер в постоянном месте 3.4rem). Остаётся: кнопка «Manage» → «Update to x» шире на 32 px — смена смысла, не загрузка. Agents: 0.1236 / +489 px → 0.0021 / 0; повторный заход 0.0475 → 0.0010. Строки всех пяти известных агентов видны всегда («Not found on this computer» у ненайденных); заметка «This version cannot report…» под таблицей; «Tasks held by others» и старые запуски — ниже навыков.
- **SEC-3 · Политика конфиденциальности не упоминает `appErrors`.** Отчёт из ошибки теперь прикладывает последние 10 ошибок окна; `cli-docs/lib/privacy.ts:45` перечисляет только неудачные запуски и журнал установки. Исправляю PR в cli-docs.

- **FIND-18 · Команда очистки хранилища уже была: `store reset`.** Удаляет `wirecat.db` с `-wal`/`-shm` и создаёт пустое хранилище текущей схемы; по умолчанию кладёт копию рядом; отказывает, пока файл держит сервер или другой процесс. Новой команды не понадобилось: cli-core #1986 добавляет `--dry-run` (файлы, байты, таблицы с числом строк, `in_use`) и требует `--allow-dangerous` для `--no-backup`. Приложение (слито, TASK-11): «Back up now» — `store backup` инструмента, сжатие в `~/WireCat backups/wirecat-store-YYYY-MM-DD-HHMM.zip` (права 600), проверка места ×1,5, прогресс, отмена, список копий; «Clear storage» — выключена, пока инструмент не знает `--dry-run`, диалог со всеми таблицами, «Back up first» по умолчанию, ввод `clear`. Тест на копии хранилища: 7,0 МБ → 117 КБ zip.
- **RISK-9 · После очистки `memo-import.timer` снова наполнит хранилище** заметками и почтой при следующем запуске. Диалог говорит об этом общими словами.
- **RISK-10 · Падение приложения посреди копии оставляет скрытую частичную копию** (до размера хранилища) в `~/WireCat backups`; список её не показывает.
- **BUG-7 · Проверка орфографии падала на `modelcontextprotocol` в плане OpenClaw/Hermes.** Слово добавлено в `cspell.json`.

- **IDEA-6 · (отклонено, NEED-40 B) Рекомендуемые MCP-серверы не от WireCat (браузер).** Например Playwright MCP (`@playwright/mcp`) или Chrome DevTools MCP — ставить в выбранного агента его же командой, со страницы Agents. Вне продукта WireCat (данные владельца), поэтому только по решению NEED-40.

- **UX-6 · Строки «Keep every run…» в Logs длинные и странные.** Слава: «mb make smaller blocks for each cli with name and color for status or smth and a dropdown toggle to switch to keep all etc». Передано агенту Logs: компактные плашки (значок, имя, цветная точка состояния) с выпадающим списком «Failed runs only» / «Every run»; «только неудачные» по-прежнему через `config unset --defaults record` (BUG-3).

- **UX-7 · Tools — домашняя страница, но не объясняет, что это и что делать.** Слава: «since Tools is homepage I'd first say smth like what this page is about, what the tool does, what the CLIs are and what to do here, and event more info here on first launch and/or when there are not tools installed etc or offer to install more». Передано агенту раунда интерфейса: короткое вступление (скрываемое), полное пустое состояние с кнопкой «Choose tools to install», предложение установить остальные инструменты.

- **FIND-19 · Logs: снимок, Live, скрытые запуски без команды, плашки хранения — слито.** Сдвиг 0.0738 → 0.0007. Поиск и фильтры работают по уже прочитанным запускам (без новых процессов); «Read again» и Live перечитывают; медленный инструмент через 8 с помечается «did not answer in 8 s», его поздний ответ подхватывается следующим раундом без второго процесса. Live: каждые 5 с после конца раунда, пауза когда окно скрыто, строка раскрыта или выделен текст; новые запуски сверху или за кнопкой «N new runs». По умолчанию `-no_command:true` со ссылкой «Show them»; переход к сессии с Agents тоже прячет запуски без команды (решил сам — по смыслу просьбы Славы). Плашка «слишком старый, чтобы сказать» пока красная, не янтарная.

- **FIND-20 · Пароль для резервных копий слит (NEED-37 A).** «Protect with a password»: два поля, подсказка силы, предупреждение «If you lose it, the backup cannot be opened. WireCat does not keep it.» Приложение зовёт `store backup --encrypt` инструмента и передаёт пароль через стандартный ввод — не в аргументах, окружении, событиях и журналах; копия в Rust затирается. Файл `wirecat-store-YYYY-MM-DD-HHMM.db.sealed`, без второго zip, с замком в списке; восстановление `tg store restore <file>.db.sealed`. Проверено на временном хранилище.
- **RISK-11 · Остановка шифрованной копии оставляет полную незашифрованную копию хранилища** `<store>.db.backup-<pid>` рядом с ним (замерено агентом на 420 МБ). Ошибка cli-core: https://github.com/WireCatLabs/cli-core/issues/1998. Пока исправлено в приложении: во время шифрования кнопки «Cancel» нет, вместо неё «Can't stop» (решил сам — безопасный вариант).
- **FIND-21 · Два теста Logs падали под нагрузкой ≥15.** Медленный инструмент ждал через `sleep` с запасом 200 мс до предела 2 с; счёт раундов Live снимался до старта всех чтений. Теперь инструмент отвечает по сигналу теста, а Live проверяет «не больше чтений разом, чем инструментов». Три прогона подряд под нагрузкой 16 — зелёные.

- **FIND-22 · Раунд интерфейса слит (TASK-12, UX-7, NEED-39).** Storage: «Used by Telegram. Uninstalling keeps this data». Agents: MCP помечен «(optional)», его отсутствие не в «What to fix»; агенты — карточки с цветной точкой и «Manage», детали под сеткой, «Seen in runs» для замеченных в запусках; убраны кнопка Check в строке и «Agents this app knows». Назад/вперёд: кнопки мыши 3/4, Alt+←/→, Cmd+[/] — история разделов в памяти. «Open terminal to sign in» — основная кнопка; без аккаунтов — «No account yet…». Tools → Manage: сначала аккаунты, Permissions свёрнуты с итогом в одну строку, «2 copies installed» с командой удаления лишней копии. Storage: «X speaks it» убрано. Tools: вступление (скрываемое) и «Choose tools to install» при пустом списке. Карточка агента жёлтая, если неисправна часть инструментов, красная — только если все (решил сам, по цветовой схеме Славы). Не проверено: настоящие кнопки мыши в окне приложения.

## 4. Вопросы к Славе

**NEED-1 · Можно ли отступить от одобренного макета: Cancel вместо Install во время установки и настоящие описания?**
- Сейчас: проверка макета Impeccable держится на этих двух местах.
- Варианты: **A** принять оба · **B** повторить макет дословно.
- Я бы: **A**.
- Ответ: «1 A» — принято.

**NEED-2 · Запустить `bin/install-linux-deps` в своём терминале?**
- Сейчас: Rust не собирается, нет `webkit2gtk-4.1` и `dbus-1`.
- Варианты: **A** запустить · **B** отложить.
- Я бы: **A**.
- Ответ: запущено, пакеты стоят (`pkg-config` видит webkit2gtk-4.1 2.52.6).

**NEED-3 · Отправить ветку `feat/desktop-mvp` на GitHub и открыть PR в `main`?**
- Сейчас: на удалённом репозитории веток нет, первая отправка создаст `main`; всё лежит только локально.
- Варианты: **A** отправить и открыть PR сейчас · **B** после настоящей установки и удаления в окне.
- Я бы: **B**.
- Ответ: «1 A» (см. ниже).

**NEED-4 · Откуда брать данные о навыках и о содержимом базы: сначала дописать CLI или читать самим?**
- Сейчас: команды статуса навыков нет; `store info` даёт только итоги, без разбивок по мессенджерам, типам чатов,
  аккаунтам.
- Варианты: **A** сначала CLI: `skill status --json` в cli-base и разбивки в `store info` cli-core, потом выпуск
  всех CLI, потом экраны · **B** приложение само читает SKILL.md и базу (только чтение) — это нарушает правило 1 в
  CLAUDE.md и привязывает приложение к схеме 29 · **C** экраны сразу на том, что есть (`store info`,
  `skill install`, `memo doctor`.skills), недостающее — PR в cli-base/cli-core параллельно, экран сам подхватит.
- Я бы: **C** — правило 1 соблюдено, экраны появляются сразу, разбивки придут с выпуском CLI.
- Ответ: «1 C».

**NEED-5 · Ставить ли приложению свой Node.js в домашнюю папку пользователя?**
- Сейчас: только ссылка на nodejs.org и объяснение словами; с Node из apt пользователь застревает (EACCES).
- Варианты: **A** свой Node с проверкой контрольных сумм nodejs.org и предложением добавить в PATH · **B** только
  инструкции по системам · **C** A основной кнопкой, B — «поставлю сам».
- Я бы: **C**.
- Ответ: «2 A» — свой Node с проверкой контрольных сумм и предложением добавить в PATH.

**NEED-6 · Где и как поднять сервер для баг-репортов?**
- Сейчас: серверной части у WireCat нет (FIND-5); нужны Worker, R2, GitHub App и новые секреты.
- Варианты: **A** Cloudflare Worker + R2 + GitHub App, код в `server/` этого репозитория · **B** то же, отдельный
  репозиторий `WireCatLabs/wirecat-api` · **C** без сервера: приложение открывает готовую страницу нового issue в
  браузере, без логов.
- Я бы: **B**, а пока сервера нет — **C** как запасной путь.
- Ответ: создан приватный `WireCatLabs/wirecat-api`; «build a Rails service based on
  /home/leemour/Projects/nbzb/Code/trustie - just copy it and remove all not needed parts instead of cherry-picking»;
  начать с healthcheck и reports; хендофф для другого агента; в этой сессии — отправка из приложения.

**NEED-7 · Писать ли JSON-конфиг напрямую в файл?**
- Снято: правило 1 отвечает само — сохранение через `config set`/`config unset`. Решение не нужно.

**NEED-3 · ответ** «1 A» — отправить `feat/desktop-mvp` и открыть PR. `main` создан на первом коммите `ddbe343`, PR — всё
после него.

**NEED-8 · Где будет работать wirecat-api и кто создаёт `api.wirecat.dev`, GitHub App и секреты?**
- Сейчас: хендофф заканчивается до деплоя; пока сервера нет, приложение отправляет через страницу нового issue на GitHub.
- Варианты: **A** сервер Hetzner, деплой Kamal как у trustie · **B** сервер Selectel с Uptime Kuma и `api.neirox.ai` ·
  **C** решить, когда код сервера будет готов.
- Я бы: **A** — WireCat отдельно от NBZB и Neirox, Hetzner — обычный хостинг владельца.
- Ответ: «2 A, I got set dns to hetzner». (Записано с опозданием: в ответах появлялся раньше, в журнал не попал — **поправка**.)

**NEED-9 · Отправить ветки cli-base и cli-core и открыть PR?** Ответ: «2 A». PR: WireCatLabs/cli-base#332,
WireCatLabs/cli-core#1959. visage: WireCatLabs/visage#1.

**NEED-10 · Страница о поиске в логах — сразу в деплой или ждать ревью?** Ответ: «3 asap» — пишется агентом в
`cli-docs-wt-desktop-logs`, сразу PR.

**NEED-13 · Почту из memo — в отдельный CLI или отдельной строкой в приложении?**
- Сейчас: memo одним пакетом делает заметки, почту и общий поиск; в приложении это одна строка «Memo».
- Варианты: **A** отдельный пакет (например `@wirecat/mail-cli`, бинарь `mail`) — новый репозиторий, перенос кода, своё
  хранилище настроек · **B** отдельная строка «Email» в каталоге приложения поверх того же `memo` (свои вход, проверка,
  логи) · **C** оставить как есть.
- Я бы: **B** сейчас, **A** потом, если почте нужен свой цикл выпусков.
- Ответ: «1 B».

**NEED-15 · Запустить агента wirecat-api из этой сессии?** Ответ: «I gave handoff to another agent» — сервер строит
другой агент, эта сессия его не трогает.

ASK-15 (логи zm, drive, memo): PR zoom-cli#255, drive-cli#219, cli-memo#436; приложение — `ec89d42`.

**NEED-16 · ответ «1 A»** — агент документации пишет абзац (en/es/ru), отдельный PR в cli-docs.

**NEED-16 · Добавить в политику конфиденциальности wirecat.dev абзац о логах в отчётах об ошибках?**
- Сейчас: `cli-docs/lib/privacy.ts:47` говорит только о «support data» общими словами; приложение будет всегда
  отправлять замаскированные логи на сервер WireCat и хранить их 90 дней.
- Варианты: **A** добавить абзац (что отправляется, зачем, 90 дней, как попросить удалить по hello@wirecat.dev) ·
  **B** оставить как есть.
- Я бы: **A** — отправка без выбора честна, только если политика это прямо называет; пользователи из ЕС.
- Ответ: ещё нет.

**NEED-17 · Сделать ли агенту cli-core общее определение агента и для подписей автора в memo и задачах?**
- Сейчас: журнал запусков узнаёт Claude Code, Codex, Gemini CLI, Cursor, OpenCode; подпись автора (`src/cli/author.ts`)
  — только Claude Code, остальные подписываются как владелец.
- Варианты: **A** одно правило в обоих местах · **B** оставить.
- Я бы: **A** — работа агентов не будет записана на владельца.
- Ответ: «2 A» — ещё один коммит в cli-core#1963.

ASK-13 (контекст запусков): PR cli-core#1963; приложение — `a2ce308`.

**NEED-18 · Обновить установленный memo до 0.103.0, чтобы фоновая синхронизация снова работала?**
- Сейчас: каждые 5 минут `memo-import` падает (FIND-9); заметки и почта не попадают в архив.
- Варианты: **A** обновить копию в nvm (её запускает служба) и в pnpm · **B** не трогать.
- Я бы: **A**.
- Ответ: «1 A asap». Установка из сессии запрещена настройками прав; отдан скрипт `bin/update-memo`.

**NEED-19 · Что из IDEA-1…5 строить на странице Agents первым?**
- Сейчас: страница показывает только навыки.
- Варианты: **A** IDEA-1, 2, 3 · **B** все пять · **C** только IDEA-1.
- Я бы: **A** — подключение, активность и проверка отвечают на «работает ли мой агент с инструментами».
- Ответ: «1 do all ideas» — все пять, один агент.

**NEED-20 · Как переименовать репозиторий?** (записано с опозданием — **поправка**: было в ответе, не в журнале)
- Сейчас: репозиторий `WireCatLabs/visage`; бинарник, app id и ярлык — `wirecat-desktop` / WireCat.
- Варианты: **A** `wirecat-desktop` · **B** `wirecat` · **C** оставить `visage`.
- Я бы: **A** — совпадает с бинарником и app id, рядом с `wirecat-api`; `wirecat` читается как весь продукт.
- Ответ: «1 A wirecat-desktop». Владелец переименовал репозиторий на GitHub; локальная папка пока `visage`. Ссылки
  `WireCatLabs/visage` в коде и документах заменены, в журнале оставлены как история.

**NEED-21 · Визуализации памяти и файлов — раздел этого приложения или отдельное приложение?** (тоже с опозданием)
- Сейчас: в боковой панели заглушка «Memory · Soon».
- Варианты: **A** раздел здесь, один репозиторий, один выпуск · **B** отдельное приложение «visage» · **C** этот
  репозиторий, отдельная загрузка.
- Я бы: **A** — одна установка и одно оформление; второе имя «visage» уходит.
- Ответ: «2 A. make sure the repo is modular and isolated, add linters for that… layers, well engineered, maintainable with no huge files with SRP».

**NEED-22 · Одобрить слово `tables` в общем словаре команд (cli-base#334)?**
- Сейчас: `store tables list` в cli-core#1967 не проходит проверку команд без этого слова; правило WC-CMD-2 требует
  одобрения владельца отдельным PR.
- Варианты: **A** одобрить #334 · **B** назвать команду иначе существующим словом.
- Я бы: **A** — `copies` значит только отложенные при ремонте таблицы, другого подходящего слова нет.
- Ответ: ещё нет.

**NEED-25 · Пусть cli-core отдаёт уровень и ключ для каждой команды в `commands --json`?**
- Сейчас: ключ есть только у запрещённых команд; «спрашивает по умолчанию» в приложении не видно (FIND-12).
- Варианты: **A** добавить `level` и `permission` всем командам · **B** показывать только заданное владельцем.
- Я бы: **A** — одно поле в существующей функции, и приложению больше нечего угадывать.
- Ответ: ещё нет.

Замеры `store tables` — WireCatLabs/cli-testing#227 (страница + скрипт, только итоги); идея поста POST-13.e в
cli-private `main` (`4f3796c5`, `293693a0`). Причина замедления уточнена: `dbstat` в соединении через `OR` не получает
имя таблицы и читает весь файл на каждую строку (3.1 с даже на пустом хранилище), при соединении по имени — 16 мс.

**NEED-26 · Ставить ли инструменты WireCat через pnpm без суточной задержки?**
- Сейчас: pnpm 11 ставит только версии старше суток; «Update to 0.91.0» ставит 0.85.0 (FIND-13).
- Варианты: **A** исключить из задержки только пакеты `@wirecat/*` при установке из приложения
  (`minimumReleaseAgeExclude`), чужие зависимости по-прежнему ждут сутки · **B** уважать задержку: приложение считает
  «последней» только версию старше суток и пишет, когда выйдет следующая · **C** ничего не менять.
- Я бы: **B** — задержка защищает от взломанного выпуска, в том числе своего; приложение просто говорит правду.
- Ответ: «1 A». Сделано: точная версия (`@0.91.0`, не `@latest`), флаг `--config.minimum-release-age-exclude=@wirecat/*`
  (проверено на pnpm 12.11 в пустой папке: без флага 0.85.0, с флагом 0.91.0), после установки сверка версии —
  несовпадение показывается как ошибка с причиной.

**NEED-27 · Открыть PR в cli-core / cli-base на пробелы из FIND-14?**
- Сейчас: агент Agents не мог работать с git в других репозиториях; пробелы только записаны.
- Варианты: **A** один агент, по PR на пробел · **B** позже.
- Я бы: **A** — без `mcp remove` в инструментах приложение удаляет записи через CLI самих агентов.
- Ответ: «1 A, and merge and release» — агент делает PR, сливает и выпускает (cli-base → cli-core → инструменты).

**NEED-28 · Слить и выпустить и остальные открытые PR этой сессии?**
- Сейчас: открыты cli-base #332 (`skill status`), #334 (слово `tables`, нужно одобрение владельца); cli-core #1959
  (разбивки `store info`), #1963 (контекст запусков), #1967 (`store tables`, черновик); zoom-cli #255, drive-cli #219,
  cli-memo #436 (журналы запусков); cli-docs #393 (страница поиска в логах), #398 (политика); cli-testing #227. Без
  них приложение на выпущенных инструментах показывает «arrives with the next update».
- Варианты: **A** слить все по зависимостям и выпустить (после одобрения #334 владельцем) · **B** только пробелы NEED-27.
- Я бы: **A** — экраны Agents, Storage и Logs раскроются только с этими выпусками.
- Ответ: «merge all» — включая cli-base #334 (это и есть одобрение словаря по WC-CMD-2). Один агент сливает и
  выпускает всё по зависимостям.
- **NEED-29 · Под каким именем публиковать серверы в официальном реестре MCP: `dev.wirecat/*` или `io.github.wirecatlabs/*`?** Сейчас: ни у одного пакета нет `mcpName`. Варианты: **A** `dev.wirecat` (бренд; одна TXT-запись в DNS Hetzner и ключ в секретах организации) · **B** `io.github.wirecatlabs` (ничего не нужно, вход через GitHub в CI). Я бы: **A**. Ответ: «2 A» — `dev.wirecat/*`. Ключ: `bin/setup-mcp-registry-key` (связка ключей + секрет организации `MCP_REGISTRY_PRIVATE_KEY`), TXT-запись — в Cloudflare: DNS wirecat.dev у Cloudflare, не у Hetzner (`dig NS wirecat.dev`).
- **NEED-30 · Какой командой запускать сервер в каталогах: голой программой (`tg`) или `npx @wirecat/tg@x.y.z`?** Сейчас: вход и хранилище у глобальной установки (RISK-6). Варианты: **A** голая программа, а в описании шаг «установите глобально» · **B** закреплённый `npx`. Я бы: **A**. Ответ: «3 A» — голая программа, в описании «установите глобально».
- **NEED-31 · Как Hermes получает навыки?** Сейчас: он не читает `~/.agents/skills` (FIND-15). Варианты: **A** один раз добавить `~/.agents/skills` в `skills.external_dirs` его `config.yaml` · **B** копия в `~/.hermes/skills/<app>` (её может переписать фоновая чистка Hermes) · **C** ставить через `hermes skills install <URL>` (версия с сайта, а не установленная). Я бы: **A**. Ответ: «1 A but add a fallback if smth goes wrong to B» — A, а если не получилось записать настройку, копия по B.
- **NEED-32 · Что делать с правами, когда подключают агента, которым управляют из чата (шлюз Hermes, каналы OpenClaw)?** Сейчас: шлюз Hermes здесь настроен, и любой, кого принимает бот, может запустить `tg`/`memo` от имени владельца без вопроса. Варианты: **A** при подключении предупреждать и предлагать «только чтение» для этого профиля, выбор за владельцем · **B** только предупреждать · **C** ничего. Я бы: **A**. Ответ: «2 A».
- **NEED-33 · Подавать ли сейчас в каталог Anthropic?** Сейчас: нужен платный план claude.ai, шесть отдельных заявок, ручная проверка каждой версии, а локальные серверы в чате claude.ai не работают. Варианты: **A** позже, после реестра и своего маркетплейса · **B** сейчас. Я бы: **A**. Ответ: —
- **NEED-34 · Двигать ли список запусков в Logs, когда догружаются запуски другого инструмента?** Сейчас: запуски каждого инструмента вставляются в общий список по времени по мере прихода, видимые строки уезжают на 35–104 px. Варианты: **A** показывать таблицу, когда прочитаны все · **B** показать первые, остальные — полосой «12 новых запусков, показать» · **C** как есть. Я бы: **B**. Ответ: «show table at the time of query, add a button for live update (don't update too often, mb each 5 secs?)» — таблица — снимок на момент запроса; кнопка «Live» обновляет раз в ~5 с.
- **NEED-35 · Онбординг, Sign in: открывать форму первого аккаунта по нажатию «Add an account» или сама, как раньше?** Сейчас: по нажатию (так нет скачка ~0.03). Варианты: **A** по нажатию · **B** сама. Я бы: **A**. Ответ: «2 A» — по нажатию.
- **NEED-36 · Принять ли, что `store reset --no-backup` теперь требует `--allow-dangerous` вместо `--yes` (cli-core #1986)?** Сейчас: PR зелёный, помечен «may break callers»; вызовов этой пары в репозиториях не найдено. Варианты: **A** принять · **B** оставить `--yes`. Я бы: **A**. Ответ: «1 B» — `--yes` для `store reset --no-backup` остаётся; из cli-core #1986 оставить только `--dry-run`. Приложение зовёт `store reset --no-backup --yes`.
- **NEED-37 · Шифровать ли резервные копии паролем (`store backup --encrypt`)?** Сейчас: zip со всеми сообщениями без шифрования, панель советует хранить его в тайне. Варианты: **A** необязательное поле пароля · **B** только обычный zip. Я бы: **A**. Ответ: «3 A» — необязательный пароль у резервной копии (`store backup --encrypt`).
- **NEED-38 · Как ускорить все команды, а не только `--version` (бэклог cli-core CORE-40)?** Сейчас: каждая команда грузит ~880 файлов cli-core (~400 мс); грузить только нужную команду нельзя — `config` и др. читают всё дерево команд. Варианты: **A** код каждой команды грузится при запуске, волнами по ~60 файлов, сверка одинаковым `commands --json` · **B** один бандл на инструмент (tg: −100–150 мс, −300 мс CPU на команду), вторая сборка, заглушки драйверов SQLite. Я бы: **A**. Ответ: «2 A» — код команд грузится при запуске, волнами, сверка одинаковым `commands --json`. Начать после текущего выпуска.
- **NEED-39 · Показывать на Agents все пять известных агентов всегда, даже ненайденные («Not found on this computer»)?** Сейчас: так и слито — единственный вариант без сдвига при первом запуске; раскрывашка «Agents this app knows» теперь почти повторяет список. Варианты: **A** оставить, раскрывашку убрать · **B** показывать только найденных (сдвиг при первом запуске). Я бы: **A**. Ответ: «we register agents and have a list of default ones that we can hardcode, so display all hardcoded and if more registered - more. dont user rows, do as I said» — все жёстко заданные агенты всегда + замеченные в запусках/захватах задач; не строки, а компактные карточки с цветной точкой и «Manage»; раскрывашку «Agents this app knows» убрать. Передано агенту раунда интерфейса.
- **NEED-40 · Ставить ли из приложения чужие MCP-серверы, например для управления браузером (Playwright MCP, Chrome DevTools MCP)?** Сейчас: приложение подключает к агентам только инструменты WireCat. Варианты: **A** короткий список «Recommended MCP servers» на Agents: добавить в выбранного агента его командой, с объяснением, что сервер делает и какие права получает · **B** не надо, приложение — только про WireCat. Я бы: **A** после волны OpenClaw/Hermes — общий код подключения тот же. Ответ: «1 B» — не ставить чужие MCP-серверы; приложение только про WireCat.
- **NEED-41 · Нужен ли на Tools отдельный список «More tools» с карточками для установки, если у каждой строки неустановленного инструмента уже есть кнопка Install?** Сейчас: не сделано, строки с Install есть. Варианты: **A** не нужно · **B** блок «More tools: Zoom, Google Drive…» с кнопками. Я бы: **A**. Ответ: —
- **NEED-42 · Оставлять ли MCP как вариант для чат-приложений и удалённых агентов (публикация в реестре MCP, раздел «Advanced: MCP» в приложении) или убрать из продукта совсем?** Сейчас: у каждого инструмента есть MCP-сервер, приложение его показывает; реестр готов (`dev.wirecat`). Варианты: **A** оставить как вариант: не в подключении, в документации отдельным разделом, в реестре MCP — да · **B** оставить в инструментах, но нигде не публиковать и не показывать · **C** убрать из инструментов. Я бы: **A** — чат-приложения (Claude Desktop, claude.ai через мост) без MCP не смогут ничего. Ответ: —
