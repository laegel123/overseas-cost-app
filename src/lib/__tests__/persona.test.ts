/**
 * persona.ts — 페르소나 라벨·아이콘 매핑 단일 출처 검증.
 * TESTING.md §9.31.
 */

import { PERSONA_ICON, PERSONA_LABEL, PERSONA_SUB } from '@/lib/persona';
import type { Persona } from '@/types/city';

const PERSONAS: Persona[] = ['student', 'worker', 'unknown'];

describe('persona 라벨/아이콘 단일 출처', () => {
  it('PERSONA_LABEL — 3종 모두 한글 라벨', () => {
    expect(PERSONA_LABEL.student).toBe('유학생');
    expect(PERSONA_LABEL.worker).toBe('취업자');
    expect(PERSONA_LABEL.unknown).toBe('아직 모름');
  });

  it('PERSONA_SUB — 3종 모두 비어있지 않은 sub 텍스트', () => {
    PERSONAS.forEach((p) => {
      expect(PERSONA_SUB[p]).toBeTruthy();
      expect(PERSONA_SUB[p].length).toBeGreaterThan(0);
    });
  });

  it('PERSONA_ICON — 3종 모두 IconName 키 존재', () => {
    expect(PERSONA_ICON.student).toBe('graduation');
    expect(PERSONA_ICON.worker).toBe('briefcase');
    expect(PERSONA_ICON.unknown).toBe('user');
  });

  it('모든 페르소나 키 동일 (label / sub / icon)', () => {
    const labelKeys = Object.keys(PERSONA_LABEL).sort();
    const subKeys = Object.keys(PERSONA_SUB).sort();
    const iconKeys = Object.keys(PERSONA_ICON).sort();
    expect(labelKeys).toEqual(subKeys);
    expect(labelKeys).toEqual(iconKeys);
    expect(labelKeys).toEqual(['student', 'unknown', 'worker']);
  });
});
