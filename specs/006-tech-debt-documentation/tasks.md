# Tasks: 기술 부채 문서화 시스템

**Input**: Design documents from `/specs/006-tech-debt-documentation/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `lib/`, `tests/` at repository root
- Paths shown below use project structure from plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create lib/tech-debt directory structure (lib/tech-debt/validators, lib/tech-debt/reporters, lib/tech-debt/utils, lib/tech-debt/cli)
- [ ] T002 [P] Add npm scripts to package.json (scan:debt, validate:debt, debt:stats, debt:add, debt:update)
- [ ] T003 [P] Initialize .gitignore with lib/tech-debt/ patterns if missing

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create lib/tech-debt/config.js with constitution-based settings (MAX_FILE_LINES=500, include/exclude patterns, secretPatterns)
- [ ] T005 [P] Implement lib/tech-debt/utils/file-reader.js with async file reading (getFileLineCount, readFileContent functions)
- [ ] T006 [P] Implement lib/tech-debt/utils/git-integration.js for changed files detection (getChangedFiles, getGitRoot functions)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 기술 부채 현황 파악 (Priority: P1) 🎯 MVP

**Goal**: 개발자가 5분 내 헌법 위반 사항 3가지 파악 가능

**Independent Test**: TECHNICAL_DEBT.md 생성 후 문서를 읽고 5분 내 위반 사항 3가지와 헌법 원칙 식별 가능

### Implementation for User Story 1

- [ ] T007 [P] [US1] Implement lib/tech-debt/validators/file-size.js to check files against MAX_FILE_LINES limit
- [ ] T008 [P] [US1] Implement lib/tech-debt/validators/hardcoding.js to detect API keys and secrets using regex patterns from config
- [ ] T009 [P] [US1] Implement lib/tech-debt/validators/naming.js to validate camelCase, UPPER_SNAKE_CASE conventions
- [ ] T010 [US1] Implement lib/tech-debt/scanner.js main scan logic (scanCodebase, scanFile, processViolations functions with Promise.all for parallel processing)
- [ ] T011 [US1] Implement lib/tech-debt/reporters/markdown.js to generate TECHNICAL_DEBT.md with severity sections and debt items
- [ ] T012 [US1] Create initial TECHNICAL_DEBT.md template at project root with header and change log structure
- [ ] T013 [US1] Run scanner on current codebase and generate first tech debt report (document TD-001: parcel.js file size, TD-002: API key risks)
- [ ] T014 [US1] Verify TECHNICAL_DEBT.md contains identified violations with severity, principle, and file paths

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently (MVP achieved - transparent tech debt visibility)

---

## Phase 4: User Story 2 - 개선 계획 수립 및 추적 (Priority: P2)

**Goal**: 각 기술 부채 항목에 개선 계획 수립 및 진행 상황 추적 가능

**Independent Test**: TD-001 항목의 개선 계획을 읽고 "언제까지, 누가, 어떻게" 질문에 답변 가능

### Implementation for User Story 2

- [ ] T015 [P] [US2] Implement lib/tech-debt/cli/add.js for interactive debt item creation (prompts for file, violation, severity, principle, assignee)
- [ ] T016 [P] [US2] Implement lib/tech-debt/cli/update.js for status updates (--status, --assignee, --note, --resolve flags)
- [ ] T017 [US2] Enhance lib/tech-debt/reporters/markdown.js to include ImprovementPlan section (strategy, estimatedEffort, priority, deadline fields)
- [ ] T018 [US2] Add improvement plans to existing debt items in TECHNICAL_DEBT.md (TD-001: 5-module split strategy, 2 weeks; TD-002: move to .env, 3 days)
- [ ] T019 [US2] Test CLI commands: add new debt item TD-003, update TD-001 status to "In Progress", add progress note
- [ ] T020 [US2] Verify TECHNICAL_DEBT.md reflects CLI changes with proper formatting

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently (Transparency + Actionable plans)

---

## Phase 5: User Story 3 - 헌법 준수 검증 자동화 (Priority: P3)

**Goal**: 커밋 시 자동 검증으로 신규 기술 부채 발생 차단

**Independent Test**: 600줄 파일 생성 후 git commit 시 경고 표시 확인

### Implementation for User Story 3

- [ ] T021 [P] [US3] Update .eslintrc.js with constitution-based rules (max-lines: 500, max-depth: 3, camelcase, no-magic-numbers)
- [ ] T022 [P] [US3] Install husky and lint-staged as devDependencies if not present
- [ ] T023 [US3] Create .husky/pre-commit hook that runs scanner in --quick --severity Critical,High mode
- [ ] T024 [US3] Configure lint-staged in package.json to run ESLint and quick scan on *.js files
- [ ] T025 [US3] Test pre-commit hook: create test file with 600 lines, attempt commit, verify rejection
- [ ] T026 [US3] Test ESLint rules: add hardcoded API_KEY, run ESLint, verify error message
- [ ] T027 [US3] Implement lib/tech-debt/reporters/stats.js for statistics (--chart, --by-principle, --history flags)
- [ ] T028 [US3] Test stats command: run npm run debt:stats, verify output shows 2 High items, 40% Clean Code violations

**Checkpoint**: All user stories should now be independently functional (Transparency + Plans + Prevention)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T029 [P] Add error handling to all file operations (EACCES, EISDIR, ENOENT with graceful degradation)
- [ ] T030 [P] Add --dry-run, --silent, --output, --format json flags to scanner.js
- [ ] T031 [P] Create lib/tech-debt/validators/markdown-schema.js for TECHNICAL_DEBT.md structure validation
- [ ] T032 Test full workflow end-to-end: scan → add improvement plan → update status → verify in document
- [ ] T033 [P] Add JSDoc comments to all exported functions (scanner, validators, reporters)
- [ ] T034 [P] Update README.md or create docs/TECH_DEBT_GUIDE.md with quickstart instructions
- [ ] T035 Run ESLint on all lib/tech-debt files and fix warnings
- [ ] T036 Verify performance: scan 3000-line codebase completes in under 30 seconds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Uses markdown reporter from US1 but enhances it (can work in parallel)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Uses scanner from US1 but adds automation layer (can work in parallel)

### Within Each User Story

- Validators can be implemented in parallel (T007-T009 marked [P])
- Scanner depends on validators being complete
- Reporter depends on scanner structure
- CLI commands depend on reporter structure
- Final verification depends on all implementation

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Validators within US1 marked [P] can run in parallel (T007-T009)
- CLI commands within US2 marked [P] can run in parallel (T015-T016)
- ESLint config and Husky setup within US3 marked [P] can run in parallel (T021-T022)

---

## Parallel Example: User Story 1

```bash
# Launch all validators for User Story 1 together:
Task: "Implement lib/tech-debt/validators/file-size.js"
Task: "Implement lib/tech-debt/validators/hardcoding.js"
Task: "Implement lib/tech-debt/validators/naming.js"

# After validators complete, proceed sequentially:
Task: "Implement lib/tech-debt/scanner.js" (depends on validators)
Task: "Implement lib/tech-debt/reporters/markdown.js" (depends on scanner)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Generate TECHNICAL_DEBT.md, read it, identify 3 violations in 5 minutes
5. Deploy/demo if ready (MVP = Tech Debt Transparency)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! - Visibility achieved)
3. Add User Story 2 → Test independently → Deploy/Demo (Actionable plans added)
4. Add User Story 3 → Test independently → Deploy/Demo (Prevention automation added)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Scanner + Validators + Reporter)
   - Developer B: User Story 2 (CLI commands)
   - Developer C: User Story 3 (Automation)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Tests are NOT included as they were not explicitly requested in the specification
- Focus on creating TECHNICAL_DEBT.md document and automation tools
- All file paths are relative to project root: /Users/ai-code-lab/projects/parcel-management-system/

---

## Task Count Summary

- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 3 tasks
- **Phase 3 (User Story 1 - P1)**: 8 tasks → MVP
- **Phase 4 (User Story 2 - P2)**: 6 tasks
- **Phase 5 (User Story 3 - P3)**: 8 tasks
- **Phase 6 (Polish)**: 8 tasks
- **Total**: 36 tasks

### Parallel Opportunities Identified

- **Setup**: 2 tasks can run in parallel (T002, T003)
- **Foundational**: 2 tasks can run in parallel (T005, T006)
- **US1**: 3 validators can run in parallel (T007-T009)
- **US2**: 2 CLI commands can run in parallel (T015-T016)
- **US3**: 2 setup tasks can run in parallel (T021-T022)
- **Polish**: 5 tasks can run in parallel (T029-T031, T033-T034)

**Total Parallel Groups**: 6 groups with 16 parallelizable tasks

### Independent Test Criteria

- **User Story 1**: Open TECHNICAL_DEBT.md → Identify 3 violations with principles in 5 minutes → PASS
- **User Story 2**: Read TD-001 → Answer "2 weeks, TBD, 5-module split" → PASS
- **User Story 3**: Create 600-line file → git commit → See warning → PASS

### Suggested MVP Scope

**MVP = Phase 1 + Phase 2 + Phase 3 (User Story 1)**
- Deliverable: TECHNICAL_DEBT.md with current violations
- Value: Tech debt transparency - teams can see what needs fixing
- Tasks: T001-T014 (14 tasks)
- Time estimate: 3-5 days
- Success: Document readable in 5 minutes, shows parcel.js violation

After MVP validation, add Phase 4 (planning) and Phase 5 (automation) incrementally.
