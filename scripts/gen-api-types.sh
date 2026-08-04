#!/usr/bin/env bash
#
# REST 계약 타입 생성 — 핀 읽기 → 좌표 조립 → 스펙 fetch → 생성.
#
# 호출자는 둘, 경로는 하나다: 로컬(`npm run gen:api`)과 PR CI(드리프트 게이트)가 이 스크립트를
# 부른다. CI는 이것을 돌린 뒤 diff만 본다 — 로컬과 CI가 다른 경로로 생성하면 게이트가 자기 자신을
# 검사하게 된다.
#
# 스펙 원본은 저장소에 남기지 않는다(임시 디렉터리에서만 산다) — consumer는 원천의 사본을 두지
# 않는다(ADR-0020). 사본을 두면 검사가 사본끼리의 정합만 보게 된다.
#
# 자격증명: 두 저장소 모두 private이라 스펙 읽기에 인증이 필요하다.
#   - 로컬 — 개발자 자신의 `gh auth login` 자격증명
#   - CI   — Actions secret SPEC_READ_TOKEN (api-composer 한 곳에 대한 Contents: read 하나)
#            Actions가 주입하는 GITHUB_TOKEN은 자기 저장소로 한정되어 이 일을 못 한다.
set -euo pipefail

PIN_FILE="${PIN_FILE:-contracts/api-composer.pin}"
OUT_FILE="${OUT_FILE:-src/lib/api/schema.d.ts}"
# 생성기는 package.json 의존성에 넣지 않고 버전을 고정해 격리 실행한다.
#   ⓐ 앱의 typescript 버전과 생성기의 요구가 충돌해도 격리하면 문제가 사라진다
#      (생성된 .d.ts 자체는 앱의 tsc가 깨끗이 컴파일한다)
#   ⓑ 버전을 안 박으면 생성기 업그레이드가 산출물을 재포맷해 디프 게이트가 노이즈에 터진다
GENERATOR="openapi-typescript@7.13.0"

die() {
  echo "gen-api-types: $*" >&2
  exit 1
}

# 핀에서 key 를 읽는다 (key=value · # 주석 · 앞뒤 공백 허용)
pin() {
  sed -nE "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*([^[:space:]#]+).*$/\1/p" "$PIN_FILE" | tail -n1
}

[ -f "$PIN_FILE" ] || die "핀 파일이 없다: $PIN_FILE"

REPO="$(pin repo)"
TAG="$(pin tag)"
[ -n "$REPO" ] || die "핀에 repo 가 없다: $PIN_FILE"
[ -n "$TAG" ] || die "핀에 tag 가 없다: $PIN_FILE"

# 좌표 → 파일 위치. 태그 prefix 가 계약이 사는 디렉터리이고 파일명은 고정 관례다.
SPEC_DIR="$(dirname "$TAG")"
[ "$SPEC_DIR" != "." ] || die "좌표에 디렉터리 prefix 가 없다: $TAG"
SPEC_PATH="$SPEC_DIR/openapi.yaml"

command -v gh >/dev/null || die "gh 가 필요하다 (스펙 fetch)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "핀: $REPO @ $TAG → $SPEC_PATH"

# 우리 좌표는 슬래시를 품으므로(spec/api-composer/v0.2.0) ref 를 경로에 담는
# raw.githubusercontent.com 은 쓸 수 없다 — ref 를 쿼리로 받는 Contents API 를 쓴다.
gh api "repos/$REPO/contents/$SPEC_PATH?ref=$TAG" \
  -H "Accept: application/vnd.github.raw" >"$TMP/openapi.yaml" ||
  die "스펙 fetch 실패 — 좌표($TAG)가 존재하는지, 자격증명이 유효한지 본다"

[ -s "$TMP/openapi.yaml" ] || die "빈 스펙을 받았다: $REPO @ $TAG"

npx -y "$GENERATOR" "$TMP/openapi.yaml" -o "$TMP/schema.d.ts"

mkdir -p "$(dirname "$OUT_FILE")"
{
  echo "// 생성물 — 손으로 고치지 않는다. 고쳐도 PR CI 의 재생성 diff 가 거부한다."
  echo "// 원천: $REPO · 공표 좌표 $TAG ($SPEC_PATH)"
  echo "// 재생성: npm run gen:api   (핀: $PIN_FILE)"
  cat "$TMP/schema.d.ts"
} >"$OUT_FILE"

echo "생성: $OUT_FILE"
