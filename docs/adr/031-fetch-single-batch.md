[← ADR 인덱스](../ADR.md)

# ADR-031: 도시 데이터 fetch — 단일 batch 파일 (`all.json`)

> **상태**: Active

**결정**: 21개 도시(서울 + 20)를 **단일 `data/all.json`** 파일로 호스팅. 앱은 1회 fetch 로 모든 도시 데이터를 확보. 도시별 lazy fetch 채택 안 함.

큐레이터는 여전히 `data/cities/<id>.json` 도시별 파일에 편집(PR diff 가독성). build script (`scripts/build_data.mjs`) 가 분기 갱신 시 `cities/*.json` → `all.json` + `seed/all.json` 자동 합성.

**이유:**

- 모바일 사용자가 여러 도시를 빠르게 비교 → 한 번에 받는 것이 UX 우월
- 21개 합본 gzip 약 30~40KB (사진 1장 미만) → 데이터·시간 부담 무의미
- 24h 캐시 → 일 1회 fetch → GitHub raw rate limit 안전
- 캐시 정합성 (모든 도시 같은 시점 데이터, FX 와 별개로 도시 간 일관)
- 홈 화면 즐겨찾기 mult preview, 검색 기능 모두 즉시 동작 (메타 별도 fetch 불필요)
- 시드도 동일 형식 (`data/seed/all.json`) → 오프라인에서 모든 도시 표시 가능

**트레이드오프:**

- 한 도시만 갱신해도 사용자는 전체 파일 download (단, gzip 40KB 라 무의미)
- 메모리에 21개 도시 상시 로딩 (~150KB raw) — 모바일 부담 미미
- 도시 50개+ 으로 확장 시 (v2~v3) 재검토 필요 (그때 hybrid 또는 lazy 전환 가능)
