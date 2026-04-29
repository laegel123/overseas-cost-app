import { useFonts as useExpoFonts } from 'expo-font';

/**
 * 폰트 family key → 파일 매핑. NativeWind 의 fontFamily 값 ('Manrope', 'Mulish', 'Pretendard')
 * 와 정확히 일치해야 한다 (tailwind.config.js fontFamily 참조).
 */
export const FONT_MAP = {
  Manrope: require('../../assets/fonts/Manrope-Regular.ttf'),
  'Manrope-Medium': require('../../assets/fonts/Manrope-Medium.ttf'),
  'Manrope-SemiBold': require('../../assets/fonts/Manrope-SemiBold.ttf'),
  'Manrope-Bold': require('../../assets/fonts/Manrope-Bold.ttf'),
  'Manrope-ExtraBold': require('../../assets/fonts/Manrope-ExtraBold.ttf'),
  Mulish: require('../../assets/fonts/Mulish-Regular.ttf'),
  Pretendard: require('../../assets/fonts/Pretendard-Regular.otf'),
} as const;

/**
 * 본 hook 은 `app/_layout.tsx` 에서 호출. 모든 폰트 로딩 완료 시 splash 해제 가능.
 */
export function useAppFonts(): { ready: boolean; error: Error | null } {
  const [loaded, error] = useExpoFonts(FONT_MAP);
  return { ready: loaded, error };
}
