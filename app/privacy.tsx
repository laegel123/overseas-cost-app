/**
 * 개인정보 처리방침 화면 (`/privacy`) — 본문 정본을 그대로 렌더 (ADR-071 / ADR-072).
 *
 * 기존의 "개인정보 처리방침 → GitHub Pages HTML" 외부 링크를 대체하는 앱 내 화면.
 * 본문은 전부 `PRIVACY_POLICY` 에서 온다 — 문장을 이 파일에 하드코딩하면 스토어
 * 등록용 `docs/privacy-policy.html` 과 앱 화면이 갈라진다 (ADR-072 결정 1).
 *
 * 섹션 번호(`1.`, `2.` …)는 정본의 `title` 에 없고 여기서 붙인다. HTML/MD 생성기
 * (`scripts/gen_privacy_docs.mjs`) 도 같은 규칙이라 섹션이 늘어도 번호가 맞는다.
 *
 * 법적 고지 문서라 본문은 자르지 않는다 — 말줄임(`numberOfLines`)도 "더 보기" 접기도
 * 없다. 탭 가능한 것은 운영자 이메일(`kind: 'email'`)뿐이고, 본문에 등장하는 다른
 * 외부 참조(환율 API 주소 등)는 사실 명시일 뿐이라 일반 텍스트로 둔다.
 */

import * as React from 'react';

import { Alert, Pressable, View } from 'react-native';

import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { Body, H3, Small } from '@/components/typography/Text';
import { PRIVACY_POLICY } from '@/lib';
import type { PrivacyBlock } from '@/lib';
import { openURL } from '@/lib/linking';

/** 메일 앱 열기 — 실패를 사용자에게 알린다 (settings 의 safeOpenURL 과 동일 패턴). */
async function safeOpenEmail(email: string): Promise<void> {
  try {
    await openURL(`mailto:${email}`);
  } catch {
    Alert.alert('링크 열기 실패', '이메일 앱을 찾을 수 없습니다.');
  }
}

export default function PrivacyScreen(): React.ReactElement {
  const router = useRouter();

  const handleBack = React.useCallback(() => {
    router.back();
  }, [router]);

  return (
    <Screen scroll testID="privacy-screen">
      <TopBar
        title="개인정보 처리방침"
        subtitle={`마지막 갱신 ${PRIVACY_POLICY.updatedAt}`}
        onBack={handleBack}
        testID="privacy-topbar"
      />

      <View className="mt-4 rounded-card bg-light p-card-pad" testID="privacy-lead">
        <Body color="navy" className="font-manrope-bold">
          {PRIVACY_POLICY.lead}
        </Body>
      </View>

      {PRIVACY_POLICY.sections.map((section, idx) => (
        <View key={section.title} className="mt-5" testID={`privacy-section-${idx}`}>
          <H3>{`${idx + 1}. ${section.title}`}</H3>
          <View className="mt-2 gap-2">
            {section.blocks.map((block, blockIdx) => (
              <PolicyBlock key={blockIdx} block={block} sectionIndex={idx} />
            ))}
          </View>
        </View>
      ))}

      <View className="h-6" />
    </Screen>
  );
}

type PolicyBlockProps = {
  block: PrivacyBlock;
  /** `email` 블록의 testID 접미사. 섹션당 email 블록은 최대 1개다. */
  sectionIndex: number;
};

function PolicyBlock({ block, sectionIndex }: PolicyBlockProps): React.ReactElement {
  switch (block.kind) {
    case 'paragraph':
      return <Body color="gray">{block.text}</Body>;
    case 'list':
      return (
        <View className="gap-2">
          {block.items.map((item, idx) => (
            <View key={idx} className="flex-row gap-2">
              <Body color="gray-2">•</Body>
              <Body color="gray" className="flex-1">
                {item}
              </Body>
            </View>
          ))}
        </View>
      );
    case 'email':
      return <EmailBlock label={block.label} email={block.email} sectionIndex={sectionIndex} />;
  }
}

type EmailBlockProps = {
  label: string;
  email: string;
  sectionIndex: number;
};

function EmailBlock({ label, email, sectionIndex }: EmailBlockProps): React.ReactElement {
  const handlePress = React.useCallback(() => {
    void safeOpenEmail(email);
  }, [email]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${label} 이메일 보내기`}
      className="self-start rounded-card bg-light p-card-pad gap-1"
      testID={`privacy-email-${sectionIndex}`}
    >
      <Small color="gray">{label}</Small>
      <Body color="orange" className="font-manrope-bold">
        {email}
      </Body>
    </Pressable>
  );
}
