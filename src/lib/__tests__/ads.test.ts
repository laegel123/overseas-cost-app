/**
 * docs/TESTING.md §9.42 — src/lib/ads.native.ts (jest-expo 는 `../ads` 를 .native 로 해석).
 *
 * 광고 SDK 는 jest.setup.js 전역 mock. ESLint `no-restricted-imports` 때문에 테스트도
 * SDK 를 import 하지 않고 `jest.requireMock` 으로 mock 함수에 접근한다.
 */

import { Platform } from 'react-native';

import {
  __resetForTesting,
  AD_UNIT_IDS,
  initializeAds,
  resolveAdsMode,
  resolveBannerUnitId,
  showPrivacyOptionsForm,
} from '../ads';
import { AdsConfigError } from '../errors';

type AdsSdkMock = {
  default: () => { initialize: jest.Mock };
  AdsConsent: {
    gatherConsent: jest.Mock;
    getConsentInfo: jest.Mock;
    showPrivacyOptionsForm: jest.Mock;
  };
  TestIds: { ADAPTIVE_BANNER: string };
};

const sdk = jest.requireMock<AdsSdkMock>('react-native-google-mobile-ads');
const initialize = sdk.default().initialize;
const { gatherConsent, getConsentInfo } = sdk.AdsConsent;

const REAL_UNIT_ID = 'ca-app-pub-1234567890123456/1234567890';

function setDev(value: boolean): void {
  jest.replaceProperty(globalThis as unknown as { __DEV__: boolean }, '__DEV__', value);
}

beforeEach(() => {
  __resetForTesting();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
  __resetForTesting();
});

describe('resolveAdsMode', () => {
  it("env '1' → test (dev=false 여도)", () => {
    expect(resolveAdsMode('1', false)).toBe('test');
  });

  it('env 없음 + dev=true → test', () => {
    expect(resolveAdsMode(undefined, true)).toBe('test');
  });

  it('env 없음 + dev=false → production', () => {
    expect(resolveAdsMode(undefined, false)).toBe('production');
  });

  it("env '0' + dev=false → production", () => {
    expect(resolveAdsMode('0', false)).toBe('production');
  });
});

describe('resolveBannerUnitId', () => {
  it('test → TestIds.ADAPTIVE_BANNER', () => {
    expect(resolveBannerUnitId('test', 'ios')).toBe(sdk.TestIds.ADAPTIVE_BANNER);
    expect(resolveBannerUnitId('test', 'android')).toBe(sdk.TestIds.ADAPTIVE_BANNER);
  });

  it.each(['ios', 'android'] as const)(
    'production + placeholder (%s) → AdsConfigError (code ADS_CONFIG)',
    (platform) => {
      try {
        resolveBannerUnitId('production', platform);
        throw new Error('should not reach');
      } catch (e) {
        expect(e).toBeInstanceOf(AdsConfigError);
        expect((e as AdsConfigError).code).toBe('ADS_CONFIG');
      }
    },
  );

  it('production + 실제 형식 → 그대로 반환', () => {
    jest.replaceProperty(AD_UNIT_IDS as { ios: string; android: string }, 'android', REAL_UNIT_ID);
    expect(resolveBannerUnitId('production', 'android')).toBe(REAL_UNIT_ID);
  });
});

describe('initializeAds', () => {
  it('호출 순서 gatherConsent → initialize → getConsentInfo + ready 결과', async () => {
    const result = await initializeAds();

    expect(gatherConsent).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(getConsentInfo).toHaveBeenCalledTimes(1);
    const [gatherOrder] = gatherConsent.mock.invocationCallOrder;
    const [initOrder] = initialize.mock.invocationCallOrder;
    const [infoOrder] = getConsentInfo.mock.invocationCallOrder;
    expect(gatherOrder).toBeLessThan(initOrder as number);
    expect(initOrder).toBeLessThan(infoOrder as number);

    expect(result).toEqual({
      status: 'ready',
      canRequestAds: true,
      privacyOptionsRequired: false,
      error: null,
    });
  });

  it('비맞춤형 강제 옵션 없이 gatherConsent 를 인자 없이 호출', async () => {
    await initializeAds();
    expect(gatherConsent).toHaveBeenCalledWith();
  });

  it('gatherConsent reject 여도 initialize 호출 + error 담김 + status ready', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const consentError = new Error('consent form failed');
    gatherConsent.mockRejectedValueOnce(consentError);

    const result = await initializeAds();

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(getConsentInfo).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ready');
    expect(result.canRequestAds).toBe(true);
    expect(result.error).toBe(consentError);
  });

  it('Error 가 아닌 reject 값은 Error 로 감싼다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    gatherConsent.mockRejectedValueOnce('network down');

    const result = await initializeAds();

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('network down');
  });

  it('initialize reject → disabled + error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const initError = new Error('sdk init failed');
    initialize.mockRejectedValueOnce(initError);

    const result = await initializeAds();

    expect(getConsentInfo).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'disabled',
      canRequestAds: false,
      privacyOptionsRequired: false,
      error: initError,
    });
  });

  it('getConsentInfo reject → disabled + error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const infoError = new Error('consent info failed');
    getConsentInfo.mockRejectedValueOnce(infoError);

    const result = await initializeAds();

    expect(result.status).toBe('disabled');
    expect(result.error).toBe(infoError);
  });

  it('AdsConfigError (production + placeholder) → SDK 3종 미호출 + disabled', async () => {
    setDev(false);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await initializeAds();

    expect(gatherConsent).not.toHaveBeenCalled();
    expect(initialize).not.toHaveBeenCalled();
    expect(getConsentInfo).not.toHaveBeenCalled();
    expect(result.status).toBe('disabled');
    expect(result.canRequestAds).toBe(false);
    expect(result.privacyOptionsRequired).toBe(false);
    expect(result.error).toBeInstanceOf(AdsConfigError);
    // __DEV__=false (운영 빌드) 에서는 콘솔 로그 없이 결과 error 로만 노출
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('production + 실제 단위 ID → SDK 호출 + ready', async () => {
    setDev(false);
    jest.replaceProperty(AD_UNIT_IDS as { ios: string; android: string }, 'ios', REAL_UNIT_ID);

    const result = await initializeAds();

    expect(gatherConsent).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ready');
    expect(result.error).toBeNull();
  });

  it("privacyOptionsRequirementStatus 'REQUIRED' → privacyOptionsRequired true", async () => {
    getConsentInfo.mockResolvedValueOnce({
      canRequestAds: false,
      privacyOptionsRequirementStatus: 'REQUIRED',
    });

    const result = await initializeAds();

    expect(result.privacyOptionsRequired).toBe(true);
    expect(result.canRequestAds).toBe(false);
  });

  it('동시 2회 호출 → SDK 1회 + 같은 결과 (멱등)', async () => {
    const p1 = initializeAds();
    const p2 = initializeAds();
    expect(p1).toBe(p2);

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBe(r2);
    expect(gatherConsent).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(getConsentInfo).toHaveBeenCalledTimes(1);
  });

  it('완료 후 재호출 → SDK 추가 호출 0 + 캐시 결과', async () => {
    const r1 = await initializeAds();
    const r2 = await initializeAds();

    expect(r2).toBe(r1);
    expect(gatherConsent).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(getConsentInfo).toHaveBeenCalledTimes(1);
  });

  it('실패 결과도 캐시 — 재호출해도 SDK 재시도 없음', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    initialize.mockRejectedValueOnce(new Error('sdk init failed'));

    const r1 = await initializeAds();
    const r2 = await initializeAds();

    expect(r2).toBe(r1);
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it('__resetForTesting 후 재실행 → SDK 재호출', async () => {
    const r1 = await initializeAds();
    __resetForTesting();
    const r2 = await initializeAds();

    expect(r2).not.toBe(r1);
    expect(gatherConsent).toHaveBeenCalledTimes(2);
    expect(initialize).toHaveBeenCalledTimes(2);
    expect(getConsentInfo).toHaveBeenCalledTimes(2);
  });

  it('__DEV__ 에서 error 가 있으면 console.error 1회 (재호출 시 추가 로그 없음)', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consentError = new Error('consent form failed');
    gatherConsent.mockRejectedValueOnce(consentError);

    await initializeAds();
    await initializeAds();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[ads]'), consentError);
  });

  it('error 가 없으면 console.error 미호출', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await initializeAds();

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("Platform.OS 'windows' → disabled + AdsConfigError + SDK 미호출", async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.replaceProperty(Platform, 'OS', 'windows');

    const result = await initializeAds();

    expect(result.status).toBe('disabled');
    expect(result.error).toBeInstanceOf(AdsConfigError);
    expect(gatherConsent).not.toHaveBeenCalled();
    expect(initialize).not.toHaveBeenCalled();
  });
});

describe('showPrivacyOptionsForm', () => {
  it('AdsConsent.showPrivacyOptionsForm 에 1회 위임 + void resolve', async () => {
    await expect(showPrivacyOptionsForm()).resolves.toBeUndefined();
    expect(sdk.AdsConsent.showPrivacyOptionsForm).toHaveBeenCalledTimes(1);
  });

  it('reject 는 그대로 전파', async () => {
    const formError = new Error('form unavailable');
    sdk.AdsConsent.showPrivacyOptionsForm.mockRejectedValueOnce(formError);

    await expect(showPrivacyOptionsForm()).rejects.toBe(formError);
  });
});
