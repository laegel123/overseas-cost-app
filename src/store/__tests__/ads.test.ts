/**
 * docs/TESTING.md §9.43 매트릭스 — useAdsStore (ADR-077).
 *
 * 비영속 store — persist 미들웨어·AsyncStorage 미사용을 함께 검증한다.
 * AsyncStorage 는 jest.setup.js 의 전역 mock (setItem 이 jest.fn).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { INITIAL_STATE, useAdsStore } from '../ads';

beforeEach(() => {
  useAdsStore.getState().reset();
});

function pickState() {
  const { status, canRequestAds, privacyOptionsRequired } = useAdsStore.getState();
  return { status, canRequestAds, privacyOptionsRequired };
}

describe('기본 동작', () => {
  it('초기 상태는 INITIAL_STATE (idle / false / false)', () => {
    expect(pickState()).toEqual(INITIAL_STATE);
    expect(INITIAL_STATE).toEqual({
      status: 'idle',
      canRequestAds: false,
      privacyOptionsRequired: false,
    });
  });

  it('begin() → initializing, 다른 필드 불변', () => {
    useAdsStore.setState({ canRequestAds: true, privacyOptionsRequired: true });

    useAdsStore.getState().begin();

    expect(pickState()).toEqual({
      status: 'initializing',
      canRequestAds: true,
      privacyOptionsRequired: true,
    });
  });

  it('settle(ready) → 세 필드 반영', () => {
    useAdsStore.getState().begin();

    useAdsStore.getState().settle({
      status: 'ready',
      canRequestAds: true,
      privacyOptionsRequired: true,
      error: null,
    });

    expect(pickState()).toEqual({
      status: 'ready',
      canRequestAds: true,
      privacyOptionsRequired: true,
    });
  });

  it('settle(disabled) → disabled, error 는 store 에 담기지 않음', () => {
    useAdsStore.getState().begin();

    useAdsStore.getState().settle({
      status: 'disabled',
      canRequestAds: false,
      privacyOptionsRequired: false,
      error: new Error('x'),
    });

    expect(pickState()).toEqual({
      status: 'disabled',
      canRequestAds: false,
      privacyOptionsRequired: false,
    });
    expect(useAdsStore.getState()).not.toHaveProperty('error');
  });

  it('reset() → INITIAL_STATE 복귀', () => {
    useAdsStore.getState().settle({
      status: 'ready',
      canRequestAds: true,
      privacyOptionsRequired: true,
      error: null,
    });

    useAdsStore.getState().reset();

    expect(pickState()).toEqual(INITIAL_STATE);
  });
});

describe('비영속', () => {
  it('액션 호출 후 AsyncStorage.setItem 호출 0회', async () => {
    jest.mocked(AsyncStorage.setItem).mockClear();

    useAdsStore.getState().begin();
    useAdsStore.getState().settle({
      status: 'ready',
      canRequestAds: true,
      privacyOptionsRequired: false,
      error: null,
    });
    useAdsStore.getState().reset();
    await Promise.resolve();

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('useAdsStore.persist 가 undefined (persist 미들웨어 미사용)', () => {
    expect((useAdsStore as unknown as { persist?: unknown }).persist).toBeUndefined();
  });
});
