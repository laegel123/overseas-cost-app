/**
 * docs/TESTING.md §9.42-w — src/lib/ads.web.ts.
 *
 * jest-expo 는 `../ads` 를 .native 로 해석하므로 웹 파일을 경로로 직접 require 한다.
 * `jest.isolateModules` 로 새 레지스트리에서 로드해 네이티브 모듈을 끌어오지 않음을 확인.
 */

import { AdsConfigError } from '../errors';

type AdsWebModule = typeof import('../ads.web');

type AdsSdkMock = { default: () => { initialize: jest.Mock } } & Record<string, unknown>;

/** 같은 격리 레지스트리에서 웹 모듈과 SDK mock 을 함께 로드 — 웹 모듈이 SDK 를 끌어왔다면 같은 인스턴스다. */
function loadWeb(): { web: AdsWebModule; sdk: AdsSdkMock } {
  let loaded: { web: AdsWebModule; sdk: AdsSdkMock } | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const web: AdsWebModule = require('../ads.web');
    loaded = { web, sdk: jest.requireMock<AdsSdkMock>('react-native-google-mobile-ads') };
  });
  return loaded as { web: AdsWebModule; sdk: AdsSdkMock };
}

function collectSdkMockFns(sdk: AdsSdkMock): jest.Mock[] {
  // default 는 plain 함수 (mobileAds() 형태) — initialize 는 반환 객체에서 꺼낸다
  const fns: jest.Mock[] = [sdk.default().initialize];
  const visit = (value: unknown): void => {
    if (jest.isMockFunction(value)) {
      fns.push(value);
    } else if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach(visit);
    }
  };
  visit(sdk);
  return fns;
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ads.web', () => {
  it('initializeAds → disabled 즉시 resolve (error null)', async () => {
    const { web } = loadWeb();
    await expect(web.initializeAds()).resolves.toEqual({
      status: 'disabled',
      canRequestAds: false,
      privacyOptionsRequired: false,
      error: null,
    });
  });

  it('showPrivacyOptionsForm → no-op resolve', async () => {
    const { web } = loadWeb();
    await expect(web.showPrivacyOptionsForm()).resolves.toBeUndefined();
  });

  it('resolveAdsMode 는 native 와 동일 로직', () => {
    const { web } = loadWeb();
    expect(web.resolveAdsMode('1', false)).toBe('test');
    expect(web.resolveAdsMode(undefined, true)).toBe('test');
    expect(web.resolveAdsMode(undefined, false)).toBe('production');
  });

  it('resolveBannerUnitId: test → 샘플 적응형 배너 ID 문자열 상수', () => {
    const { web } = loadWeb();
    expect(web.resolveBannerUnitId('test', 'ios')).toBe('ca-app-pub-3940256099942544/2435281174');
  });

  it('resolveBannerUnitId: production + placeholder → ADS_CONFIG', () => {
    const { web } = loadWeb();
    // isolateModules 레지스트리의 errors 클래스는 본 파일 import 와 별개 객체 → code 로 검증
    expect(() => web.resolveBannerUnitId('production', 'android')).toThrow(
      expect.objectContaining({ code: 'ADS_CONFIG', name: AdsConfigError.name }),
    );
  });

  it('AD_UNIT_IDS 는 placeholder', () => {
    const { web } = loadWeb();
    expect(web.AD_UNIT_IDS).toEqual({
      ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',
      android: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',
    });
  });

  it('광고 SDK mock 의 어떤 함수도 호출되지 않는다', async () => {
    const { web, sdk } = loadWeb();
    await web.initializeAds();
    await web.showPrivacyOptionsForm();
    web.__resetForTesting();
    web.resolveBannerUnitId('test', 'android');

    const fns = collectSdkMockFns(sdk);
    // initialize + AdsConsent 4종 + BannerAd
    expect(fns).toHaveLength(6);
    for (const fn of fns) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
});
