# manual run command
# dfx stop && dfx start --clean --background
# dfx generate arks-core; dfx generate arks-risk-engine; dfx generate arks-identity; dfx generate arks-token-factory
# cp -R src/declarations/arks-core src/frontend/declarations/arks-core
# cp -R src/declarations/arks-risk-engine src/frontend/declarations/arks-risk-engine
# cp -R src/declarations/arks-identity src/frontend/declarations/arks-identity
# cp -R src/declarations/arks-token-factory src/frontend/declarations/arks-token-factory
# dfx deploy arks-core
# dfx deploy arks-risk-engine
# dfx deploy arks-identity
# dfx deploy arks-token-factory
# cd src/AI && npm run dev
# cd src/frontend && npm run dev


#!/usr/bin/env bash
# run_local.sh — ARKS RWA local dev runner (detach/tail/stop modes)
# Usage:
#   ./run_local.sh            # default: --detach (start in background and exit)
#   ./run_local.sh --detach   # explicitly detach
#   ./run_local.sh --tail     # start and tail logs until Ctrl+C
#   ./run_local.sh --stop     # stop AI + Next.js + dfx

set -Eeuo pipefail

MODE="${1:---detach}"  # default state is --detach

# ---------- Config ----------
CANISTERS=(
  "arks-core"
  "arks-risk-engine"
  "arks-identity"
  "arks-token-factory"
)
REPLICA_STATUS_URL="http://127.0.0.1:4943/api/v2/status"
FRONT_DECL_ROOT="src/frontend/declarations"
DECL_ROOT="src/declarations"
AI_DIR="src/AI"
FRONTEND_DIR="src/frontend"

LOG_DIR="logs"
AI_LOG="${LOG_DIR}/ai.log"
FRONT_LOG="${LOG_DIR}/frontend.log"

PID_DIR="pids"
AI_PID_FILE="${PID_DIR}/ai.pid"
FRONT_PID_FILE="${PID_DIR}/frontend.pid"

DEFAULT_FRONT_PORT="3000"
DEFAULT_AI_PORT="4000"

# ---------- Helpers ----------
log() { printf "\033[1;32m[run_local]\033[0m %s\n" "$*"; }
err() { printf "\033[1;31m[run_local]\033[0m %s\n" "$*" >&2; }

require_cmd() { command -v "$1" >/dev/null 2>&1 || { err "Missing required command: $1"; exit 1; }; }

wait_for_replica() {
  log "Waiting for local replica at ${REPLICA_STATUS_URL}..."
  for i in {1..60}; do
    if curl -fsS "${REPLICA_STATUS_URL}" >/dev/null 2>&1; then
      log "Replica is up ✅"
      return 0
    fi
    sleep 1
  done
  err "Replica did not become ready in time."
  exit 1
}

copy_decls() {
  local name="$1"
  local src="${DECL_ROOT}/${name}"
  local dst="${FRONT_DECL_ROOT}/${name}"
  if [[ ! -d "${src}" ]]; then
    err "Declarations not found for ${name} at ${src}"
    return 1
  fi
  mkdir -p "${FRONT_DECL_ROOT}"
  rsync -a --delete "${src}/" "${dst}/"
  log "Copied declarations: ${src} -> ${dst}"
}

kill_pid_if_running() {
  local pid="$1"
  local label="$2"
  if [[ -n "${pid}" && "${pid}" =~ ^[0-9]+$ ]]; then
    if kill -0 "${pid}" >/dev/null 2>&1; then
      log "Stopping ${label} (PID ${pid})..."
      kill "${pid}" >/dev/null 2>&1 || true
      for _ in {1..8}; do
        if kill -0 "${pid}" >/dev/null 2>&1; then sleep 1; else break; fi
      done
      if kill -0 "${pid}" >/dev/null 2>&1; then
        err "${label} still running, forcing kill -9"
        kill -9 "${pid}" >/dev/null 2>&1 || true
      fi
    fi
  fi
}

kill_by_pidfile() {
  local file="$1"
  local label="$2"
  if [[ -f "${file}" ]]; then
    local pid
    pid="$(cat "${file}" 2>/dev/null || true)"
    kill_pid_if_running "${pid}" "${label}"
    rm -f "${file}" || true
  fi
}

kill_by_port() {
  local port="$1"
  local label="$2"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -t -i tcp:"${port}" 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      log "Killing ${label} on port ${port} (PIDs: ${pids})..."
      xargs -r kill <<< "${pids}" 2>/dev/null || true
      sleep 1
      pids="$(lsof -t -i tcp:"${port}" 2>/dev/null || true)"
      if [[ -n "${pids}" ]]; then
        err "${label} still on port ${port}, forcing kill -9"
        xargs -r kill -9 <<< "${pids}" 2>/dev/null || true
      fi
    fi
  fi
}

kill_by_pattern() {
  local pattern="$1"
  local label="$2"
  if command -v pkill >/dev/null 2>&1; then
    log "Killing ${label} by pattern (${pattern})..."
    pkill -f "${pattern}" 2>/dev/null || true
  fi
}

start_dev() {
  # Usage: start_dev <dir> <name> <logfile> <pidfile> [VAR=VAL ...]
  local dir="$1"; local name="$2"; local logfile="$3"; local pidfile="$4"
  shift 4
  local extra_env=( "$@" )

  if [[ ! -d "$dir" ]]; then
    err "Directory not found: $dir — skipping $name"
    echo ""
    return 0
  fi

  mkdir -p "$(dirname "$logfile")" "${PID_DIR}"
  : > "$logfile"

  log "Checking dependencies for $name..."
  if [[ ! -d "$dir/node_modules" ]]; then
    log "node_modules not found in $dir — running npm install..."
    ( cd "$dir" && npm install ) >>"$logfile" 2>&1
  fi

  log "Starting $name dev server..."
  (
    cd "$dir"
    if (( ${#extra_env[@]} )); then
      # Pass VAR=VAL pairs safely as environment to the command
      env "${extra_env[@]}" npm run dev
    else
      npm run dev
    fi
  ) >>"$logfile" 2>&1 &
  local pid=$!
  echo "${pid}" > "${pidfile}"
  echo "${pid}"
}

stop_everything() {
  log "Stopping AI / Next.js / dfx ..."

  local FRONT_PORT="${DEFAULT_FRONT_PORT}"
  local AI_PORT="${DEFAULT_AI_PORT}"
  if [[ -f .env ]]; then
    set -a; . ./.env; set +a
    FRONT_PORT="${FRONTEND_PORT:-${NEXT_PORT:-$FRONT_PORT}}"
    AI_PORT="${AI_PORT:-$AI_PORT}"
    if [[ -z "${AI_PORT}" ]]; then AI_PORT="${DEFAULT_AI_PORT}"; fi
  fi

  kill_by_pidfile "${AI_PID_FILE}" "AI"
  kill_by_pidfile "${FRONT_PID_FILE}" "Next.js"

  kill_by_port "${FRONT_PORT}" "Next.js"
  kill_by_port "${AI_PORT}" "AI"

  kill_by_pattern "${FRONTEND_DIR}.*(next|node).*dev" "Next.js"
  kill_by_pattern "${AI_DIR}.*node.*dev" "AI"

  log "Stopping dfx replica..."
  dfx stop >/dev/null 2>&1 || true

  log "All processes stopped ✅"
}

# ---------- Early stop handling ----------
if [[ "${MODE}" == "--stop" ]]; then
  require_cmd dfx
  stop_everything
  exit 0
fi

# ---------- Requirements for start modes ----------
require_cmd dfx
require_cmd rsync
require_cmd curl
require_cmd npm

# ---------- 1) Fresh local replica ----------
log "Restarting local replica..."
dfx stop || true
dfx start --clean --background
wait_for_replica

# ---------- 2) Generate declarations ----------
for can in "${CANISTERS[@]}"; do
  log "Generating declarations for ${can}..."
  dfx generate "${can}"
done

# ---------- 3) Copy declarations to frontend ----------
for can in "${CANISTERS[@]}"; do
  copy_decls "${can}"
done

# ---------- 4) Deploy canisters ----------
log "Obtaining deploy principal..."
DEPLOYER_PRINCIPAL="$(dfx identity get-principal)"
log "Principal: ${DEPLOYER_PRINCIPAL}"

log "Deploying arks-core..."
dfx deploy --network local arks-core \
  --argument "(principal \"${DEPLOYER_PRINCIPAL}\")"

log "Deploying arks-identity..."
dfx deploy --network local arks-identity \
  --argument "(opt principal \"${DEPLOYER_PRINCIPAL}\")"

log "Deploying arks-risk-engine..."
dfx deploy --network local arks-risk-engine \
  --argument "(principal \"${DEPLOYER_PRINCIPAL}\", null, null)"

CORE_ID="$(dfx canister id arks-core)"
log "arks-core canister id: ${CORE_ID}"

log "Deploying arks-token-factory..."
dfx deploy --network local arks-token-factory \
  --argument "(opt principal \"${DEPLOYER_PRINCIPAL}\", principal \"${CORE_ID}\")"

log "All canisters deployed ✅"

# ---------- 5) Load .env ----------
if [[ -f .env ]]; then
  set -a; . ./.env; set +a
fi

FRONTEND_PORT="${FRONTEND_PORT:-${NEXT_PORT:-$DEFAULT_FRONT_PORT}}"
AI_PORT="${AI_PORT:-$DEFAULT_AI_PORT}"

# ---------- 6) Start dev servers ----------
AI_PID="$(start_dev "$AI_DIR" "AI" "$AI_LOG" "$AI_PID_FILE" "AI_PORT=$AI_PORT")"
FRONT_PID="$(start_dev "$FRONTEND_DIR" "Next.js" "$FRONT_LOG" "$FRONT_PID_FILE" "PORT=$FRONTEND_PORT")"

if [[ -z "$AI_PID" && -z "$FRONT_PID" ]]; then
  err "No dev servers were started."
  exit 1
fi

log "Dev servers started:"
[[ -n "$AI_PID" ]] && log "  AI        PID=${AI_PID}  log=${AI_LOG}  port=${AI_PORT}"
[[ -n "$FRONT_PID" ]] && log "  Frontend  PID=${FRONT_PID}  log=${FRONT_LOG}  port=${FRONTEND_PORT}"

if [[ "$MODE" == "--detach" ]]; then
  log "Detach mode: leaving servers running in background. To view logs:"
  [[ -n "$AI_PID" ]] && echo "  tail -f \"$AI_LOG\""
  [[ -n "$FRONT_PID" ]] && echo "  tail -f \"$FRONT_LOG\""
  trap - EXIT INT TERM
  exit 0
fi

# ---------- 7) Tail logs ----------
log "Tailing logs (Ctrl+C to stop everything)..."
if [[ -f "$AI_LOG" && -f "$FRONT_LOG" ]]; then
  tail -n +1 -f "$AI_LOG" "$FRONT_LOG"
elif [[ -f "$AI_LOG" ]]; then
  tail -n +1 -f "$AI_LOG"
elif [[ -f "$FRONT_LOG" ]]; then
  tail -n +1 -f "$FRONT_LOG"
else
  err "No log files found to tail."
  [[ -n "$AI_PID" ]] && wait "$AI_PID" || true
  [[ -n "$FRONT_PID" ]] && wait "$FRONT_PID" || true
fi