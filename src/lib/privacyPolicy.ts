/**
 * 개인정보 처리방침 본문 — **단일 출처** (ADR-072).
 *
 * 본문 데이터는 `privacyPolicy.json` 에 있고 본 모듈이 타입을 입혀 노출한다.
 * JSON 인 이유: `scripts/gen_privacy_docs.mjs` (ESM) 도 같은 정본을 읽어야 하는데
 * `.ts` 는 node 로 직접 실행할 수 없기 때문이다.
 *
 * 소비처:
 *   - `app/privacy.tsx` (인앱 화면)
 *   - `scripts/gen_privacy_docs.mjs` → `docs/privacy-policy.html` (스토어 등록 URL) + `docs/PRIVACY.md`
 *
 * 본문을 고칠 때: `privacyPolicy.json` 만 수정 → `updatedAt` 갱신 → `npm run gen:privacy`.
 * 생성물을 직접 편집하면 `scripts/__tests__/gen_privacy_docs.test.ts` 가 CI 에서 실패한다.
 *
 * 정책:
 *   - 섹션 번호(`1.`, `2.` …)는 `title` 에 넣지 않는다 — 렌더 시점에 붙인다.
 *   - 저장 항목 서술은 `src/store/*.ts` 의 persist 설정과 일치해야 한다 (법적 문서).
 *   - ADR-067 로 제거된 개념을 본문에 되살리지 않는다 — 회귀 방지 단언이 테스트에 있다.
 */
import policyData from './privacyPolicy.json';

export type PrivacyBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  /** 탭하면 mailto 로 열리는 연락처 줄. 화면·HTML 양쪽에서 링크가 된다. */
  | { kind: 'email'; label: string; email: string };

export type PrivacySection = {
  /** 예: '수집·저장 정보' — 번호는 렌더 시점에 붙인다. 본문에 하드코딩하지 말 것. */
  title: string;
  blocks: PrivacyBlock[];
};

export type PrivacyPolicy = {
  appName: string;
  /** 리드 문단 — '본 앱은 사용자 개인정보를 수집하지 않습니다.' */
  lead: string;
  operatorEmail: string;
  sections: PrivacySection[];
  /** 'YYYY-MM-DD' — 본문을 고칠 때 사람이 함께 올린다. */
  updatedAt: string;
};

// JSON import 는 리터럴에서 추론된 구조 타입이라 discriminated union (`kind`) 으로 좁혀지지
// 않는다. 형태 일치는 `__tests__/privacyPolicy.test.ts` 가 검증한다.
export const PRIVACY_POLICY: PrivacyPolicy = policyData as PrivacyPolicy;
