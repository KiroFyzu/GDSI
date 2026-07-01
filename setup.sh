#!/bin/bash
# ============================================================
# GDSI — Auto Setup Script for GitHub Codespace
# Usage:
#   1. Upload GDSI-updated.zip ke Codespace (drag & drop ke Explorer)
#   2. Buka Terminal di Codespace, pastikan posisi di root repo:
#        cd /workspaces/GDSI
#   3. bash setup.sh        (kalau setup.sh ada di root)
#      atau
#      bash GDSI-merged/setup.sh   (kalau masih di dalam folder hasil extract)
# ============================================================

set -e  # stop on first error

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${GREEN}✅ $1${RESET}"; }
warn() { echo -e "${YELLOW}⚠️  $1${RESET}"; }
err()  { echo -e "${RED}❌ $1${RESET}"; exit 1; }
info() { echo -e "${CYAN}ℹ️  $1${RESET}"; }
head() { echo -e "\n${BOLD}$1${RESET}"; }

head "═══════════════════════════════════════"
echo -e "${BOLD}  GDSI Auto Setup — GitHub Codespace${RESET}"
head "═══════════════════════════════════════"

# ── 1. Find zip file ────────────────────────────────────────
head "Step 1: Cari zip file..."

SEARCH_DIRS=(. .. "$HOME" /workspaces/*)
ZIP_FILE=""
for dir in "${SEARCH_DIRS[@]}"; do
    for candidate in "$dir"/GDSI-updated.zip "$dir"/GDSI-merged.zip "$dir"/GDSI*.zip "$dir"/gdsi*.zip; do
        if [ -f "$candidate" ]; then
            ZIP_FILE="$candidate"
            break 2
        fi
    done
done

[ -z "$ZIP_FILE" ] && err "Zip file tidak ditemukan! Pastikan GDSI-updated.zip sudah diupload ke Codespace (drag ke Explorer kiri)."
ZIP_FILE="$(realpath "$ZIP_FILE")"
log "Zip ditemukan: $ZIP_FILE"

# ── 2. Detect repo root ──────────────────────────────────────
head "Step 2: Deteksi repo..."

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
[ -z "$REPO_ROOT" ] && err "Bukan git repo! Jalankan dari dalam folder repo GDSI (cd /workspaces/GDSI dulu)."
log "Repo: $REPO_ROOT"

# ── 3. Extract zip to clean temp dir ─────────────────────────
head "Step 3: Extract zip..."

TMP_DIR=$(mktemp -d)
unzip -q "$ZIP_FILE" -d "$TMP_DIR"
log "Extracted ke $TMP_DIR"

# ── 4. SMART DETECTION — find the real project root ──────────
# Jangan tebak posisi folder. Cari folder mana pun (sampai 3
# level dalam) yang benar-benar berisi index.html + vite.config.js
# — bekerja baik untuk struktur zip flat maupun bersarang.
head "Step 4: Deteksi struktur project..."

SRC=""
while IFS= read -r -d '' candidate_dir; do
    if [ -f "$candidate_dir/index.html" ] && [ -f "$candidate_dir/vite.config.js" ]; then
        SRC="$candidate_dir"
        break
    fi
done < <(find "$TMP_DIR" -maxdepth 3 -type d -print0)

if [ -z "$SRC" ]; then
    warn "Tidak ditemukan folder dengan index.html + vite.config.js."
    info "Isi zip yang ter-extract:"
    find "$TMP_DIR" -maxdepth 3 | sed "s|$TMP_DIR|  .|"
    err "Struktur zip tidak dikenali. Screenshot output di atas dan kirim ke Claude."
fi

log "Project root ditemukan: $SRC"
info "Isi folder ini:"
ls "$SRC" | sed 's/^/    /'

# ── 5. Copy files to repo ────────────────────────────────────
head "Step 5: Copy files ke repo..."

rsync -a --exclude='node_modules' --exclude='.git' --exclude='*.zip' \
    "$SRC/" "$REPO_ROOT/"

log "Semua file berhasil di-copy"

# ── 5b. Cleanup leftover staging folder ──────────────────────
# Kalau ada folder sisa hasil extract manual sebelumnya (misal
# "GDSI-merged/" dari drag-drop pertama kali) yang KEBETULAN
# ikut ter-commit ke repo di root, hapus di sini. Isinya sudah
# aman tersalin ke root repo lewat rsync di atas — folder asli
# ini cuma duplikat/sampah dan bisa menyebabkan konflik
# "modify/delete" di push berikutnya kalau dibiarkan nyangkut.
SRC_BASENAME="$(basename "$SRC")"
if [ -d "$REPO_ROOT/$SRC_BASENAME" ] && [ "$REPO_ROOT/$SRC_BASENAME" != "$SRC" ]; then
    info "Membersihkan folder staging lama: $SRC_BASENAME/"
    rm -rf "$REPO_ROOT/$SRC_BASENAME"
    log "Folder staging lama dibersihkan"
fi

critical_files=(
    "vite.config.js"
    "index.html"
    "admin.html"
    "form.html"
    "qtt.html"
    "gdsi_rules.html"
    "gdsi_tnc.html"
    "gdsi-apps-script.gs"
    "public/robots.txt"
    "public/sitemap.xml"
    "public/manifest.json"
    "public/sw.js"
    "public/icons/icon-192.png"
    "public/icons/icon-512.png"
    "favicon.ico"
)

echo ""
info "Verifikasi file penting:"
missing_count=0
for f in "${critical_files[@]}"; do
    if [ -f "$REPO_ROOT/$f" ]; then
        echo -e "  ${GREEN}✓${RESET} $f"
    else
        echo -e "  ${RED}✗${RESET} $f MISSING!"
        missing_count=$((missing_count+1))
    fi
done

if [ "$missing_count" -gt 0 ]; then
    warn "$missing_count file hilang. Cek apakah zip kamu lengkap."
else
    log "Semua file penting lengkap"
fi

# ── 6. Verify vite.config.js is clean ───────────────────────
head "Step 6: Cek vite.config.js..."

if grep -q "vite-plugin-static-copy" "$REPO_ROOT/vite.config.js" 2>/dev/null; then
    err "vite.config.js MASIH ada plugin broken!"
else
    log "vite.config.js bersih — tidak ada plugin broken"
fi

# ── 7. Git commit & push ─────────────────────────────────────
head "Step 7: Git commit & push..."

cd "$REPO_ROOT"

if [ -z "$(git config user.email)" ]; then
    GH_EMAIL=$(gh api user --jq .email 2>/dev/null || echo "")
    GH_LOGIN=$(gh api user --jq .login 2>/dev/null || echo "gdsi-admin")
    [ -z "$GH_EMAIL" ] || [ "$GH_EMAIL" = "null" ] && GH_EMAIL="$GH_LOGIN@users.noreply.github.com"
    git config user.email "$GH_EMAIL"
    git config user.name  "$GH_LOGIN"
    info "Git user diset: $GH_LOGIN <$GH_EMAIL>"
fi

git add -A

if git diff --cached --quiet; then
    warn "Tidak ada perubahan baru — repo sudah up to date"
else
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
    git commit -m "fix: build error + participant list + YouTube CMS sync + SEO + admin.html structure ($TIMESTAMP)"
    log "Commit berhasil"

    CURRENT_BRANCH=$(git branch --show-current)

    # Sync dulu dengan remote sebelum push — mencegah 'rejected: fetch first'
    # kalau ada commit di GitHub yang belum ada di Codespace ini
    # (misalnya dari upload manual via GitHub web sebelumnya).
    info "Sync dengan remote dulu..."
    if git pull origin "$CURRENT_BRANCH" --no-rebase --no-edit 2>&1 | tee /tmp/gdsi_pull_log.txt; then
        if grep -q "CONFLICT" /tmp/gdsi_pull_log.txt; then
            err "Ada conflict saat pull! Cek file yang bentrok dengan: git status
Resolve manual dulu (edit file, hapus marker <<<<<<< ======= >>>>>>>), lalu:
  git add -A && git commit -m 'merge' && git push origin $CURRENT_BRANCH"
        fi
        log "Sync berhasil, lanjut push..."
    else
        warn "git pull gagal atau tidak ada remote tracking — lanjut push langsung"
    fi

    git push origin "$CURRENT_BRANCH"
    log "Push ke GitHub berhasil (branch: $CURRENT_BRANCH)"
fi

# ── 8. Cleanup ───────────────────────────────────────────────
rm -rf "$TMP_DIR"
log "Temp folder dibersihkan"

echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  SELESAI! Vercel akan auto-deploy.    ${RESET}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════${RESET}"
echo ""
echo -e "${CYAN}Pantau build di: https://vercel.com/dashboard${RESET}"
echo -e "${CYAN}Setelah build ✅, redeploy Apps Script juga!${RESET}"
echo ""
