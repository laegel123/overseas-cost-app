[← ADR 인덱스](../ADR.md)

# ADR-023: 앱 업데이트 메커니즘 — EAS Update 우선, 네이티브 변경만 새 바이너리

> **상태**: Active

**결정**: UI·문구·데이터 fetch URL 등 JS-only 변경은 EAS Update 로 OTA. 네이티브 의존성·권한·`runtimeVersion` 변경은 새 바이너리 + 스토어 심사.
**이유**: 사이드 프로젝트는 출시 빈도가 낮을수록 좋음. EAS Update 로 패치 사이클 단축. 한편 OTA 가 네이티브 영역까지 변경하면 사고 가능 → 명확히 분리.
**트레이드오프**: 사용자가 강제 업데이트 받지 않음 (v1.0). 호환성 깨짐 시 startup gate 필요 → v1.1 검토.
