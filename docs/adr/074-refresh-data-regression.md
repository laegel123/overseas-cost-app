[← ADR 인덱스](../ADR.md)

# ADR-074: 강제 새로고침이 도시 데이터를 잃지 않는다 + 시드 = 실데이터 전량

**상태:** 채택 (2026-09-07)

**ADR-045 supersede** (시드 = fixture 2도시 한시 정책 종료)

**맥락:**

2026-09-07 시뮬레이터에서 설정 화면 "데이터 최신화" 새로고침 후 **도시 목록이 21개에서 2개로 무너지는** 현상이 재현됐다.
앱 AsyncStorage 를 직접 확인한 결과:

| 키 | 값 |
|---|---|
| `data:all:v1` | **없음** — 삭제된 뒤 재저장되지 않음 |
| `meta:lastSync` | `2026-09-07T04:27:45Z` (이전 성공 시각에서 멈춤) |
| `meta:fxLastSync` | `2026-09-07T05:20:33Z` (환율만 갱신) |

새로고침 시점에 환율은 성공했으나 도시 batch fetch 가 실패했다. 원격 `data/all.json` 자체는 정상이었다
(GitHub raw · jsDelivr 모두 200, 21개 도시 전부 `validateCity` 통과). 즉 **일시적 fetch 실패 한 번이 영구적 데이터 소실로 확대**된 것이다.

세 가지 결함이 겹쳤다:

1. `refreshCache()` 가 `safeRemoveCache()` 로 캐시를 **먼저 지웠다.** 그런데 뒤이은 호출은 `bypassCache: true` 라
   캐시를 읽지도 않는다 — 삭제의 유일한 실효는 "실패 시 되돌아갈 사본 제거" 였다.
2. `loadAllCities` 가 네트워크 실패를 시드 fallback 으로 흡수하고 **성공을 반환**했다. 콜드스타트에는 옳은 정책이지만,
   강제 새로고침에서는 21개 → 시드로의 조용한 퇴행이 된다.
3. 시드가 ADR-045 의 fixture 2도시(서울·밴쿠버, 4,330B)로 고정돼 있어 퇴행의 바닥이 2개였다.
   ADR-045 §3·§4 는 "출시 전 실 데이터로 교체" 를 전제했으나 교체 경로가 없었다 — `build_data.mjs` 가
   ADR-045 를 근거로 시드를 의도적으로 덮어쓰지 않았다.

사용자 관점에서는 "생활비만 갱신되어야 하는데 도시가 사라졌다" 로 보인다. 실제로 앱에는 도시 목록 저장소가 따로 없고
`data/all.json` 하나가 도시 목록과 생활비를 겸하므로, 이 파일을 못 받으면 목록 자체가 사라진다.

**결정:**

1. `refreshCache()` 는 캐시를 미리 지우지 않는다. `bypassCache: true` 가 이미 캐시 무시를 보장한다.
   실패 시 이전 캐시가 남아 다음 콜드스타트가 데이터를 복원한다.
2. `loadAllCities` 에 `allowSeedFallback` 옵션을 추가한다 (기본 `true`).
   `refreshCache` 만 `false` 로 호출한다 — 네트워크 실패를 시드로 덮지 않고 원 에러를 그대로 throw 한다.
   `citiesInMemory` 갱신 **전에** throw 되므로 화면의 도시 목록도 그대로 유지된다.
3. 따라서 새로고침 실패는 `ok: false` 로 정직하게 보고되고, 설정 화면이 "갱신 실패" 를 표시한다
   (기존 `refreshState = 'error'` 경로가 사실상 죽어 있었다 — 이제 실제로 도달한다).
4. `data/seed/all.json` 은 실 도시 데이터 전량(21개)을 담는다. `scripts/build_data.mjs` 가 `data/all.json` 과
   시드를 **같은 내용으로 함께** 쓴다. refresh 워크플로우들은 이미 `git add data/seed/all.json` 하고 있으므로
   자동화가 도는 한 시드는 최신 실데이터로 유지된다 — 드리프트가 구조적으로 차단된다.
   단 `data/cities` 가 비어 시드를 소스로 읽은 빌드에서는 시드를 다시 쓰지 않는다 (자기 참조).

**대안 검토:**

- (A) 캐시 선삭제만 제거: 이번 소실은 막지만, 신규 설치 + 오프라인 사용자는 여전히 2개만 본다. 불충분 — 4 와 병행.
- (B) `refreshCache` 가 `loadFromNetwork()` 를 직접 호출: `loadAllCities` 의 in-flight dedup·캐시 저장 흐름을
  우회해 중복 fetch 가 생긴다. 옵션 하나로 끝나는 문제에 경로를 이중화할 이유가 없다. 거부.
- (C) 시드를 일회성으로 복사: 자동화가 `all.json` 만 갱신하므로 시드가 다시 낡는다. 같은 사고가 재발한다. 거부 — 4 가 빌드 단계에서 강제.
- (D) 시드 제거 후 실패 시 ErrorView: 첫 콜드스타트 + 오프라인이 빈 화면이 된다. `docs/ARCHITECTURE.md` §캐시·오프라인 전략 위반. 거부.

**결과 / 영향:**

- 앱 번들 +~47KB (시드 4,330B → 51,783B). 무시 가능한 수준이며, 오프라인 첫 실행 품질이 2도시 → 21도시로 올라간다.
- ADR-045 의 "fixture seed 상태로 production 빌드 금지" 게이트는 불필요해진다 — 시드가 곧 실데이터다.
- **알려진 한계 (ADR-046 유지):** 다른 `loadAllCities` 호출이 in-flight 면 그 Promise 가 재사용되어
  `allowSeedFallback: false` 가 적용되지 않을 수 있다. 이 경우에도 캐시 선삭제가 없으므로 데이터 소실은 없고,
  최대 영향은 "실패를 성공으로 보고" 에 그친다. v2 에서 재검토.
- 회귀 테스트: `refreshCache` 실패 시 ① `ok: false` ② 도시 맵 보존 ③ 캐시 보존 3건 + `allowSeedFallback: false`
  throw 1건 + 시드 21개 계약 (`seed-roundtrip.test.ts`) 을 고정했다.
  구 테스트 중 "시드가 성공하므로 ok=true" 를 단언하던 케이스가 바로 이 버그를 정상으로 못박고 있었다 — 뒤집었다.

**관련:** ADR-045 (supersede 대상), ADR-046 (in-flight dedup), ADR-048 (부분 가용성), `docs/DATA.md`, `docs/AUTOMATION.md`.
