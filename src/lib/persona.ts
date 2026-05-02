/**
 * 페르소나 라벨·아이콘 매핑 — UI_GUIDE.md §i18n 카탈로그 단일 출처.
 *
 * Settings 화면의 페르소나 카드, 변경 flow 등에서 사용.
 * CLAUDE.md CRITICAL: 컴포넌트 하드코딩 금지, 본 모듈에서만 정의.
 */

import type { IconName } from '@/components/Icon';
import type { Persona } from '@/types/city';

export const PERSONA_LABEL: Record<Persona, string> = {
  student: '유학생',
  worker: '취업자',
  unknown: '미선택',
};

export const PERSONA_SUB: Record<Persona, string> = {
  student: '서울에서 출발 · 학비 중심',
  worker: '서울에서 출발 · 실수령 중심',
  unknown: '둘 다 보여드려요',
};

export const PERSONA_ICON: Record<Persona, IconName> = {
  student: 'graduation',
  worker: 'briefcase',
  unknown: 'user',
};
