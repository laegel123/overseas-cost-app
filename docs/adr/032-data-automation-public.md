[← ADR 인덱스](../ADR.md)

# ADR-032: 데이터 수집 = 공공 출처 100% 자동화 (Supersedes ADR-028)

> **상태**: Active

**결정**: v1.0 부터 21개 도시 데이터를 **공공 출처에서 자동으로 갱신**. GitHub Actions cron + 출처별 `scripts/refresh/<source>.mjs` 스크립트. 수동 큐레이션 **금지**.

**자동화 대상 (모든 카테고리):**

- 임차료: 한국 국토부 / Statistics Canada / HUD·Census (US) / ONS (UK) / Destatis (DE) / INSEE (FR) / CBS (NL) / ABS (AU) / e-Stat (JP) / SingStat (SG) / GSO (VN) / DSC·FCSC (UAE)
- 식재료·외식: 한국소비자원 참가격 + 각국 통계청 CPI
- 교통: 각 교통공사 공식 페이지·API (TfL·MTA·TransLink·BVG·RATP·도쿄메트로·LTA·RTA 등)
- 학비: 각 대학 공식 international tuition 페이지
- 비자: 각국 정부 공식 페이지
- 환율: open.er-api.com (클라이언트 자동) + GitHub Actions backup

**핵심 정책 (CRITICAL):**

- 상업 플랫폼 (Zillow·Kijiji·Yelp·Numbeo·Expatistan 등) **사용 금지** (약관 또는 회색지대)
- 자동화 한계 항목은 sources 에 "static" / "estimated" / "manual-fallback" 마커로 투명하게 표기

**이유**:

- 사용자가 자동화 + 신선도 향상 요구
- 공공 출처는 약관상 자동 fetch 허용 (대부분 무료 API + Open Data 라이선스)
- 데이터 신선도 분기 → 주·월 단위로 향상
- 운영자 부담 70시간/년 → 30~40시간/년 (절반)

**트레이드오프**:

- 데이터 입자도 거침 (도시 평균 vs 동네별·매물별)
- 일부 도시 (호치민·두바이) 정부 데이터 입자도 한계 → "estimated" 마커
- 외식 1끼 가격은 CPI 평균 + 정적 보정계수 (실측 X)
- 자동화 인프라 초기 셋업이 별도 phase 로 추가됨 (Phase 6 data-automation, ~30~50시간)

**상세**: `docs/AUTOMATION.md` (인프라·workflow·script), `docs/DATA_SOURCES.md` (도시별 출처 매핑)
