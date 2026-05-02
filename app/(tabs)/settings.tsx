/**
 * Settings 화면 — 페르소나 표시 + 사용 통계 + 메뉴.
 *
 * design/README.md §5 (Settings) 구현.
 * - Persona card: navy 단색 (gradient 는 v2, 본 step 에서 expo-linear-gradient 설치 금지)
 * - Stat cards: 즐겨찾기 / 최근 본 / 도시 DB count
 * - Menu list: MenuRow 5개 (데이터 새로고침 hot, 앱 정보 dim)
 * - Footer: Made with ♥ in Seoul · 2026
 *
 * 외부 링크는 모두 Linking.openURL 경유. 데이터 새로고침은 refreshCache + refreshFx.
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
import { getAllCities, refreshCache } from '@/lib';
import { openURL } from '@/lib/linking';
import { PERSONA_ICON, PERSONA_LABEL, PERSONA_SUB } from '@/lib/persona';
import { useFavoritesStore } from '@/store/favorites';
import { usePersonaStore } from '@/store/persona';
import { useRecentStore } from '@/store/recent';
import { useSettingsStore } from '@/store/settings';
import { colors } from '@/theme/tokens';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const DATA_SOURCES_COUNT = 12;
const PRIVACY_POLICY_URL = 'https://github.com/laegel123/overseas-cost-app/blob/main/docs/PRIVACY.md';
const DATA_SOURCES_URL = 'https://github.com/laegel123/overseas-cost-app/blob/main/docs/DATA_SOURCES.md';
const FEEDBACK_EMAIL = 'laegel1@gmail.com';

type RefreshState = 'idle' | 'loading' | 'error';

export default function SettingsScreen() {
  const router = useRouter();
  const persona = usePersonaStore((s) => s.persona);
  const setOnboarded = usePersonaStore((s) => s.setOnboarded);
  const favoriteIds = useFavoritesStore((s) => s.cityIds);
  const recentIds = useRecentStore((s) => s.cityIds);
  const lastSync = useSettingsStore((s) => s.lastSync);
  const updateLastSync = useSettingsStore((s) => s.updateLastSync);

  const [refreshState, setRefreshState] = React.useState<RefreshState>('idle');

  const citiesCount = Object.keys(getAllCities()).length;

  const handleChangePersona = () => {
    setOnboarded(false);
    router.replace('/onboarding');
  };

  const handleRefresh = async () => {
    setRefreshState('loading');
    const result = await refreshCache();
    if (result.ok) {
      updateLastSync(result.lastSync);
      setRefreshState('idle');
    } else {
      setRefreshState('error');
    }
  };

  const safeOpenURL = async (url: string, failMessage: string) => {
    try {
      await openURL(url);
    } catch {
      Alert.alert('링크 열기 실패', failMessage);
    }
  };

  const handleDataSources = () => {
    void safeOpenURL(DATA_SOURCES_URL, '브라우저를 열 수 없습니다.');
  };

  const handleFeedback = () => {
    const subject = encodeURIComponent('해외 생활비 비교 앱 피드백');
    void safeOpenURL(
      `mailto:${FEEDBACK_EMAIL}?subject=${subject}`,
      '이메일 앱을 찾을 수 없습니다.',
    );
  };

  const handlePrivacy = () => {
    void safeOpenURL(PRIVACY_POLICY_URL, '브라우저를 열 수 없습니다.');
  };

  const formatLastSync = (): string => {
    if (refreshState === 'loading') return '갱신 중...';
    if (refreshState === 'error') return '갱신 실패';
    if (lastSync === null) return '방금';
    const date = new Date(lastSync);
    if (Number.isNaN(date.getTime())) return '방금';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}-${day}`;
  };

  return (
    <Screen scroll testID="settings-screen">
      {/* Header */}
      <View className="flex-row items-center justify-between pt-2 pb-4">
        <H1>설정</H1>
        <Pressable
          className="w-9 h-9 rounded-icon-sm items-center justify-center bg-light"
          accessibilityRole="button"
          accessibilityLabel="더 보기"
          testID="settings-more-btn"
        >
          <Icon name="more" size={22} color={colors.gray2} />
        </Pressable>
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
