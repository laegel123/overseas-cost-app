/**
 * 도시별 데이터 출처 화면 (`/sources/[cityId]`) — 카테고리 그룹 + 원문 링크 (ADR-071).
 *
 * `/sources` 목록에서 도시를 탭하면 push 되는 2단계 드릴다운. 그룹핑·순서
 * (`CATEGORY_ORDER`)·빈 그룹 제외는 전부 `src/lib/sources.ts` 책임이라 화면은 받은
 * 순서 그대로 그린다 — v1.0 에서 출처 0개인 tax 는 애초에 넘어오지 않는다.
 *
 * 출처명은 가공하지 않는다. 기관 고유명 원어 유지가 정책이고 (ADR-070), 이름이
 * 길어도 말줄임 없이 줄바꿈으로 전부 노출한다 (UI_GUIDE §디자인 원칙 5 — 출처를
 * 숨기지 않는다).
 *
 * "페이지 열기 →" 는 출처 기관의 공식 페이지를 외부 브라우저로 연다. ADR-071 이
 * 없앤 것은 앱의 정책 페이지를 외부 문서로 대체하던 링크지 출처 원문 링크가 아니다.
 */

import * as React from 'react';

import { Alert, Pressable, View } from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { ErrorView } from '@/components/ErrorView';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { Body, MonoLabel, Small, Tiny } from '@/components/typography/Text';
import { CATEGORY_ICON, CATEGORY_LABEL, getCity, getCitySourcesByCategory } from '@/lib';
import type { CategorySourceGroup } from '@/lib';
import { openURL } from '@/lib/linking';
import { colors } from '@/theme/tokens';
import type { CitySource, SourceCategory } from '@/types/city';

type SourceCityState =
  | { status: 'ready'; cityNameKo: string; groups: CategorySourceGroup[] }
  | { status: 'error' };

/**
 * 도시 존재 여부는 `getCitySourcesByCategory` 의 throw 로 판정한다 (lib 계약) —
 * 화면이 크래시로 흘려보내지 않고 ErrorView 로 변환한다 (ARCHITECTURE §에러 처리 룰).
 */
function resolveState(cityId: string | undefined): SourceCityState {
  if (cityId === undefined) return { status: 'error' };
  try {
    const groups = getCitySourcesByCategory(cityId);
    // 위 호출이 통과했으면 같은 도시 맵에 존재한다 — undefined 는 타입상 잔여 가능성.
    const city = getCity(cityId);
    if (city === undefined) return { status: 'error' };
    return { status: 'ready', cityNameKo: city.name.ko, groups };
  } catch {
    return { status: 'error' };
  }
}

/** 외부 브라우저 열기 — 실패를 사용자에게 알린다 (settings 의 safeOpenURL 과 동일 패턴). */
async function safeOpenURL(url: string): Promise<void> {
  try {
    await openURL(url);
  } catch {
    Alert.alert('링크 열기 실패', '브라우저를 열 수 없습니다.');
  }
}

export default function SourceCityScreen(): React.ReactElement {
  const { cityId } = useLocalSearchParams<{ cityId: string }>();
  const router = useRouter();

  const handleBack = React.useCallback(() => {
    router.back();
  }, [router]);

  // 화면에 상태가 없어 재렌더는 네비게이션 시점뿐 — 메모이제이션 불필요.
  const state = resolveState(cityId);

  if (state.status === 'error') {
    return (
      <Screen testID="source-city-error">
        <ErrorView
          variant="screen"
          message="출처 정보를 찾을 수 없어요"
          onRetry={handleBack}
          retryLabel="돌아가기"
        />
      </Screen>
    );
  }

  const totalCount = state.groups.reduce((sum, group) => sum + group.sources.length, 0);

  return (
    <Screen scroll testID="source-city-screen">
      <TopBar
        title={state.cityNameKo}
        subtitle={`출처 ${totalCount}개`}
        onBack={handleBack}
        testID="source-city-topbar"
      />

      {state.groups.map((group) => (
        <View key={group.category} className="mt-4" testID={`source-group-${group.category}`}>
          <View className="flex-row items-center gap-2 mb-2">
            <Icon
              name={CATEGORY_ICON[group.category]}
              size={16}
              color={colors.gray2}
              testID={`source-icon-${group.category}`}
            />
            <MonoLabel>{CATEGORY_LABEL[group.category]}</MonoLabel>
          </View>
          <View className="gap-2">
            {group.sources.map((source, idx) => (
              <SourceCard
                key={`${source.name}-${idx}`}
                category={group.category}
                source={source}
                index={idx}
              />
            ))}
          </View>
        </View>
      ))}

      <View
        className="mt-6 pt-4 border-t border-dashed border-line gap-1"
        testID="source-city-footer"
      >
        <Tiny>모든 데이터는 위 공공 출처에서 자동으로 갱신됩니다.</Tiny>
        <Tiny>환율은 매일, 식비는 매주, 월세는 매월, 교통·학비·비자는 분기마다 갱신돼요.</Tiny>
      </View>

      <View className="h-6" />
    </Screen>
  );
}

type SourceCardProps = {
  category: SourceCategory;
  source: CitySource;
  index: number;
};

/**
 * 출처 카드 — 이름(줄바꿈 허용) / 접속일 / 외부 링크.
 * 이름에 `numberOfLines` 를 주지 않는 것이 요구사항이다 (말줄임 금지).
 */
function SourceCard({ category, source, index }: SourceCardProps): React.ReactElement {
  const handleOpen = React.useCallback(() => {
    void safeOpenURL(source.url);
  }, [source.url]);

  return (
    <View
      className="bg-white rounded-card border border-line p-card-pad gap-1"
      testID={`source-item-${category}-${index}`}
    >
      <Body color="navy">{source.name}</Body>
      <Tiny>{`접속일 ${source.accessedAt}`}</Tiny>
      <Pressable
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={`${source.name} 페이지 열기`}
        className="self-start pt-1"
        testID={`source-open-${category}-${index}`}
      >
        <Small color="orange" className="font-manrope-bold">
          페이지 열기 →
        </Small>
      </Pressable>
    </View>
  );
}
