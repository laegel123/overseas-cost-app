/**
 * docs/TESTING.md §9.X — theme/tokens.ts (PR #25 7차 review).
 *
 * 토큰 간 종속성을 위해 도입한 hexToRgba 헬퍼 검증 + SHEET_BACKDROP_COLOR
 * 가 colors.navy 에서 정상 파생되는지 확인.
 */

import { colors, hexToRgba, SHEET_BACKDROP_COLOR } from '../tokens';

describe('hexToRgba', () => {
  it('정상 입력 → rgba 문자열 반환', () => {
    expect(hexToRgba('#11263C', 0.4)).toBe('rgba(17, 38, 60, 0.4)');
    expect(hexToRgba('#FFFFFF', 1)).toBe('rgba(255, 255, 255, 1)');
    expect(hexToRgba('#000000', 0)).toBe('rgba(0, 0, 0, 0)');
  });

  it('대소문자 혼용 hex 도 허용', () => {
    expect(hexToRgba('#aB12cD', 0.5)).toBe('rgba(171, 18, 205, 0.5)');
  });

  it('잘못된 hex 형식 → throw', () => {
    expect(() => hexToRgba('11263C', 0.4)).toThrow(/invalid hex format/);
    expect(() => hexToRgba('#ABC', 0.4)).toThrow(/invalid hex format/);
    expect(() => hexToRgba('#1234567', 0.4)).toThrow(/invalid hex format/);
    expect(() => hexToRgba('#GGGGGG', 0.4)).toThrow(/invalid hex format/);
  });

  it('alpha 범위 외 값 → throw', () => {
    expect(() => hexToRgba('#11263C', -0.1)).toThrow(/invalid alpha/);
    expect(() => hexToRgba('#11263C', 1.1)).toThrow(/invalid alpha/);
    expect(() => hexToRgba('#11263C', NaN)).toThrow(/invalid alpha/);
    expect(() => hexToRgba('#11263C', Infinity)).toThrow(/invalid alpha/);
  });
});

describe('SHEET_BACKDROP_COLOR', () => {
  it('colors.navy 에서 0.4 alpha 로 파생', () => {
    expect(SHEET_BACKDROP_COLOR).toBe(hexToRgba(colors.navy, 0.4));
  });

  it('현재 navy 값 (#11263C) 기준 정확한 rgba 표기', () => {
    expect(SHEET_BACKDROP_COLOR).toBe('rgba(17, 38, 60, 0.4)');
  });
});
