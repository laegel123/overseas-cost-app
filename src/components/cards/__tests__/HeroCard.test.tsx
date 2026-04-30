/**
 * HeroCard — TESTING.md §9.14 매트릭스. 2 variant + props + swPct/cwPct
 * 정규화 + ❓ info 아이콘 hook.
 */

import * as React from 'react';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { HERO_SEOUL_BAR_OPACITY, shadows } from '@/theme/tokens';

import { HeroCard } from '../HeroCard';

const baseProps = {
  leftLabel: '서울',
  leftValue: '175만/월',
  centerMult: '↑1.9×',
  rightLabel: '밴쿠버',
  rightValue: '340만/월',
  swPct: 0.5,
  cwPct: 0.5,
} as const;

describe('HeroCard', () => {
  // ─── Variant ──────────────────────────────────────────────────────────────
  describe('variant', () => {
    it('orange — bg-orange + p-hero-pad + rounded-hero-lg + 6px bar + orangeHero shadow', () => {
      render(
        <HeroCard {...baseProps} variant="orange" swPct={0.5} cwPct={0.5} testID="h" />,
      );
      const root = screen.getByTestId('h');
      expect(root.props.className).toContain('bg-orange');
      expect(root.props.className).toContain('p-hero-pad');
      expect(root.props.className).toContain('rounded-hero-lg');
      // shadow — design/README §3 의 orange hero 스펙 (rgba 0.25). tokens.ts 단일 출처.
      expect(root.props.style).toEqual(shadows.orangeHero);
      const bars = screen.getByTestId('h-bars');
      expect(bars.props.className).toContain('h-1.5');
    });

    it('navy — bg-navy + p-4 + rounded-hero (20px) + 4px bar + mult orange + navyCard shadow', () => {
      render(
        <HeroCard {...baseProps} variant="navy" swPct={0.5} cwPct={0.5} testID="h" />,
      );
      const root = screen.getByTestId('h');
      const rootClasses = root.props.className.split(/\s+/);
      expect(rootClasses).toContain('bg-navy');
      // p-4 (16px, tailwind default) — design/README §4 Detail navy hero
      expect(rootClasses).toContain('p-4');
      // rounded-hero (20px) ≠ rounded-hero-lg (22px). split 으로 prefix 충돌 차단.
      expect(rootClasses).toContain('rounded-hero');
      expect(rootClasses).not.toContain('rounded-hero-lg');
      // shadow — design §4 navy hero 스펙 (rgba 0.18)
      expect(root.props.style).toEqual(shadows.navyCard);
      const mult = screen.getByText('↑1.9×');
      expect(mult.props.className).toContain('text-orange');
      const bars = screen.getByTestId('h-bars');
      const barClasses = bars.props.className.split(/\s+/);
      expect(barClasses).toContain('h-1');
      expect(barClasses).not.toContain('h-1.5');
    });

    it('orange — mult 색은 white', () => {
      render(<HeroCard {...baseProps} variant="orange" testID="h" />);
      const mult = screen.getByText('↑1.9×');
      expect(mult.props.className).toContain('text-white');
    });
  });

  // ─── Props 렌더 ───────────────────────────────────────────────────────────
  describe('props 렌더', () => {
    it('left/right label + value + center mult 모두 렌더', () => {
      render(<HeroCard {...baseProps} variant="orange" testID="h" />);
      expect(screen.getByText('서울')).toBeTruthy();
      expect(screen.getByText('175만/월')).toBeTruthy();
      expect(screen.getByText('↑1.9×')).toBeTruthy();
      expect(screen.getByText('밴쿠버')).toBeTruthy();
      expect(screen.getByText('340만/월')).toBeTruthy();
    });

    it('centerCaption 있을 때 → 렌더', () => {
      render(
        <HeroCard
          {...baseProps}
          variant="orange"
          centerCaption="+165만/월"
          testID="h"
        />,
      );
      expect(screen.getByText('+165만/월')).toBeTruthy();
    });

    it('centerCaption 미제공 → 미렌더', () => {
      render(<HeroCard {...baseProps} variant="orange" testID="h" />);
      expect(screen.queryByText('+165만/월')).toBeNull();
    });

    it('footer 있을 때 → 렌더', () => {
      render(
        <HeroCard
          {...baseProps}
          variant="orange"
          footer="평균 가정 기준"
          testID="h"
        />,
      );
      expect(screen.getByText('평균 가정 기준')).toBeTruthy();
    });

    it('footer 미제공 → 미렌더', () => {
      render(<HeroCard {...baseProps} variant="orange" testID="h" />);
      expect(screen.queryByText('평균 가정 기준')).toBeNull();
    });

    it('상단 고정 라벨 "한 달 예상 총비용" 렌더 (mono-label uppercase)', () => {
      render(<HeroCard {...baseProps} variant="orange" testID="h" />);
      // MonoLabel 은 한국어는 uppercase 변환 없이 그대로 렌더
      expect(screen.getByText('한 달 예상 총비용')).toBeTruthy();
    });

    it('긴 값 → numberOfLines={1} (squeeze 방지)', () => {
      render(
        <HeroCard
          {...baseProps}
          variant="orange"
          leftValue="9,999만/월"
          rightValue="99,999만/월"
          testID="h"
        />,
      );
      expect(screen.getByText('9,999만/월').props.numberOfLines).toBe(1);
      expect(screen.getByText('99,999만/월').props.numberOfLines).toBe(1);
    });
  });

  // ─── ❓ info 아이콘 ────────────────────────────────────────────────────────
  describe('info 아이콘', () => {
    it('showInfoIcon=true (default) + onInfoPress 있음 → 렌더 + 탭 콜백', () => {
      const onInfoPress = jest.fn();
      render(
        <HeroCard
          {...baseProps}
          variant="orange"
          onInfoPress={onInfoPress}
          testID="h"
        />,
      );
      const info = screen.getByTestId('h-info');
      fireEvent.press(info);
      expect(onInfoPress).toHaveBeenCalledTimes(1);
    });

    it('showInfoIcon=false → 미렌더', () => {
      render(
        <HeroCard
          {...baseProps}
          variant="orange"
          showInfoIcon={false}
          onInfoPress={jest.fn()}
          testID="h"
        />,
      );
      expect(screen.queryByTestId('h-info')).toBeNull();
    });

    it('onInfoPress 미제공 → silent no-op 회피 차원에서 아이콘 미렌더', () => {
      render(<HeroCard {...baseProps} variant="orange" testID="h" />);
      expect(screen.queryByTestId('h-info')).toBeNull();
    });

    it('info 버튼 a11y — role + label "가정값 자세히 보기"', () => {
      render(
        <HeroCard
          {...baseProps}
          variant="orange"
          onInfoPress={jest.fn()}
          testID="h"
        />,
      );
      expect(screen.getByLabelText('가정값 자세히 보기')).toBeTruthy();
    });

    it('info 버튼 hitSlop — 13×4 → icon 18 + slop 26 = 44 (UI_GUIDE §617)', () => {
      render(
        <HeroCard
          {...baseProps}
          variant="orange"
          onInfoPress={jest.fn()}
          testID="h"
        />,
      );
      const btn = screen.getByTestId('h-info');
      expect(btn.props.hitSlop).toEqual({ top: 13, bottom: 13, left: 13, right: 13 });
    });
  });

  // ─── swPct / cwPct 정규화 ─────────────────────────────────────────────────
  describe('progress bar 정규화', () => {
    it('합 = 1 (0.5 / 0.5) → 양쪽 막대 모두 렌더, flex 0.5 / 0.5 + 서울 opacity 토큰', () => {
      render(
        <HeroCard {...baseProps} variant="orange" swPct={0.5} cwPct={0.5} testID="h" />,
      );
      const seoul = screen.getByTestId('h-bar-seoul');
      const city = screen.getByTestId('h-bar-city');
      // opacity 는 tokens.ts 의 HERO_SEOUL_BAR_OPACITY 단일 출처 (매직 넘버 회피).
      expect(seoul.props.style).toMatchObject({
        flex: 0.5,
        opacity: HERO_SEOUL_BAR_OPACITY,
      });
      expect(city.props.style).toMatchObject({ flex: 0.5 });
      expect(city.props.style.opacity).toBeUndefined();
    });

    it('sw=0, cw=1 → 도시 막대만 렌더 (서울 미렌더)', () => {
      render(
        <HeroCard {...baseProps} variant="orange" swPct={0} cwPct={1} testID="h" />,
      );
      expect(screen.queryByTestId('h-bar-seoul')).toBeNull();
      expect(screen.getByTestId('h-bar-city')).toBeTruthy();
    });

    it('sw=1, cw=0 → 서울 막대만 렌더', () => {
      render(
        <HeroCard {...baseProps} variant="orange" swPct={1} cwPct={0} testID="h" />,
      );
      expect(screen.getByTestId('h-bar-seoul')).toBeTruthy();
      expect(screen.queryByTestId('h-bar-city')).toBeNull();
    });

    it('합 = 0 (둘 다 0) → 양쪽 미렌더', () => {
      render(
        <HeroCard {...baseProps} variant="orange" swPct={0} cwPct={0} testID="h" />,
      );
      expect(screen.queryByTestId('h-bar-seoul')).toBeNull();
      expect(screen.queryByTestId('h-bar-city')).toBeNull();
    });

    it('합 = 1 (0.4 / 0.6) → flex 비율 그대로 보존', () => {
      // 합이 정확히 1 이면 정규화 결과도 입력값과 동일.
      render(
        <HeroCard {...baseProps} variant="orange" swPct={0.4} cwPct={0.6} testID="h" />,
      );
      const seoul = screen.getByTestId('h-bar-seoul');
      const city = screen.getByTestId('h-bar-city');
      expect(seoul.props.style).toMatchObject({ flex: 0.4 });
      expect(city.props.style).toMatchObject({ flex: 0.6 });
    });

    it('합 < 1 (0.3 + 0.3 = 0.6) → 정규화 후 0.5 / 0.5', () => {
      // 합이 1 미만이면 비율 보존하면서 합을 1 로 끌어올림.
      render(
        <HeroCard {...baseProps} variant="orange" swPct={0.3} cwPct={0.3} testID="h" />,
      );
      const seoul = screen.getByTestId('h-bar-seoul');
      const city = screen.getByTestId('h-bar-city');
      expect(seoul.props.style).toMatchObject({ flex: 0.5 });
      expect(city.props.style).toMatchObject({ flex: 0.5 });
    });

    it('합 = 2 (1 + 1) → 정규화 후 0.5 / 0.5', () => {
      render(
        <HeroCard {...baseProps} variant="orange" swPct={1} cwPct={1} testID="h" />,
      );
      const seoul = screen.getByTestId('h-bar-seoul');
      const city = screen.getByTestId('h-bar-city');
      expect(seoul.props.style).toMatchObject({ flex: 0.5 });
      expect(city.props.style).toMatchObject({ flex: 0.5 });
    });

    it('testID 미제공 → info / bar 의 testID 분기 false branch cover', () => {
      // info 아이콘 + 양쪽 막대 모두 testID 조건부 spread 의 false 브랜치를 hit.
      const { toJSON } = render(
        <HeroCard
          {...baseProps}
          variant="orange"
          onInfoPress={jest.fn()}
          swPct={0.5}
          cwPct={0.5}
        />,
      );
      expect(toJSON()).not.toBeNull();
      // testID 없으니 query 도 null
      expect(screen.queryByTestId('h-info')).toBeNull();
      expect(screen.queryByTestId('h-bar-seoul')).toBeNull();
    });

    it('음수 / >1 입력 → clamp 후 정규화 + dev warn', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        render(
          <HeroCard
            {...baseProps}
            variant="orange"
            swPct={-0.5}
            cwPct={2}
            testID="h"
          />,
        );
        // -0.5 → 0, 2 → 1, 정규화 후 0/1
        expect(screen.queryByTestId('h-bar-seoul')).toBeNull();
        expect(screen.getByTestId('h-bar-city')).toBeTruthy();
        expect(warnSpy).toHaveBeenCalled();
        expect(warnSpy.mock.calls[0]?.[0]).toContain('clamped');
      } finally {
        warnSpy.mockRestore();
      }
    });
  });
});
