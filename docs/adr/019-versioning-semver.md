[← ADR 인덱스](../ADR.md)

# ADR-019: 버전 전략 — Semantic Versioning + runtimeVersion 분리

> **상태**: Active

**결정**: 사용자 노출 버전은 SemVer (`v1.0.0`, `v1.0.1`, `v1.1.0`, `v2.0.0`). EAS Update 호환 키인 `runtimeVersion` 은 별도 정책으로 관리하되, 데이터 스키마·네이티브 의존성 변경 시 무조건 올린다.
**이유**: SemVer 가 사용자·운영자 모두에게 익숙. `runtimeVersion` 분리는 EAS Update 가 구 바이너리에 신 데이터를 보내는 사고를 방지.
**트레이드오프**: 두 버전 동시 관리 부담. 매 릴리스 체크리스트(RELEASE.md §1)로 보완.
