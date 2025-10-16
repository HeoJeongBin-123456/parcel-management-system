/**
 * ESLint Configuration
 * Based on Parcel Management System Constitution
 * Enforces clean code, security, and reusability principles
 */

module.exports = {
  env: {
    browser: true,
    node: true,
    es2021: true,
  },

  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },

  extends: [
    'eslint:recommended',
  ],

  rules: {
    /**
     * I. Clean Code Principles
     * Enforce readability, maintainability, and proper code organization
     */

    // 파일 크기 제한 (MAX_FILE_LINES: 500)
    'max-lines': [
      'warn',
      {
        max: 500,
        skipBlankLines: true,
        skipComments: true,
      },
    ],

    // 함수 길이 제한 (MAX_FUNCTION_LINES: 50)
    'max-lines-per-function': [
      'warn',
      {
        max: 50,
        skipBlankLines: true,
        skipComments: true,
        IIFEs: true,
      },
    ],

    // 중첩 depth 제한 (MAX_NESTING_DEPTH: 3)
    'max-depth': ['warn', 3],

    // 함수 매개변수 개수 제한
    'max-params': ['warn', 4],

    // 복잡도 제한 (순환 복잡도)
    'complexity': ['warn', 10],

    // 한 줄 최대 길이 (가독성)
    'max-len': [
      'warn',
      {
        code: 120,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      },
    ],

    /**
     * II. No Hard Coding
     * Prevent API keys, secrets, and credentials in code
     */

    // 매직 넘버 제한
    'no-magic-numbers': [
      'warn',
      {
        ignore: [-1, 0, 1, 2],
        enforceConst: true,
        detectObjects: true,
      },
    ],

    /**
     * III. Code Reusability
     * Prevent code duplication and encourage DRY principles
     */

    // 중복된 키 제한
    'no-dupe-keys': 'error',

    // 중복된 케이스 레이블 제한
    'no-duplicate-case': 'error',

    /**
     * IV. Clear Naming Conventions
     * Enforce consistent and clear variable/function naming
     */

    // camelCase 강제 (변수, 함수)
    'camelcase': [
      'warn',
      {
        properties: 'never',
        ignoreDestructuring: false,
        ignoreImports: false,
      },
    ],

    // 상수는 UPPER_SNAKE_CASE
    'id-match': [
      'warn',
      '^([a-z_][a-z0-9_]*|[A-Z_][A-Z0-9_]*)$',
      {
        properties: false,
        classFields: false,
      },
    ],

    // 의미있는 변수명 (한글자 변수 제한)
    'id-length': [
      'warn',
      {
        min: 2,
        exceptions: ['i', 'j', 'k', 'x', 'y', 'z', 'a', 'b', '_'],
      },
    ],

    /**
     * V. Consistent Coding Style
     * Enforce consistent code formatting and style
     */

    // 들여쓰기 일관성 (2 spaces)
    'indent': ['warn', 2, { SwitchCase: 1 }],

    // 따옴표 일관성 (작은따옴표 또는 큰따옴표)
    'quotes': ['warn', 'single', { avoidEscape: true }],

    // 세미콜론 일관성
    'semi': ['warn', ';'],

    // 줄 끝 쉼표
    'comma-dangle': ['warn', 'always-multiline'],

    // 연산자 주위 공백
    'operator-spacing': ['warn', { before: true, after: true }],

    // 키워드 주위 공백
    'keyword-spacing': ['warn', { before: true, after: true }],

    // 블록 주변 공백
    'space-before-blocks': 'warn',

    /**
     * VI. Production Quality Standards
     * Enforce error handling and robustness
     */

    // 미사용 변수 금지
    'no-unused-vars': [
      'warn',
      {
        vars: 'local',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],

    // 미선언 변수 금지
    'no-undef': 'error',

    // console 사용 제한 (프로덕션에서는 에러)
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // debugger 제거
    'no-debugger': 'warn',

    // 빈 블록 제한
    'no-empty': ['warn', { allowEmptyCatch: true }],

    // eval 금지
    'no-eval': 'error',

    // 암시적 전역 변수 금지
    'no-implicit-globals': 'warn',

    // 동기 throw 금지 (비동기에서 사용)
    'no-throw-literal': 'warn',

    // 에러 객체 반환
    'no-return-assign': 'warn',

    // 조건식 추가 할당
    'no-cond-assign': 'error',

    // 상수 조건문
    'no-constant-condition': ['warn', { checkLoops: false }],

    // return 문 누락
    'no-implicit-coercion': 'warn',

    // 선언되지 않은 변수
    'no-shadow': ['warn', { builtinGlobals: false }],

    // 연속 선언
    'one-var': ['warn', { initialized: 'never' }],

    // 함수 선언 순서
    'no-use-before-define': ['warn', { functions: false }],

    /**
     * Best Practices
     */

    // 등호 연산자 일관성
    'eqeqeq': ['warn', 'always', { null: 'ignore' }],

    // null 체크 명시
    'no-eq-null': 'off',

    // 삼항 연산자 중첩 제한
    'no-nested-ternary': 'warn',

    // 불린 값 직접 반환
    'no-unneeded-ternary': 'warn',

    // 배열 콜백에서 return 문
    'array-callback-return': 'warn',

    // for-in 루프에서 hasOwnProperty 체크
    'guard-for-in': 'warn',

    // 루프 내 함수 정의 금지
    'no-loop-func': 'warn',

    // 루프 변수 재할당 금지
    'no-param-reassign': ['warn', { props: false }],
  },

  // 파일별 규칙 오버라이드
  overrides: [
    {
      files: ['**/*.spec.js', '**/*.test.js', 'tests/**/*.js'],
      env: {
        jest: true,
      },
      rules: {
        'max-lines': 'off',
        'max-lines-per-function': 'off',
        'no-magic-numbers': 'off',
      },
    },
    {
      files: ['*.config.js', '.eslintrc.js'],
      rules: {
        'max-lines': 'off',
      },
    },
  ],
};
