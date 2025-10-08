#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

ensure_node() {
    if command_exists node; then
        return
    fi

    cat <<'EOF'
[android-logcat-agent] Node.js chưa được cài đặt.
Bạn có thể cài đặt nhanh bằng Homebrew:
  brew install node
Hoặc tải trực tiếp từ https://nodejs.org/en
EOF
    exit 1
}

install_dependencies() {
    if [ -f "$PROJECT_ROOT/pnpm-lock.yaml" ] && command_exists pnpm; then
        (cd "$PROJECT_ROOT" && pnpm install)
        return
    fi

    if command_exists npm; then
        (cd "$PROJECT_ROOT" && npm install)
        return
    fi

    cat <<'EOF'
[android-logcat-agent] Không tìm thấy pnpm hoặc npm để cài đặt phụ thuộc.
Vui lòng cài đặt Node.js (kèm theo npm) hoặc pnpm:
  - pnpm: npm install -g pnpm
  - hoặc sử dụng brew install pnpm
EOF
    exit 1
}

usage() {
    cat <<'EOF'
Usage: ./run-android-logcat-agent-macos.sh [--server <url>] [--agent-id <id>] [--agent-name <name>]

Tùy chọn:
  --server      URL Socket.IO của server (mặc định: http://localhost:3000)
  --agent-id    Giá trị LOGCAT_AGENT_ID (mặc định: hostname)
  --agent-name  Giá trị LOGCAT_AGENT_NAME (mặc định: LOGCAT_AGENT_ID)

Ví dụ:
  ./run-android-logcat-agent-macos.sh --server https://daotq.duckdns.org --agent-name "Mac Studio QA"
EOF
}

SERVER_URL="https://daotq.duckdns.org"
AGENT_ID=""
AGENT_NAME=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --server)
            SERVER_URL="$2"
            shift 2
            ;;
        --agent-id)
            AGENT_ID="$2"
            shift 2
            ;;
        --agent-name)
            AGENT_NAME="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "[android-logcat-agent] Tham số không hợp lệ: $1"
            usage
            exit 1
            ;;
    esac
done

ensure_node
install_dependencies

if [ -z "$AGENT_ID" ]; then
    AGENT_ID="$(scutil --get ComputerName 2>/dev/null || hostname)"
fi

if [ -z "$AGENT_NAME" ]; then
    AGENT_NAME="$AGENT_ID"
fi

export LOGCAT_SERVER_URL="$SERVER_URL"
export LOGCAT_AGENT_ID="$AGENT_ID"
export LOGCAT_AGENT_NAME="$AGENT_NAME"

echo "[android-logcat-agent] Server: $LOGCAT_SERVER_URL"
echo "[android-logcat-agent] Agent ID: $LOGCAT_AGENT_ID"
echo "[android-logcat-agent] Agent Name: $LOGCAT_AGENT_NAME"

cd "$PROJECT_ROOT"
exec node scripts/android-logcat-agent.js
