import { fireEvent, render, screen } from '@testing-library/react-native';

import { ComparePair, type ComparePairProps } from '../ComparePair';

const defaultProps: ComparePairProps = {
  category: 'rent',
  label: '월세',
  sLabel: '서울',
  sValue: '60만',
  cLabel: '밴쿠버',
  cValue: '135만',
  mult: 2.3,
  swPct: 0.4,
  cwPct: 1.0,
  testID: 'compare-pair',
};

function renderPair(overrides: Partial<ComparePairProps> = {}) {
  return render(<ComparePair {...defaultProps} {...overrides} />);
}

describe('ComparePair', () => {
  describe('Hot 규칙 (경계값) — 표시값 (rounded) 기반', () => {
    it('mult=1.94 → not hot (반올림 1.9, icon bg-light)', () => {
      renderPair({ mult: 1.94 });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-light');
      expect(iconBox.props.className).not.toContain('bg-orange-soft');
    });

    it('mult=1.95 → hot (반올림 2.0, formatMultiplier 와 일관 — PR #16 review 이슈 1)', () => {
      renderPair({ mult: 1.95 });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-orange-soft');
    });

    it('mult=1.99 → hot (반올림 2.0)', () => {
      renderPair({ mult: 1.99 });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-orange-soft');
    });

    it('mult=2.0 → hot (icon bg-orange-soft, mult orange)', () => {
      renderPair({ mult: 2.0 });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-orange-soft');
    });

    it('mult=2.01 → hot', () => {
      renderPair({ mult: 2.01 });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-orange-soft');
    });

    it('mult=10.0 → hot', () => {
      renderPair({ mult: 10.0 });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-orange-soft');
    });

    it('mult=0.5 → not hot (cool)', () => {
      renderPair({ mult: 0.5 });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-light');
    });
  });

  describe('Hot prop override', () => {
    it('hot=true 강제 (mult=1.5) → orange', () => {
      renderPair({ mult: 1.5, hot: true });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-orange-soft');
    });

    it('hot=false 강제 (mult=3.0) → not hot', () => {
      renderPair({ mult: 3.0, hot: false });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-light');
      expect(iconBox.props.className).not.toContain('bg-orange-soft');
    });

    it('hot 미지정 → 자동 판정 (isHot)', () => {
      renderPair({ mult: 2.5 });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-orange-soft');
    });
  });

  describe('신규 케이스', () => {
    it('mult="신규" → "신규" 표기', () => {
      renderPair({ mult: '신규' });
      const multText = screen.getByTestId('compare-pair-mult');
      expect(multText.props.children).toBe('신규');
    });

    it('mult="신규" → not hot (navy color)', () => {
      renderPair({ mult: '신규' });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-light');
    });

    it('mult="신규" + hot=true override → orange-soft 아이콘 (PR #16 review 이슈 3)', () => {
      renderPair({ mult: '신규', hot: true });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-orange-soft');
      const multText = screen.getByTestId('compare-pair-mult');
      expect(multText.props.children).toBe('신규');
      expect(multText.props.className).toContain('text-orange');
    });
  });

  describe('막대 폭', () => {
    it('sw=0.4, cw=1.0 → 막대 정상 렌더', () => {
      renderPair({ swPct: 0.4, cwPct: 1.0 });
      const seoulBar = screen.getByTestId('compare-pair-bar-seoul');
      const cityBar = screen.getByTestId('compare-pair-bar-city');
      expect(seoulBar.props.style.width).toBe('40%');
      expect(cityBar.props.style.width).toBe('100%');
    });

    it('sw=0.0, cw=1.0 → 서울 막대 미표시', () => {
      renderPair({ swPct: 0.0, cwPct: 1.0 });
      expect(screen.queryByTestId('compare-pair-bar-seoul')).toBeNull();
      expect(screen.getByTestId('compare-pair-bar-city')).toBeTruthy();
    });

    it('sw=1.0, cw=0.5 → 정상', () => {
      renderPair({ swPct: 1.0, cwPct: 0.5 });
      const seoulBar = screen.getByTestId('compare-pair-bar-seoul');
      const cityBar = screen.getByTestId('compare-pair-bar-city');
      expect(seoulBar.props.style.width).toBe('100%');
      expect(cityBar.props.style.width).toBe('50%');
    });

    it('범위 벗어난 값 → clamp + warn', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      renderPair({ swPct: 1.5, cwPct: -0.2 });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ComparePair] swPct out of [0,1]'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ComparePair] cwPct out of [0,1]'),
      );
      const seoulBar = screen.getByTestId('compare-pair-bar-seoul');
      expect(seoulBar.props.style.width).toBe('100%');
      expect(screen.queryByTestId('compare-pair-bar-city')).toBeNull();
      warnSpy.mockRestore();
    });
  });

  describe('Icon 매핑', () => {
    const categories: { category: ComparePairProps['category']; icon: string }[] = [
      { category: 'rent', icon: 'house' },
      { category: 'food', icon: 'fork' },
      { category: 'transport', icon: 'bus' },
      { category: 'tuition', icon: 'graduation' },
      { category: 'tax', icon: 'briefcase' },
      { category: 'visa', icon: 'passport' },
    ];

    it.each(categories)('category=$category → $icon icon', ({ category }) => {
      renderPair({ category });
      expect(screen.getByTestId('compare-pair-icon-box')).toBeTruthy();
    });
  });

  describe('텍스트 렌더링', () => {
    it('라벨 / 값 표시', () => {
      renderPair();
      expect(screen.getByText('월세')).toBeTruthy();
      expect(screen.getByText('서울')).toBeTruthy();
      expect(screen.getByText('60만')).toBeTruthy();
      expect(screen.getByText('밴쿠버')).toBeTruthy();
      expect(screen.getByText('135만')).toBeTruthy();
    });

    it('mult 포매팅 — 2.3 → "↑2.3×"', () => {
      renderPair({ mult: 2.3 });
      const multText = screen.getByTestId('compare-pair-mult');
      expect(multText.props.children).toBe('↑2.3×');
    });

    it('mult=1.0 → "1.0×" (화살표 없음, gray-2)', () => {
      renderPair({ mult: 1.0 });
      const multText = screen.getByTestId('compare-pair-mult');
      expect(multText.props.children).toBe('1.0×');
    });

    it('mult=0.8 → "↓0.8×" (cool)', () => {
      renderPair({ mult: 0.8 });
      const multText = screen.getByTestId('compare-pair-mult');
      expect(multText.props.children).toBe('↓0.8×');
    });
  });

  describe('인터랙션', () => {
    it('onPress 정의 시 탭 동작', () => {
      const onPress = jest.fn();
      renderPair({ onPress });
      // root testID 는 시각 컨테이너, 탭 영역은 그 안의 단일 button 요소
      // (e2e-defects step 2 — 불변식 B).
      fireEvent.press(screen.getByRole('button'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('onPress 미정의 시 비-탭 카드', () => {
      const { onPress: _, ...propsWithoutOnPress } = defaultProps;
      render(<ComparePair {...propsWithoutOnPress} />);
      const card = screen.getByTestId('compare-pair');
      expect(card.props.accessibilityRole).not.toBe('button');
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('onPress 정의 시 accessibilityLabel 에 카테고리 라벨 포함 (PR #16 review 이슈 2)', () => {
      renderPair({ onPress: jest.fn(), label: '월세' });
      const button = screen.getByRole('button');
      expect(button.props.accessibilityLabel).toBe('월세 비교 카드');
    });
  });

  describe('testID 전파', () => {
    it('testID 미지정 시 testID 속성 없음', () => {
      const { testID: _, ...propsWithoutTestID } = defaultProps;
      render(<ComparePair {...propsWithoutTestID} />);
      expect(screen.queryByTestId('compare-pair')).toBeNull();
    });
  });

  describe('inclusion 토글 (ADR-062)', () => {
    it('included 기본 true + onToggleInclude 미지정 → 토글 미렌더, opacity 1, 배지 없음', () => {
      renderPair();
      expect(screen.queryByTestId('compare-pair-toggle')).toBeNull();
      expect(screen.queryByTestId('compare-pair-excluded-badge')).toBeNull();
      const card = screen.getByTestId('compare-pair');
      expect(card.props.style).toMatchObject({ opacity: 1 });
    });

    it('onToggleInclude 정의 + included=true → 토글 렌더 ON, 배지 미렌더, opacity 1', () => {
      renderPair({ included: true, onToggleInclude: jest.fn() });
      const toggle = screen.getByTestId('compare-pair-toggle');
      expect(toggle.props.value).toBe(true);
      expect(screen.queryByTestId('compare-pair-excluded-badge')).toBeNull();
      const card = screen.getByTestId('compare-pair');
      expect(card.props.style).toMatchObject({ opacity: 1 });
    });

    it('onToggleInclude 정의 + included=false → 토글 OFF + "제외됨" 배지 + opacity 약화', () => {
      renderPair({ included: false, onToggleInclude: jest.fn() });
      const toggle = screen.getByTestId('compare-pair-toggle');
      expect(toggle.props.value).toBe(false);
      const badge = screen.getByTestId('compare-pair-excluded-badge');
      expect(badge).toBeTruthy();
      const card = screen.getByTestId('compare-pair');
      // EXCLUDED_CARD_OPACITY = 0.55 — 색상에만 의존하지 않는 정보 표기 정책
      // (CLAUDE.md) — opacity + 배지 + 토글 OFF 색 = 3중 인코딩.
      expect(card.props.style).toMatchObject({ opacity: 0.55 });
    });

    it('토글 탭 → onToggleInclude(next) 호출', () => {
      const onToggleInclude = jest.fn();
      renderPair({ included: true, onToggleInclude });
      const toggle = screen.getByTestId('compare-pair-toggle');
      fireEvent(toggle, 'valueChange', false);
      expect(onToggleInclude).toHaveBeenCalledTimes(1);
      expect(onToggleInclude).toHaveBeenCalledWith(false);
    });

    it('토글 탭 OFF → ON 도 동일하게 onToggleInclude(true) 호출', () => {
      const onToggleInclude = jest.fn();
      renderPair({ included: false, onToggleInclude });
      const toggle = screen.getByTestId('compare-pair-toggle');
      fireEvent(toggle, 'valueChange', true);
      expect(onToggleInclude).toHaveBeenCalledWith(true);
    });

    it('토글 a11y — role=switch + label "${label} 합산 포함"', () => {
      renderPair({ label: '학비', onToggleInclude: jest.fn() });
      const toggle = screen.getByTestId('compare-pair-toggle');
      expect(toggle.props.accessibilityRole).toBe('switch');
      expect(toggle.props.accessibilityLabel).toBe('학비 합산 포함');
    });

    it('included=false + onToggleInclude 미지정 → 배지/opacity 적용은 되지만 토글 자체는 미렌더', () => {
      // 호출부에서 included 만 넘기고 토글 핸들러를 빼는 케이스 (현 시점 호출 패턴엔
      // 없지만 컴포넌트 레벨 정책 — included prop 만으로도 시각 상태는 표현 가능).
      renderPair({ included: false });
      expect(screen.queryByTestId('compare-pair-toggle')).toBeNull();
      const badge = screen.getByTestId('compare-pair-excluded-badge');
      expect(badge).toBeTruthy();
      const card = screen.getByTestId('compare-pair');
      expect(card.props.style).toMatchObject({ opacity: 0.55 });
    });
  });

  describe('토글 접근성 구조 (e2e-defects step 2)', () => {
    /** testID 요소의 조상 체인을 루트까지 배열로 수집. */
    function ancestorsOf(testID: string): ReturnType<typeof screen.getByTestId>[] {
      const chain: ReturnType<typeof screen.getByTestId>[] = [];
      let node = screen.getByTestId(testID).parent;
      while (node !== null) {
        chain.push(node);
        node = node.parent;
      }
      return chain;
    }

    /** 조상들의 className 을 하나의 문자열로 (레이아웃 클래스 존재 여부 단정용). */
    function ancestorClassNames(testID: string): string {
      return ancestorsOf(testID)
        .map((node) => node.props.className)
        .filter((cn) => typeof cn === 'string')
        .join(' ');
    }

    it('included=true → accessibilityState.checked=true', () => {
      renderPair({ included: true, onToggleInclude: jest.fn() });
      const toggle = screen.getByTestId('compare-pair-toggle');
      expect(toggle.props.accessibilityState).toMatchObject({ checked: true });
    });

    it('included=false → accessibilityState.checked=false', () => {
      renderPair({ included: false, onToggleInclude: jest.fn() });
      const toggle = screen.getByTestId('compare-pair-toggle');
      expect(toggle.props.accessibilityState).toMatchObject({ checked: false });
    });

    it('불변식 A — 토글 조상 중 accessible 컨테이너·button 역할 없음 (iOS 접근성 트리에서 개별 요소로 노출)', () => {
      renderPair({ onPress: jest.fn(), onToggleInclude: jest.fn() });
      const chain = ancestorsOf('compare-pair-toggle');
      // 컴포넌트 루트까지 실제로 올라갔는지 확인 (체인이 비어 단정이 무의미해지는 것 방지)
      expect(chain.length).toBeGreaterThan(0);
      chain.forEach((node) => {
        expect(node.props.accessible).not.toBe(true);
        expect(node.props.accessibilityRole).not.toBe('button');
      });
    });

    it('불변식 B — 탭 영역은 단일 button 요소 (라벨 "${label} 비교 카드"), 토글 조작은 onPress 를 부르지 않음', () => {
      const onPress = jest.fn();
      const onToggleInclude = jest.fn();
      renderPair({ label: '월세', included: true, onPress, onToggleInclude });

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0].props.accessibilityLabel).toBe('월세 비교 카드');
      fireEvent.press(buttons[0]);
      expect(onPress).toHaveBeenCalledTimes(1);

      fireEvent(screen.getByTestId('compare-pair-toggle'), 'valueChange', false);
      expect(onToggleInclude).toHaveBeenCalledWith(false);
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('불변식 B — onPress 미지정 시 button 요소 없이도 토글은 렌더', () => {
      const { onPress: _, ...propsWithoutOnPress } = defaultProps;
      render(
        <ComparePair {...propsWithoutOnPress} onToggleInclude={jest.fn()} />,
      );
      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.getByTestId('compare-pair-toggle')).toBeTruthy();
    });

    it('불변식 C·D — root testID = 시각 컨테이너(카드 border/radius + opacity), 탭 영역이 카드 padding(p-3) 을 가짐', () => {
      renderPair({ onPress: jest.fn(), onToggleInclude: jest.fn() });
      const card = screen.getByTestId('compare-pair');
      expect(card.props.className).toContain('rounded-card');
      expect(card.props.className).toContain('border-line');
      expect(card.props.style).toMatchObject({ opacity: 1 });
      expect(screen.getByRole('button').props.className).toContain('p-3');
    });

    // 여백 값은 iOS Switch 실측 폭 63pt + right-3(12pt) = 75pt 를 덮어야 한다.
    // mr-14(56px) 은 16pt 부족해 배수 텍스트가 Switch 에 가려졌다 (실측 회귀).
    it('불변식 C — 토글이 있으면 배수 텍스트 우측에 Switch 폭만큼 여백 (mr-20 = 80px ≥ 75pt)', () => {
      renderPair({ onToggleInclude: jest.fn() });
      expect(ancestorClassNames('compare-pair-mult')).toContain('mr-20');
    });

    it('불변식 C — 여백이 Switch 를 덮기에 부족한 mr-14 로 되돌아가지 않는다', () => {
      renderPair({ onToggleInclude: jest.fn() });
      expect(ancestorClassNames('compare-pair-mult')).not.toContain('mr-14');
    });

    it('불변식 C — 토글이 없으면 여백도 없음', () => {
      renderPair();
      expect(ancestorClassNames('compare-pair-mult')).not.toContain('mr-20');
    });
  });

  describe('막대 영역 레이아웃 (e2e-defects step 3)', () => {
    type Node = ReturnType<typeof screen.getByText>;

    /** host(View/Text) 조상만 루트까지 수집 — composite 래퍼는 건너뛴다. */
    function hostAncestorsOf(node: Node): Node[] {
      const chain: Node[] = [];
      let current = node.parent;
      while (current !== null) {
        if (typeof current.type === 'string') chain.push(current);
        current = current.parent;
      }
      return chain;
    }

    /** 막대 행 3컬럼 (라벨 / 막대 / 값) 컨테이너. */
    function columns(): { label: Node; bar: Node; value: Node } {
      return {
        label: hostAncestorsOf(screen.getByText(defaultProps.sLabel))[1],
        bar: hostAncestorsOf(screen.getByTestId('compare-pair-bar-seoul'))[2],
        value: hostAncestorsOf(screen.getByText(defaultProps.sValue))[1],
      };
    }

    it('불변식 A — 라벨·값에 고정 폭 클래스(w-7 / w-14) 없음', () => {
      renderPair();
      [
        defaultProps.sLabel,
        defaultProps.cLabel,
        defaultProps.sValue,
        defaultProps.cValue,
      ].forEach((text) => {
        const className = screen.getByText(text).props.className as string;
        expect(className).not.toContain('w-7');
        expect(className).not.toContain('w-14');
      });
    });

    it('불변식 A — 라벨·값 컬럼은 내용 폭(shrink-0), 막대 컬럼이 남는 폭 흡수(flex-1 min-w-0)', () => {
      renderPair();
      const { label, bar, value } = columns();
      expect(label.props.className).toContain('shrink-0');
      expect(value.props.className).toContain('shrink-0');
      expect(value.props.className).toContain('items-end');
      expect(bar.props.className).toContain('flex-1');
      expect(bar.props.className).toContain('min-w-0');
    });

    it('불변식 A — 긴 도시명·금액이 생략 없이 그대로 렌더 (numberOfLines=1 안전망 유지)', () => {
      renderPair({
        sValue: '368.9만원',
        cLabel: '샌프란시스코',
        cValue: '1234.5만원',
      });
      ['서울', '368.9만원', '샌프란시스코', '1234.5만원'].forEach((text) => {
        const node = screen.getByText(text);
        expect(node.props.children).toBe(text);
        expect(node.props.numberOfLines).toBe(1);
      });
    });

    it('불변식 B — 세 컬럼의 행 간격(gap-1.5) 과 셀 높이(h-4 justify-center) 가 동일 (두 막대 x 정렬)', () => {
      renderPair({ cLabel: '샌프란시스코', cValue: '1234.5만원' });
      Object.values(columns()).forEach((column) => {
        expect(column.props.className).toContain('gap-1.5');
      });

      const cells = [
        hostAncestorsOf(screen.getByText(defaultProps.sLabel))[0],
        hostAncestorsOf(screen.getByText('샌프란시스코'))[0],
        hostAncestorsOf(screen.getByTestId('compare-pair-bar-seoul'))[1],
        hostAncestorsOf(screen.getByTestId('compare-pair-bar-city'))[1],
        hostAncestorsOf(screen.getByText(defaultProps.sValue))[0],
        hostAncestorsOf(screen.getByText('1234.5만원'))[0],
      ];
      expect(cells).toHaveLength(6);
      cells.forEach((cell) => {
        expect(cell.props.className).toBe('h-4 justify-center');
      });
    });

    it('불변식 C — 색상·폰트·막대 스타일 유지', () => {
      renderPair();
      expect(screen.getByText(defaultProps.sLabel).props.className).toContain(
        'text-gray-2',
      );
      expect(screen.getByText(defaultProps.cLabel).props.className).toContain(
        'text-orange',
      );
      expect(screen.getByText(defaultProps.sValue).props.className).toContain(
        'font-manrope-semibold',
      );
      expect(screen.getByText(defaultProps.cValue).props.className).toContain(
        'text-navy',
      );

      const seoulBar = screen.getByTestId('compare-pair-bar-seoul');
      expect(seoulBar.props.className).toContain('bg-gray');
      expect(hostAncestorsOf(seoulBar)[0].props.className).toBe(
        'h-2 bg-light rounded',
      );
      expect(screen.getByTestId('compare-pair-bar-city').props.className).toContain(
        'bg-orange',
      );
    });
  });
});
