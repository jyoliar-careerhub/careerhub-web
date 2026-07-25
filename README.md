# careerhub-web

careerhub의 새 프론트엔드. 근거 결정은 ops-workflow의 ADR이 담는다:

- **ADR-0012** — 스택은 Next.js(React)
- **ADR-0013** — TypeScript로 짓는다(strict — 타입 검사가 사라진 리뷰어의 대체재다)
- **ADR-0015** — 스타일 토큰을 Tailwind로 강제한다(정의에 그치지 않는다)

## 스택

- Next.js 16.2 (App Router) · React 19 · TypeScript 5 (strict)
- Tailwind CSS 4 — 디자인 토큰은 `src/app/globals.css`의 `@theme`이 유일한 원천
- Node 24 (Active LTS)

## 검사 — 로컬 한 커맨드

```bash
npm run check   # typecheck(tsc --noEmit) + lint(eslint, warning도 실패)
```

이 커맨드가 CI 머지 게이트의 필수 체크가 된다(ops-workflow#10).

## 스타일 규율 — 구조로 강제

토큰(`@theme`)을 Tailwind 유틸리티로만 소비한다. 다음 이탈은 린트가 거부한다:

| 이탈 | 거부 규칙 |
|---|---|
| `<style>` 블록 | `react/forbid-elements` |
| 인라인 `style` prop | `react/forbid-dom-props` · `react/forbid-component-props` |
| 임의 값 (`bg-[#123]`, `p-[13px]`) | `tailwindcss/no-arbitrary-value` |
| 토큰 밖 커스텀 클래스 | `tailwindcss/no-custom-classname` |
| 별도 CSS 반입 (CSS Modules 포함) | `no-restricted-imports` (globals.css만 허용) |
| `src/` 안 JS 파일 | `no-restricted-syntax` (TypeScript만 — ADR-0013) |

색·간격이 더 필요하면 마크업에 값을 적지 말고 `globals.css`의 `@theme`에 토큰을 추가한다.
정말 예외가 필요하면 `eslint-disable` 주석으로 명시해 리뷰에 드러낸다.

## 개발

```bash
npm run dev     # 개발 서버
npm run build   # 프로덕션 빌드
```
