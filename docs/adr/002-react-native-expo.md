[← ADR 인덱스](../ADR.md)

# ADR-002: React Native + Expo (Managed Workflow) 채택

> **상태**: Active

**결정**: 프레임워크는 React Native 의 **Expo Managed Workflow**, 라우팅은 **Expo Router** (파일 기반).
**이유**:

- 단일 코드베이스로 iOS·Android 동시 지원 → 1인 사이드 프로젝트에 적합.
- 사용자가 JavaScript/TypeScript 친숙도 1순위.
- Expo Go 로 Mac 없이 iOS 미리보기 가능 → 개발 단계 0원 유지.
- Expo Router 의 파일 기반 라우팅은 Next.js 와 멘탈 모델이 같아 학습 곡선 작음.
- EAS Build / EAS Update 로 OTA 코드 배포 → 스토어 재심사 회피 빈도 ↑.
  **트레이드오프**: Native (Swift / Kotlin) 대비 일부 플랫폼 API 접근 제한. Bare workflow 로 전환할 일이 생기면 마이그레이션 필요. 현재 v1.0 범위에는 Bare 가 필요한 기능 없음.
