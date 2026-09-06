# Maestro 함정 레퍼런스 (하드-원 사실 모음)

ADR-066 E2E 검증 세션에서 **실증으로 얻은** maestro(2.6.1) + 이 앱 구현의 함정들.
신규 flow 를 저작하거나 실패를 디버깅하기 전에 이 문서를 먼저 읽으면 재발견 비용을 아낀다.

- 러너 전제·실행법: `.maestro/README.md`
- 배치 런북·문서-구현 격차: `.maestro/PLAN.md`
- 인벤토리: `docs/TESTING.md §18-A`
- **실행 전 반드시**: `npm run e2e:check` (환경 프리플라이트 — 아래 §7)
- **디버깅 도구**: `node scripts/e2e/inspect.mjs <query>` (현재 화면 계층 필터 덤프)

---

## 1. 텍스트·id 매칭은 "부분 포함"이 아니라 "전체 매칭 정규식"

`assertVisible: '텍스트'` / `tapOn: '텍스트'` / `id: '...'` 는 **요소 문자열 전체가 정규식에 매칭**되어야 한다.
부분 문자열은 안 잡힌다.

| 실제 요소 | ❌ 안 됨 | ✅ 됨 |
| --- | --- | --- |
| `아직 즐겨찾기가 없어요.\n도시를…` (다중 라인) | `아직 즐겨찾기가 없어요` | `(?s)아직 즐겨찾기가 없어요.*` |
| `세금 데이터가 아직 준비되지 않았어요.` (끝 마침표) | `…않았어요` | `…않았어요.*` |
| `비교, tab, 2 of 4` (탭 접근성 라벨) | `비교` | `비교, tab.*` |
| testID `detail-section-학교 (월 환산)` (괄호) | `id: '…학교 (월 환산)'` | `id: '…학교 \(월 환산\)'` |

- **다중 라인**: `(?s)` DOTALL 로 `.` 가 개행까지 매칭.
- **id 도 정규식**: 괄호 `()` 는 캡처 그룹으로 해석되므로 `\(` `\)` 이스케이프.
- 헷갈리면 `inspect.mjs <일부문자열>` 로 실제 `acc`/`text` 전체 값을 확인하고 그대로 매칭.

## 2. 키보드가 첫 탭을 흡수한다

ScrollView(`Screen scroll`)·BottomSheet 는 키보드가 떠 있을 때 **첫 탭을 키보드 닫기로 흡수**하고
그 탭의 `onPress` 는 발화하지 않는다 (실 사용자도 두 번 탭해야 하는 UX — `keyboardShouldPersistTaps`
기본값 `never`). 검색·직접입력 뒤 바로 탭하면 내비게이션/저장이 "조용히" 실패한다.

- **텍스트 키보드**: 입력 뒤 `- hideKeyboard` (단, ~10% flaky).
- **숫자 키보드(`keyboardType="numeric"`)**: `hideKeyboard` 가 **실패한다** (return 키 부재). 대신 **조건부 재탭**:
  ```yaml
  - tapOn: { id: 'detail-tuition-sheet-save' }
  - runFlow:
      when: { visible: { id: 'detail-tuition-sheet-save' } }  # 남아 있으면 = 첫 탭이 흡수됨
      commands:
        - tapOn: { id: 'detail-tuition-sheet-save' }
  ```
- 근본 개선안: 공유 컴포넌트에 `keyboardShouldPersistTaps="handled"` (별도 ADR 검토 — 프로덕션 변경).

## 3. testID 는 접두사로 붙는다 (순수 노드가 없을 수 있다)

- **BottomSheet**(`TuitionChoiceSheet`/`TaxChoiceSheet`): `testID` 를 자식에 접두사로 전개한다.
  `detail-tuition-sheet` 라는 노드는 **없고** `-backdrop` / `-body` / `-preset-UBC` 등만 있다.
  → 시트 오픈은 `…-body`(내용 있는 시트) 또는 `…-backdrop`(내용이 접근성 미노출인 시트, §5)로 검증.
- **RecentRow / TopBar**: 터치 핸들러가 있는 `Pressable` 에 testID 가 직접 붙는지 확인.
  (RecentRow 는 testID 가 내부 View 에 있지만 좌표 탭이 Pressable 에 닿아 동작 — 단, 키보드 흡수(§2)는 별개.
  온보딩 도시 행도 RecentRow 라 동일 — `onboarding-city-{cityId}` testID 로 탭.)

## 4. `accessibilityRole="button"` 은 자식 텍스트를 라벨로 병합한다

버튼 역할 행(preset 행, 검색 결과 행 등)은 자식 Text 가 **하나의 접근성 라벨로 합쳐진다**.
예: preset-SFU 의 acc = `🎓, SFU, 연 32,000 CAD · 월 287.5만원` → 순수 `SFU` 텍스트 노드가 없다.
→ 텍스트 대신 **행 testID**(`detail-tuition-sheet-preset-SFU`)로 검증. (README 앵커 규약: testID 우선.)

## 5. 접근성에 없으면 단정 불가 = 동시에 접근성 결함 신호

정적 텍스트만 있는 뷰는 iOS 접근성 트리에 아예 안 잡힐 수 있다 (maestro 로 assert 불가 + VoiceOver 로도 안 읽힘).
이번에 발견한 케이스 (앱 개선 후보):

- `TaxChoiceSheet` 무데이터 본문(제목 `연봉 기준 선택` + 안내 문구) → backdrop 만 노출.
- 설정 `menu-app-info` 의 버전 `v1.0.0`(MenuRow `rightText`) → 라벨은 `앱 정보` 뿐.
- `accessible` Pressable 자손인 Switch (`compare-pair-{category}-toggle`) 는 iOS 접근성 트리에서 상태에 따라 사라졌음
  (ON 이면 미노출 — 2026-09-04 검증, e2e-defects step 2 에서 Switch 를 Pressable 밖 형제로 분리 + `accessibilityState.checked` 추가해 해결).

→ flow 는 노출되는 앵커(backdrop, 행 testID)로 대체 검증하고, **접근성 갭은 별도 이슈로 보고**.

## 6. 탭 바 · 딥링크 · launchApp

- **Expo Router 기본 탭 바**: 라벨 접근성 = `라벨, tab, N of M`. → `tapOn: '비교, tab.*'`
  (홈의 `즐겨찾기` 섹션 헤더와 충돌 방지 위해 `, tab` 한정). 탭에는 testID 가 없다.
- **딥링크**(`openLink: overseascost://…`): 앱이 **포그라운드면 대화상자 없이 바로 라우팅**되지만,
  콜드/런처 가로채기 시 iOS `'살까말까'에서 열겠습니까?` 대화상자가 뜬다. 안전망:
  ```yaml
  - openLink: 'overseascost://detail/vancouver/tax'
  - runFlow:
      when: { visible: '열기' }
      commands: [{ tapOn: '열기' }]
  ```
  딥링크 flow 는 후속 flow 를 오염시킬 수 있으니 **배치 마지막**에 두는 게 안전하다.
- **`launchApp`(clearState 없음)**: 화면 상태를 보존하지 않고 **홈 루트로 콜드스타트**한다.
  외부 브라우저 복귀 검증 등은 `home-screen` 으로 assert (설정 화면 복귀 아님).

## 7. 환경: dev build 는 Metro 없이 못 뜬다

Metro(`npm run dev`)가 죽으면 앱은 `No script URL provided` red-box → 이후 모든 flow 가
`onboarding-screen 안 보임` 류로 **연쇄 붕괴**한다. `lsof`(포트 점유)는 죽은 프로세스 잔여/IPv6
때문에 신뢰 불가 — **`curl /status` = `packager-status:running` 실제 응답으로 확인**.
→ `npm run e2e:check` (프리플라이트)가 시뮬레이터·앱 설치·Metro 응답을 하드 게이트로 검사한다.
`e2e`/`e2e:smoke` 는 pre-script 로 자동 실행되므로 별도 호출 불필요.

## 8. takeScreenshot 직후 탭은 유실될 수 있다

`takeScreenshot` 바로 다음 `tapOn` 이 간헐적으로 내비게이션을 놓친다 (동일 시퀀스가 스크린샷 없으면 안정).
→ 스크린샷 뒤 탭에는 §2 와 같은 **조건부 재탭** 가드를 둔다 (`07-visual-a11y/screenshots.yaml` 참고).

---

## 디버깅 루틴 (요약)

1. `npm run e2e:check` — 환경부터 확인 (Metro 死가 최다 원인).
2. 실패 flow 단독 실행 → 실패 스텝 확인.
3. 원인이 안 보이면 **먼저 스크린샷** (대화상자·red-box·키보드가 코드보다 빨리 설명해준다):
   실패 시 maestro 가 `~/.maestro/tests/<타임스탬프>/` 에 자동 저장.
4. `node scripts/e2e/inspect.mjs <일부문자열>` 로 실제 testID·acc·text·bounds(화면밖 여부) 확인.
5. 구현 testID 와 대조(`grep -rn testID app src`) 후 flow 수정 → 재실행.

> 이 루틴을 자동화하려면 `maestro-debugger` 서브에이전트를 쓴다 (`.claude/agents/maestro-debugger.md`).
