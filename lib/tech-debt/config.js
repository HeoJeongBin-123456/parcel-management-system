/**
 * Technical Debt Scanner Configuration
 * Based on Parcel Management System Constitution
 */

module.exports = {
  // 스캔 대상 파일 (Glob 패턴)
  include: [
    'public/js/**/*.js',
    'lib/**/*.js',
    'api/**/*.js',
    'tests/**/*.js',
  ],

  // 스캔 제외 대상
  exclude: [
    'node_modules/**',
    '**/*.min.js',
    'vendor/**',
    'dist/**',
    'build/**',
    '.git/**',
  ],

  // 파일 크기 제한 (헌법: Clean Code Principles)
  maxFileLines: 500,

  // 최대 함수 길이 (헌법: Clean Code Principles)
  maxFunctionLines: 50,

  // 최대 중첩 depth (헌법: Clean Code Principles)
  maxNestingDepth: 3,

  // 하드코딩 검출 패턴 (헌법: No Hard Coding)
  secretPatterns: [
    /API_KEY\s*=\s*['"][^'"]+['"]/gi,
    /[A-Z_]+_SECRET\s*=\s*['"][^'"]+['"]/gi,
    /(password|passwd|pwd)\s*=\s*['"][^'"]+['"]/gi,
    /Bearer\s+[A-Za-z0-9\-_.]{20,}/g,
    /(auth|token):\s*['"][A-Za-z0-9\-_.]{20,}['"]/gi,
  ],

  // 네이밍 컨벤션 규칙 (헌법: Clear Naming Conventions)
  namingRules: {
    // camelCase 변수명
    variables: /^[a-z][a-zA-Z0-9]*$/,
    // PascalCase 클래스/컴포넌트명
    classes: /^[A-Z][a-zA-Z0-9]*$/,
    // UPPER_SNAKE_CASE 상수명
    constants: /^[A-Z_][A-Z0-9_]*$/,
    // 약어 금지 검사
    abbreviations: /\b[a-z]{1,2}\b(?!_)/g,
  },

  // 리포트 설정
  report: {
    output: 'TECHNICAL_DEBT.md',
    includeResolved: true,
    maxResolvedAge: 90, // 90일 이상 된 해결 항목은 아카이브
  },

  // 성능 설정
  performance: {
    maxConcurrency: 10,     // 동시 스캔 파일 수
    timeout: 30000,         // 전체 스캔 타임아웃 (ms)
  },

  // 심각도 정의 (헌법 원칙과 매핑)
  severityLevels: {
    Critical: {
      description: '시스템 안정성 위협',
      slaInDays: 7,
      principles: ['I. Clean Code Principles', 'VI. Production Quality Standards'],
    },
    High: {
      description: '유지보수에 심각한 장애',
      slaInDays: 30,
      principles: ['Clean Code', 'No Hard Coding', 'Consistent Coding Style'],
    },
    Medium: {
      description: '생산성 저하',
      slaInDays: 90,
      principles: ['Code Reusability', 'Clear Naming Conventions'],
    },
    Low: {
      description: '개선 권장 사항',
      slaInDays: 180,
      principles: ['Consistent Coding Style', 'Production Quality Standards'],
    },
  },

  // 헌법 원칙 매핑
  constitutionPrinciples: [
    {
      id: 'I',
      name: 'Clean Code Principles',
      rules: [
        'maxFileLines: 500줄 제한',
        'maxFunctionLines: 50줄 제한',
        'maxNestingDepth: 3단계 제한',
      ],
    },
    {
      id: 'II',
      name: 'No Hard Coding',
      rules: [
        'API 키와 시크릿은 .env 필수',
        '매직 넘버는 명명된 상수로 선언',
        'URL은 설정 파일에 분리',
      ],
    },
    {
      id: 'III',
      name: 'Code Reusability',
      rules: [
        '동일 로직 2회 반복 시 함수화 필수',
        '기존 유틸리티 함수 재사용',
      ],
    },
    {
      id: 'IV',
      name: 'Clear Naming Conventions',
      rules: [
        '변수: camelCase',
        '함수: 동사로 시작 (get, set, fetch, handle)',
        '상수: UPPER_SNAKE_CASE',
        '약어 사용 금지',
      ],
    },
    {
      id: 'V',
      name: 'Consistent Coding Style',
      rules: [
        'ESLint 적용 필수',
        '2 스페이스 들여쓰기',
        '싱글 쿼트 사용',
        '세미콜론 명시적 사용',
      ],
    },
    {
      id: 'VI',
      name: 'Production Quality Standards',
      rules: [
        '모든 API 호출에 에러 핸들링 필수',
        '사용자 입력 검증 필수',
        '로딩/에러 상태 UI 표시',
        'API 응답 시간 2초 이내 목표',
      ],
    },
  ],
};
