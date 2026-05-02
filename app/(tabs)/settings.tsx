/**
 * Settings 화면 — 페르소나 표시 + 사용 통계 + 메뉴.
 *
 * design/README.md §5 (Settings) 구현.
 * - Persona card: navy 단색 (gradient 는 v2, 본 step 에서 expo-linear-gradient 설치 금지)
 * - Stat cards: 즐겨찾기 / 최근 본 / 도시 DB count
 * - Menu list: MenuRow 5개 (데이터 새로고침 hot, 앱 정보 dim)
 * - Footer: Made with ♥ in Seoul · 2026
 *
 * 외부 링크는 모두 Linking.openURL 경유. 데이터 새로고침은 refreshCache (내부에서 refreshFx 포함).
 */

import * as React from 'react';

import { Alert, Pressable, View } from 'react-native';

// eslint-disable-next-line import/no-named-as-default
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { MenuRow } from '@/components/MenuRow';
import { Screen } from '@/components/Screen';
import { H1, H3, Tiny } from '@/components/typography/Text';
import { formatShortDate, getAllCities, refreshCache } from '@/lib';
import { openURL } from '@/lib/linking';
import { PERSONA_ICON, PERSONA_LABEL, PERSONA_SUB } from '@/lib/persona';
import { useFavoritesStore } from '@/store/favorites';
import { usePersonaStore } from '@/store/persona';
import { useRecentStore } from '@/store/recent';
import { useSettingsStore } from '@/store/settings';
import { colors } from '@/theme/tokens';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
// TODO(v1.x): docs/DATA_SOURCES.md 섹션 수를 빌드 타임에 자동 카운트로 교체.
// 현재는 수동 동기화 — 출처 추가 시 본 상수 갱신 필수. 누락 위험 추적용 TODO.
const DATA_SOURCES_COUNT = 12;
const PRIVACY_POLICY_URL = 'https://github.com/laegel123/overseas-cost-app/blob/main/docs/PRIVACY.md';
const DATA_SOURCES_URL = 'https://github.com/laegel123/overseas-cost-app/blob/main/docs/DATA_SOURCES.md';
const FEEDBACK_EMAIL = 'laegel1@gmail.com';

type RefreshState = 'idle' | 'loading' | 'error';

export default function SettingsScreen(): React.ReactElement {
  const router = useRouter();
  const persona = usePersonaStore((s) => s.persona);
  const setOnboarded = usePersonaStore((s) => s.setOnboarded);
  const favoriteIds = useFavoritesStore((s) => s.cityIds);
  const recentIds = useRecentStore((s) => s.cityIds);
  const lastSync = useSettingsStore((s) => s.lastSync);
  const updateLastSync = useSettingsStore((s) => s.updateLastSync);

  const [refreshState, setRefreshState] = React.useState<RefreshState>('idle');

  // refreshCache 성공 시 외부 (data.ts citiesInMemory) 상태가 갱신되며 lastSync 도
  // 같은 흐름에서 갱신된다. ESLint 의 exhaustive-deps 는 외부 모듈 상태를 모르므로
  // lastSync 를 dep 으로 명시하고 경고를 의도적으로 무시.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const citiesCount = React.useMemo(() => Object.keys(getAllCities()).length, [lastSync]);

  const handleChangePersona = React.useCallback(() => {
    setOnboarded(false);
    router.replace('/onboarding');
  }, [setOnboarded, router]);

  const handleRefresh = React.useCallback(async () => {
    setRefreshState('loading');
    const result = await refreshCache();
    if (result.ok) {
      updateLastSync(result.lastSync);
      setRefreshState('idle');
    } else {
      setRefreshState('error');
    }
  }, [updateLastSync]);

  const safeOpenURL = React.useCallback(async (url: string, failMessage: string) => {
    try {
      await openURL(url);
    } catch {
      Alert.alert('링크 열기 실패', failMessage);
    }
  }, []);

  const handleDataSources = React.useCallback(() => {
    void safeOpenURL(DATA_SOURCES_URL, '브라우저를 열 수 없습니다.');
  }, [safeOpenURL]);

  const handleFeedback = React.useCallback(() => {
    const subject = encodeURIComponent('해외 생활비 비교 앱 피드백');
    void safeOpenURL(
      `mailto:${FEEDBACK_EMAIL}?subject=${subject}`,
      '이메일 앱을 찾을 수 없습니다.',
    );
  }, [safeOpenURL]);

  const handlePrivacy = React.useCallback(() => {
    void safeOpenURL(PRIVACY_POLICY_URL, '브라우저를 열 수 없습니다.');
  }, [safeOpenURL]);

  const formatLastSync = React.useCallback((): string => {
    if (refreshState === 'loading') return '갱신 중...';
    if (refreshState === 'error') return '갱신 실패';
    // 신규 설치 — 한 번도 동기화하지 않음 (번들 시드 사용 중).
    if (lastSync === null) return '동기화 전';
    // formatShortDate 재사용 — UTC 기준 (lastSync 가 UTC ISO 문자열이라 표시도 동일).
    try {
      return formatShortDate(lastSync);
    } catch {
      return '동기화 전';
    }
  }, [refreshState, lastSync]);

  return (
    <Screen scroll testID="settings-screen">
      {/* Header */}
      <View className="flex-row items-center justify-between pt-2 pb-4">
        <H1>설정</H1>
        {/* 더 보기 메뉴는 v1.x — 현재는 시각 stub. button role 미부여 (스크린 리더 혼동 방지). */}
        <View
          className="w-9 h-9 rounded-icon-sm items-center justify-center bg-light"
          accessible={false}
          importantForAccessibility="no"
          testID="settings-more-btn"
        >
          <Icon name="more" size={22} color={colors.gray2} />
        </View>
      </View>

      {/* Persona Card */}
      <View
        className="bg-navy rounded-hero-lg p-hero-pad mb-4"
        testID="persona-card"
      >
        <View className="flex-row items-center gap-3">
          <View className="w-14 h-14 rounded-hero-icon bg-orange items-center justify-center">
            <Icon
              name={PERSONA_ICON[persona]}
              size={28}
              color={colors.white}
              testID="persona-icon"
            />
          </View>
          <View className="flex-1">
            <H3 color="white" testID="persona-label">
              {PERSONA_LABEL[persona]} 모드
            </H3>
            <Tiny color="white" className="opacity-70" testID="persona-sub">
              {PERSONA_SUB[persona]}
            </Tiny>
          </View>
          <Pressable
            onPress={handleChangePersona}
            className="px-3 py-1.5 rounded-btn bg-white/10 border border-white/20"
            accessibilityRole="button"
            accessibilityLabel="페르소나 변경"
            testID="persona-change-btn"
          >
            <Tiny color="white">변경</Tiny>
          </Pressable>
        </View>
      </View>

      {/* Stat Cards */}
      <View className="flex-row gap-2 mb-4" testID="stat-cards">
        <StatCard value={favoriteIds.length} label="즐겨찾기" testID="stat-favorites" />
        <StatCard value={recentIds.length} label="최근 본" testID="stat-recent" />
        <StatCard value={citiesCount} label="도시 DB" testID="stat-cities" />
      </View>

      {/* Menu List */}
      <View className="rounded-card-lg overflow-hidden bg-white border border-line mb-4">
        <MenuRow
          icon="refresh"
          label="데이터 새로고침"
          rightText={formatLastSync()}
          variant="hot"
          onPress={handleRefresh}
          disabled={refreshState === 'loading'}
          testID="menu-refresh"
        />
        <MenuRow
          icon="book"
          label="데이터 출처 보기"
          rightText={`${DATA_SOURCES_COUNT}개`}
          onPress={handleDataSources}
          testID="menu-sources"
        />
        <MenuRow
          icon="mail"
          label="피드백 보내기"
          onPress={handleFeedback}
          testID="menu-feedback"
        />
        <MenuRow
          icon="shield"
          label="개인정보 처리방침"
          onPress={handlePrivacy}
          testID="menu-privacy"
        />
        <MenuRow
          icon="info"
          label="앱 정보"
          rightText={`v${APP_VERSION}`}
          variant="dim"
          isLast
          showChevron={false}
          testID="menu-app-info"
        />
      </View>

      {/* Footer */}
      <View className="items-center py-4">
        <Tiny testID="footer-text">Made with ♥ in Seoul · 2026</Tiny>
      </View>
    </Screen>
  );
}

type StatCardProps = {
  value: number;
  label: string;
  testID?: string;
};

function StatCard({ value, label, testID }: StatCardProps) {
  const valueTestID = testID !== undefined ? `${testID}-value` : undefined;
  return (
    <View
      className="flex-1 items-center py-card-pad rounded-card bg-white border border-line"
      testID={testID}
    >
      <H1 color="orange" {...(valueTestID !== undefined ? { testID: valueTestID } : {})}>
        {value}
      </H1>
      <Tiny>{label}</Tiny>
    </View>
  );
}
