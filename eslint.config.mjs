import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tailwind from "eslint-plugin-tailwindcss";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      tailwindcss: tailwind,
    },
    settings: {
      tailwindcss: {
        // Tailwind v4 — 토큰의 원천은 CSS 엔트리포인트다
        cssConfigPath: "src/app/globals.css",
      },
    },
    rules: {
      // ADR-0015 — 토큰을 우회하는 이탈은 린트에서 거부한다.
      // 예외가 정말 필요하면 여기서 규칙을 완화하지 말고 globals.css @theme에 토큰을 추가한다.
      "tailwindcss/no-arbitrary-value": "error",
      "tailwindcss/no-custom-classname": "error",
      "tailwindcss/no-contradicting-classname": "error",
      // 별도 CSS(CSS Modules 포함) 반입 차단 — 토큰 정의는 globals.css 한 곳뿐이다.
      // 정말 예외가 필요하면 eslint-disable 주석으로 명시하고 리뷰에 드러낸다 (ADR-0015 "이탈은 명시적으로만").
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/*.css", "!**/globals.css"],
              message:
                "별도 CSS 반입 금지 — 토큰을 globals.css @theme에 추가하고 유틸리티로 소비한다 (ADR-0015)",
            },
          ],
        },
      ],
      "react/forbid-elements": [
        "error",
        {
          forbid: [
            {
              element: "style",
              message:
                "<style> 블록 금지 — globals.css @theme에 토큰을 추가하고 유틸리티로 소비한다 (ADR-0015)",
            },
          ],
        },
      ],
      "react/forbid-dom-props": [
        "error",
        {
          forbid: [
            {
              propName: "style",
              message: "인라인 스타일 금지 — 토큰 유틸리티를 사용한다 (ADR-0015)",
            },
          ],
        },
      ],
      "react/forbid-component-props": [
        "error",
        {
          forbid: [
            {
              propName: "style",
              message: "인라인 스타일 금지 — 토큰 유틸리티를 사용한다 (ADR-0015)",
            },
          ],
        },
      ],
    },
  },
  {
    // ADR-0013 — 앱 코드는 TypeScript로만 짓는다. JS 파일은 타입 검사를 통째로 우회하므로 존재 자체를 거부한다.
    files: ["src/**/*.js", "src/**/*.jsx", "src/**/*.mjs", "src/**/*.cjs"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Program",
          message: "JS 파일 금지 — TypeScript(.ts/.tsx)로 작성한다 (ADR-0013)",
        },
      ],
    },
  },
  {
    // Playwright 픽스처의 두 번째 인자는 관례상 `use`다 — React Hook과 이름만 같다.
    files: ["e2e/**/*.ts", "playwright.config.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
