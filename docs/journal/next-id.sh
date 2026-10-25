#!/usr/bin/env sh
# Следующий свободный номер для префикса.
#   ./next-id.sh SEC   ->   SEC-5
#
# Номер выдаётся АТОМАРНО и занят с момента выдачи, а не с момента, когда ты допишешь
# запись. Два агента, вызвавшие скрипт одновременно, получат разные номера — **включая
# агентов в разных worktree**, что и было сломано до 2026-09-09.
#
# ## Почему счётчик лежит вне репозитория
#
# Раньше он был `journal/.counters` рядом со скриптом, и `dir=$(dirname "$0")` означал, что
# у каждого worktree свой счётчик и свой lock. То есть атомарности между сессиями не было
# вообще: 2026-09-08 две сессии independently выдали себе `TASK-27`, `FIND-33`–`FIND-38` и
# `NEED-19`, и узнали об этом только на мерже. Один номер (`NEED-18`) успел попасть в
# хендофф и не попасть в журнал, то есть был опубликован и потерян одновременно.
#
# Теперь счётчик один на репозиторий и живёт рядом с общим git-каталогом, который у всех
# worktree один и тот же. Он **не под гитом** намеренно: пока он был отслеживаемым файлом,
# каждый мерж журнала конфликтовал на нём, и разрешать конфликт значило вручную брать
# максимум по каждому префиксу.
#
# `.counters` в репозитории больше не пишется. Он остаётся как исходное зерно для машины,
# которая видит этот журнал впервые.
set -eu
[ $# -eq 1 ] || { echo "usage: $0 <PREFIX>   напр. $0 SEC" >&2; exit 2; }
prefix=$(printf '%s' "$1" | tr '[:lower:]' '[:upper:]')
dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

# Общий на все worktree: в worktree это указывает на главный `.git`, в основном чекауте — на
# него же. Если это не git-репозиторий (журнал скопировали куда-то отдельно), счётчик
# остаётся рядом со скриптом, как раньше.
common=$(git -C "$dir" rev-parse --git-common-dir 2>/dev/null || true)
case "$common" in
  "") state="$dir" ;;
  /*) state="$common" ;;
  *)  state=$(CDPATH= cd -- "$dir" && CDPATH= cd -- "$common" && pwd) ;;
esac

counters="$state/journal-counters"
seed="$dir/.counters"

allocate() {
  # Записи — источник истины: счётчик лишь не даёт переиспользовать номер, который выдан,
  # но ещё не записан. Если счётчик потерян, максимум из записей восстанавливает его.
  scanned=$(find "$dir" -maxdepth 1 -name '*.md' ! -name 'README.md' ! -name '_*' \
              -exec cat {} + 2>/dev/null \
            | grep -oE "\b${prefix}-[0-9]+" | sed "s/^${prefix}-//" | sort -n | tail -1)
  stored=$(awk -v p="$prefix" '$1 == p { print $2 }' "$counters" 2>/dev/null | tail -1)
  # Зерно из отслеживаемого `.counters` — только пока общий счётчик его ещё не обогнал.
  seeded=$(awk -v p="$prefix" '$1 == p { print $2 }' "$seed" 2>/dev/null | tail -1)
  max=${scanned:-0}
  [ "${stored:-0}" -gt "$max" ] && max=$stored
  [ "${seeded:-0}" -gt "$max" ] && max=$seeded
  n=$(( max + 1 ))
  tmp="$counters.$$"
  { grep -v "^${prefix} " "$counters" 2>/dev/null || true; echo "$prefix $n"; } > "$tmp"
  mv "$tmp" "$counters"
  printf '%s-%s\n' "$prefix" "$n"
}

if command -v flock >/dev/null 2>&1; then
  exec 9>"$counters.lock"
  flock 9
  allocate
else
  allocate   # без flock окно гонки остаётся; проверь дубли перед коммитом
fi
