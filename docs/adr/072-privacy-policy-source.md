[← ADR 인덱스](../ADR.md)

# ADR-072: 개인정보 처리방침 본문 단일 출처 = `src/lib/privacyPolicy.ts`

> **상태**: Active

**맥락:**

같은 처리방침 본문이 세 곳에 손으로 복사돼 있었다.

| 위치 | 성격 | 마지막 갱신 |
| --- | --- | --- |
| `docs/privacy-policy.html` | **출시 정본**. GitHub Pages 호스팅 + Play Store 등록 URL | 2026-05-09 |
| `docs/PRIVACY.md` | 참고 사본 (ADR-065 가 "참고 자료로 유지" 로 남김) | 2026-05-02 |
| `docs/RELEASE.md` §7 | 작성 가이드용 코드블록 사본 | — |

세 사본은 이미 서로 어긋나 있었다 — 갱신일(2026-05-09 vs 2026-05-02)도, 데이터 자동 갱신 주기 서술도(HTML 은 "환율 매일·가격 매주·임차료 매월·교통/학비/비자 분기", MD 는 "분기마다") 달랐다.

더 심각한 것은 **셋 다 사실과 다른 문장을 담고 있었다**는 점이다.

> 사용자가 선택한 **페르소나(유학생/취업자)**, 즐겨찾기 도시, 최근 본 도시는 사용자 기기 내부 저장소(AsyncStorage)에만 저장됩니다.

페르소나 개념은 ADR-067 로 완전히 제거됐다. 실제 영속화 대상은 `src/store/*.ts` 8개 store (`onboarding` / `favorites` / `recent` / `settings` / `categoryInclusion` / `rentChoice` / `tuitionChoice` / `taxChoice`) 와 `src/lib/{data,currency}.ts` 의 캐시다. 개인정보 처리방침은 스토어 심사·PIPA 대응에 쓰이는 법적 문서이므로 구현과 어긋난 서술을 남겨둘 수 없다.

또한 이 phase 는 처리방침을 **앱 내부 화면**(`/privacy`, ADR-071)으로도 보여준다 — 같은 본문의 네 번째 사본이 생길 자리다.

**결정:**

1. **본문 단일 출처 = `src/lib/privacyPolicy.ts` (+ 정본 데이터 `src/lib/privacyPolicy.json`).** 사람이 편집하는 곳은 여기 하나다. 구조화된 블록(`paragraph` / `list` / `email`)이라 화면과 문서가 같은 데이터를 각자 렌더한다. 섹션 번호(`1.`, `2.` …)는 `title` 에 넣지 않고 렌더 시점에 붙인다 — 섹션이 늘어도 번호가 자동으로 맞는다.
   - 데이터를 JSON 으로 두는 이유: 생성 스크립트가 `.mjs` 라 `.ts` 를 직접 실행할 수 없다. `.ts` 는 JSON 을 읽어 타입을 입히고, `.mjs` 는 같은 JSON 을 `readFile` 로 읽는다. 정본은 여전히 파일 하나다.
2. **`docs/privacy-policy.html` 과 `docs/PRIVACY.md` 는 생성물.** `scripts/gen_privacy_docs.mjs` (`npm run gen:privacy`) 가 두 파일을 만들고, 두 파일 상단에는 "직접 편집 금지 + 재생성 명령" 주석이 박힌다.
3. **드리프트는 테스트가 CI 에서 강제한다.** `scripts/__tests__/gen_privacy_docs.test.ts` 가 `renderHtml(PRIVACY_POLICY)` / `renderMarkdown(PRIVACY_POLICY)` 결과와 커밋된 파일의 **전문 일치**를 단언하고, 실패 메시지로 `npm run gen:privacy` 를 안내한다. ADR-065 가 `DATA_SOURCES_COUNT` 마커에 쓴 것과 같은 기전이되, 마커 한 줄이 아니라 본문 전체가 대상이다.
4. **`docs/RELEASE.md` §7 의 코드블록 사본은 제거하고 정본 링크로 대체한다** (실제 문서 수정은 이 phase 의 후속 step 담당 — 본 ADR 은 결정만 기록).
5. **스토어 등록 URL 은 유지.** `docs/privacy-policy.html` 의 경로·호스팅·`<style>` 블록·레이아웃은 그대로다. 스토어 콘솔 수정이 필요 없고, 심사 항목(링크 작동)이 깨지지 않는다. 리디자인은 이 결정의 범위 밖이다.
6. **페르소나 서술을 실제 저장 항목으로 정정한다** (ADR-067 반영). `src/store/*.ts` 의 persist 설정을 읽어 확인한 사실만 쓰고 — 즐겨찾기 도시, 최근 본 도시, 비교 화면 선택 옵션(월세 형태·학교·연봉), 항목 포함/제외 설정, 온보딩 완료 여부, 마지막 동기화 시각, 그리고 오프라인용 도시 비용·환율 캐시 — 스토어 파일명 대신 사용자가 이해할 표현으로 적는다. 회귀 방지로 `페르소나` / `유학생` / `취업자` 문자열 부재를 테스트가 단언한다.

**대안 검토:**

- **(A) 채택 — TS/JSON 정본 + 문서 2개 생성 + 전문 드리프트 테스트**: 사본이 0개가 되고, 인앱 화면(ADR-071)도 같은 정본을 읽는다. 갱신 절차가 "JSON 고치고 `npm run gen:privacy`" 한 줄로 줄어든다.
- **(B) 기각 — HTML 을 정본으로 두고 TS 를 사본으로**: 드리프트를 강제하려면 HTML 을 파싱해 구조화된 본문과 비교해야 한다. 현실적으로는 "섹션 제목만 비교" 수준으로 약해져 지금과 같은 문장 단위 어긋남을 못 잡는다.
- **(C) 기각 — 생성 없이 사람이 세 곳을 맞춰 쓰기**: 이미 세 사본이 어긋난 채 배포됐다는 것이 이 방식의 실패 증거다.
- **(D) 기각 — `docs/PRIVACY.md` 삭제**: `docs/RELEASE_CHECKLIST.md` 가 참조하고 있고, 마크다운 사본은 생성 비용이 사실상 0 이다.

**결과 / 영향:**

- 신규: `src/lib/privacyPolicy.ts` + `src/lib/privacyPolicy.json`, `scripts/gen_privacy_docs.mjs`, 테스트 2개, `package.json` 의 `gen:privacy` 스크립트.
- 재생성: `docs/privacy-policy.html` / `docs/PRIVACY.md` — `<style>` 블록·레이아웃 무변경, 본문(페르소나 문장 정정·자동 갱신 주기 정합·갱신일)만 바뀐다. 정본이 평문이라 본문 안의 인라인 마크업(`<strong>`, 출처 링크, `<code>`)은 평문으로 정리됐다.
- 갱신 주기 서술은 `docs/AUTOMATION.md` §9 실측치(환율 매일 / 식비 매주 / 월세 매월 / 교통·학비·비자 분기)와 일치시켰다 — `app/sources/[cityId].tsx` 푸터와 같은 문구다.
- `updatedAt` = 2026-09-07 (본 변경일).
- 인앱 `/privacy` 화면(후속 step)은 `PRIVACY_POLICY` 를 `@/lib` 배럴에서 읽는다 — 화면용 본문 복사본을 만들지 않는다.

**관련:** ADR-065 (드리프트 테스트 강제 패턴, Superseded by ADR-071), ADR-067 (페르소나 제거 — 본문 정정 근거), ADR-071 (정책 페이지 인앱 내재화), `docs/RELEASE.md` §6.1·§7, `docs/AUTOMATION.md` §9, `docs/TESTING.md` §9.40·§9-A.11.
