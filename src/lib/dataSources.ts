/**
 * 데이터 출처 메타 — 설정 화면 "데이터 출처 보기" 의 출처 유형 총수.
 *
 * 단일 출처: `docs/DATA_SOURCES.md` 의 머신 마커 `<!-- DATA_SOURCES_COUNT: N -->`.
 * 본 상수는 그 마커와 **반드시 일치**해야 하며, `__tests__/dataSources.test.ts`
 * 가 doc 마커와의 동기화를 CI 에서 강제한다 (불일치 시 빌드 red). 출처 유형을
 * 추가/제거할 때는 (1) DATA_SOURCES.md 마커, (2) 본 상수 둘 다 갱신 — 누락 시
 * 테스트가 실패하므로 silent drift 불가 (이전엔 settings.tsx 하드코딩 수동 동기화).
 */
export const DATA_SOURCES_COUNT = 12;
