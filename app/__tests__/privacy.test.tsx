/**
 * `/privacy` 개인정보 처리방침 화면 테스트 (ADR-071·ADR-072 / in-app-policy-pages step 6).
 *
 * 본문은 `PRIVACY_POLICY` 정본이 단일 출처이므로 (ADR-072) 두 종류의 단언을 섞는다:
 *   1. 실제 정본으로 렌더 — 섹션 수·번호 부여·목록 전량 노출 등 사용자가 보는 결과
 *   2. 가짜 정본으로 렌더 — 화면이 문구를 하드코딩하지 않았음을 증명 (정본을 바꾸면
 *      화면도 따라간다)
 *
 * 2 를 위해 `@/lib` 배럴이 정본의 **얕은 복사본 객체 하나**를 내놓게 mock 하고, 테스트가
 * 그 객체의 필드를 갈아끼운다 (`policySlot`). jest 는 mock 팩토리 결과의 프로퍼티를 값으로
 * 복사하므로 getter 로 교체하는 방식은 동작하지 않는다.
 * `Linking` 은 `@/lib/linking` wrapper 만 mock (TESTING.md §5 — RN Linking 직접 import 금지).
 */

import * as React from 'react';

import { Alert } from 'react-native';

import { act, fireEvent, render } from '@testing-library/react-native';

import { PRIVACY_POLICY as policySlot } from '@/lib';
import { openURL as mockOpenURL } from '@/lib/linking';
import { PRIVACY_POLICY, type PrivacyPolicy } from '@/lib/privacyPolicy';

import PrivacyScreen from '../privacy';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('@/lib/linking', () => ({
  openURL: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/lib', () => {
  const actual = jest.requireActual('@/lib');
  return { ...actual, PRIVACY_POLICY: { ...actual.PRIVACY_POLICY } };
});

/** 정본과 겹치는 문자열이 하나도 없는 가짜 처리방침 — 하드코딩 검출용. */
const FAKE_POLICY: PrivacyPolicy = {
  appName: '테스트앱',
  lead: '리드문장-FAKE',
  operatorEmail: 'fake@example.com',
  updatedAt: '1999-12-31',
  sections: [
    {
      title: '섹션제목-FAKE',
      blocks: [
        { kind: 'paragraph', text: '문단내용-FAKE' },
        { kind: 'list', items: ['항목하나-FAKE', '항목둘-FAKE'] },
        { kind: 'email', label: '연락처라벨-FAKE', email: 'fake@example.com' },
      ],
    },
  ],
};

/** 정본의 모든 `list` 블록 항목을 평탄화 — 불릿 개수 단언의 기대값. */
const ALL_LIST_ITEMS = PRIVACY_POLICY.sections.flatMap((section) =>
  section.blocks.flatMap((block) => (block.kind === 'list' ? block.items : [])),
);

/** 정본에서 `email` 블록을 가진 섹션 인덱스 — testID 접미사와 같다. */
const EMAIL_SECTION_INDEXES = PRIVACY_POLICY.sections
  .map((section, idx) => (section.blocks.some((b) => b.kind === 'email') ? idx : -1))
  .filter((idx) => idx >= 0);

describe('PrivacyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 앞 테스트가 갈아끼운 필드를 정본으로 되돌린다 (키 집합이 같아 전량 복원된다).
    Object.assign(policySlot, PRIVACY_POLICY);
    (mockOpenURL as jest.Mock).mockResolvedValue(true);
  });

  it('리드 문단을 렌더한다', () => {
    const { getByTestId, getByText } = render(<PrivacyScreen />);

    expect(getByTestId('privacy-lead')).toBeTruthy();
    expect(getByText(PRIVACY_POLICY.lead)).toBeTruthy();
  });

  it('섹션 7개를 순서대로 렌더하고 제목에 1.~7. 번호를 붙인다', () => {
    const { getAllByTestId, getByText } = render(<PrivacyScreen />);

    const sections = getAllByTestId(/^privacy-section-/);
    expect(sections).toHaveLength(7);
    expect(sections.map((s) => s.props.testID)).toEqual([
      'privacy-section-0',
      'privacy-section-1',
      'privacy-section-2',
      'privacy-section-3',
      'privacy-section-4',
      'privacy-section-5',
      'privacy-section-6',
    ]);
    // 번호는 정본의 title 에 없고 렌더 시점에 붙는다 (ADR-072 결정 1).
    PRIVACY_POLICY.sections.forEach((section, idx) => {
      expect(getByText(`${idx + 1}. ${section.title}`)).toBeTruthy();
    });
  });

  it('list 블록의 항목을 하나도 빠짐없이 렌더한다 (말줄임·접기 없음)', () => {
    const { getAllByText, getByText } = render(<PrivacyScreen />);

    expect(ALL_LIST_ITEMS).toHaveLength(10);
    expect(getAllByText('•')).toHaveLength(ALL_LIST_ITEMS.length);
    ALL_LIST_ITEMS.forEach((item) => {
      const node = getByText(item);
      expect(node).toBeTruthy();
      // 법적 고지 문서라 본문을 자르지 않는다.
      expect(node.props.numberOfLines).toBeUndefined();
    });
  });

  it('paragraph 블록도 전문 그대로 렌더한다', () => {
    const { getByText } = render(<PrivacyScreen />);

    const paragraphs = PRIVACY_POLICY.sections.flatMap((section) =>
      section.blocks.flatMap((block) => (block.kind === 'paragraph' ? [block.text] : [])),
    );
    expect(paragraphs.length).toBeGreaterThan(0);
    paragraphs.forEach((text) => expect(getByText(text)).toBeTruthy());
  });

  it('이메일 블록 탭 → mailto 로 openURL 호출', () => {
    const { getByTestId } = render(<PrivacyScreen />);

    expect(EMAIL_SECTION_INDEXES).toEqual([4, 6]);
    fireEvent.press(getByTestId('privacy-email-4'));

    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).toHaveBeenCalledWith(`mailto:${PRIVACY_POLICY.operatorEmail}`);
  });

  it('이메일 블록이 button role 과 라벨을 담은 a11y 라벨을 갖는다', () => {
    const { getByTestId, getByLabelText } = render(<PrivacyScreen />);

    expect(getByTestId('privacy-email-6').props.accessibilityRole).toBe('button');
    expect(getByLabelText('개인정보 관련 문의 이메일 보내기')).toBeTruthy();
  });

  it('openURL 실패 → Alert 로 알린다 (silent fail 아님)', async () => {
    (mockOpenURL as jest.Mock).mockRejectedValue(new Error('no mail app'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId } = render(<PrivacyScreen />);

    fireEvent.press(getByTestId('privacy-email-4'));
    // openURL 거절 → catch → Alert 는 전부 마이크로태스크. fake timer 무관.
    await act(async () => {
      await Promise.resolve();
    });

    expect(alertSpy).toHaveBeenCalledWith('링크 열기 실패', '이메일 앱을 찾을 수 없습니다.');
    alertSpy.mockRestore();
  });

  it('헤더 부제에 정본의 updatedAt 을 표시한다', () => {
    const { getByText } = render(<PrivacyScreen />);

    expect(getByText(`마지막 갱신 ${PRIVACY_POLICY.updatedAt}`)).toBeTruthy();
  });

  it('back 탭 → router.back()', () => {
    const { getByTestId } = render(<PrivacyScreen />);

    fireEvent.press(getByTestId('privacy-topbar-back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('본문을 하드코딩하지 않는다 — 정본을 바꾸면 화면이 따라간다 (ADR-072)', () => {
    Object.assign(policySlot, FAKE_POLICY);

    const { getByText, getAllByTestId, queryByText } = render(<PrivacyScreen />);

    expect(getByText('리드문장-FAKE')).toBeTruthy();
    expect(getByText('1. 섹션제목-FAKE')).toBeTruthy();
    expect(getByText('문단내용-FAKE')).toBeTruthy();
    expect(getByText('항목하나-FAKE')).toBeTruthy();
    expect(getByText('항목둘-FAKE')).toBeTruthy();
    expect(getByText('연락처라벨-FAKE')).toBeTruthy();
    expect(getByText('마지막 갱신 1999-12-31')).toBeTruthy();
    expect(getAllByTestId(/^privacy-section-/)).toHaveLength(1);
    // 실제 정본 문장은 화면 어디에도 남아 있지 않다.
    expect(queryByText(PRIVACY_POLICY.lead)).toBeNull();
    expect(queryByText(`1. ${PRIVACY_POLICY.sections[0]?.title}`)).toBeNull();
  });

  it('가짜 정본의 이메일도 그 주소로 열린다 (주소 하드코딩 아님)', () => {
    Object.assign(policySlot, FAKE_POLICY);

    const { getByTestId } = render(<PrivacyScreen />);

    fireEvent.press(getByTestId('privacy-email-0'));

    expect(mockOpenURL).toHaveBeenCalledWith('mailto:fake@example.com');
  });
});
