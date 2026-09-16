/**
 * 데이터 출처 목록 화면 (`/sources`) — 도시별 출처 수 + 상세 드릴다운 (ADR-071).
 *
 * 기존의 "데이터 출처 보기 → GitHub 마크다운" 외부 링크를 대체하는 앱 내 화면.
 * 정렬(서울 고정 → 권역 → 가나다)·집계는 전부 `src/lib/sources.ts` 책임이며
 * 본 화면은 받은 순서 그대로 그린다.
 *
 * 권역 그룹 헤더는 두지 않는다 — 평평한 목록이고 권역은 정렬 순서로만 드러난다.
 * 헤더 부제의 출처 수는 런타임 실측이라 번들 시드만 있는 첫 실행에서는 작게
 * 나온다 (ADR-071 결정 2 — 의도된 동작).
 *
 * 푸터의 `Rates By Exchange Rate API` 링크는 환율 1차 출처 open.er-api.com 의
 * 무료 endpoint 약관이 요구하는 필수 표기다 (ADR-076 결정 1) — 원문 그대로 두고
 * 도시 목록이 비어 있어도 항상 노출한다.
 */

import * as React from 'react';

import { Alert, Pressable, View } from 'react-native';

import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { Body, Small, Tiny } from '@/components/typography/Text';
import { countUniqueSources, getCitySourceGroups } from '@/lib';
import { openURL } from '@/lib/linking';
import { colors } from '@/theme/tokens';

const FX_ATTRIBUTION_URL = 'https://www.exchangerate-api.com';

/** 외부 브라우저 열기 — 실패를 사용자에게 알린다 (settings 의 safeOpenURL 과 동일 패턴). */
async function safeOpenURL(url: string): Promise<void> {
  try {
    await openURL(url);
  } catch {
    Alert.alert('링크 열기 실패', '브라우저를 열 수 없습니다.');
  }
}

export default function SourcesScreen(): React.ReactElement {
  const router = useRouter();

  // 화면에 상태가 없어 재렌더는 네비게이션 시점뿐 — 메모이제이션 불필요.
  const groups = getCitySourceGroups();
  const uniqueCount = countUniqueSources();

  const handleBack = React.useCallback(() => {
    router.back();
  }, [router]);

  const handleCityPress = React.useCallback(
    (cityId: string) => {
      router.push(`/sources/${cityId}`);
    },
    [router],
  );

  const handleFxAttributionPress = React.useCallback(() => {
    void safeOpenURL(FX_ATTRIBUTION_URL);
  }, []);

  return (
    <Screen scroll testID="sources-screen">
      <TopBar
        title="데이터 출처"
        subtitle={`출처 ${uniqueCount}개`}
        onBack={handleBack}
        testID="sources-topbar"
      />

      {groups.length === 0 ? (
        <View className="py-8 items-center justify-center" testID="sources-empty">
          <Body color="gray-2" className="text-center">
            출처 정보를 불러오지 못했어요.{'\n'}설정에서 데이터를 새로고침해 주세요
          </Body>
        </View>
      ) : (
        <View
          className="mt-4 mb-4 rounded-card-lg overflow-hidden bg-white border border-line"
          testID="sources-city-list"
        >
          {groups.map((group, idx) => (
            <CitySourceRow
              key={group.cityId}
              cityId={group.cityId}
              cityNameKo={group.cityNameKo}
              count={group.count}
              isLast={idx === groups.length - 1}
              onPress={handleCityPress}
            />
          ))}
        </View>
      )}

      <View className="mt-6 pt-4 border-t border-dashed border-line gap-1" testID="sources-footer">
        <Tiny>환율은 아래 서비스의 무료 API 로 매일 갱신됩니다.</Tiny>
        <Pressable
          onPress={handleFxAttributionPress}
          accessibilityRole="link"
          accessibilityLabel="Exchange Rate API 페이지 열기"
          className="self-start pt-1"
          testID="fx-attribution-link"
        >
          <Small color="orange" className="font-manrope-bold">
            Rates By Exchange Rate API
          </Small>
        </Pressable>
      </View>

      <View className="h-6" />
    </Screen>
  );
}

type CitySourceRowProps = {
  cityId: string;
  cityNameKo: string;
  count: number;
  isLast: boolean;
  onPress: (cityId: string) => void;
};

/**
 * 도시 행 — `MenuRow` 의 시각 규격(padding 14×14, gap 12, 마지막 행 border 없음)
 * 을 따르되 아이콘 박스는 없다. `MenuRow` 는 `icon` 이 필수 prop 이라 재사용하지
 * 않았고, 사용처가 이 화면 하나뿐이라 공용 컴포넌트로 빼지도 않았다.
 */
function CitySourceRow({
  cityId,
  cityNameKo,
  count,
  isLast,
  onPress,
}: CitySourceRowProps): React.ReactElement {
  const handlePress = React.useCallback(() => {
    onPress(cityId);
  }, [onPress, cityId]);
  const containerClass = [
    'flex-row items-center px-card-pad py-card-pad gap-3',
    isLast ? '' : 'border-b border-line',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${cityNameKo} 출처 ${count}개 보기`}
      className={containerClass}
      testID={`source-city-${cityId}`}
    >
      <View className="flex-1">
        <Body color="navy" numberOfLines={1}>
          {cityNameKo}
        </Body>
      </View>
      <Tiny numberOfLines={1}>{`${count}개`}</Tiny>
      <Icon name="chev-right" size={22} color={colors.gray2} />
    </Pressable>
  );
}
