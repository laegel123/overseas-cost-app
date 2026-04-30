/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // ADR-016 / ADR-053: 다크 모드 미지원 (userInterfaceStyle: "light" 강제).
  // NativeWind v4 기본 'media' 모드가 system 다크 추적을 시도해 web 에서
  // "Cannot manually set color scheme" 에러를 일으킨다. 'class' 로 전환하면
  // 우리가 명시적으로 dark 클래스를 토글할 때만 동작 — v1.0 에선 토글하지
  // 않으므로 web/native 모두 항상 light.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        orange: '#FC6011',
        'orange-soft': '#FFE9DC',
        'orange-tint': '#FFF4ED',
        navy: '#11263C',
        'navy-2': '#1d3a55',
        gray: '#52616B',
        'gray-2': '#8A98A0',
        light: '#F0F5F9',
        'light-2': '#F7FAFC',
        white: '#FFFFFF',
        line: '#E4ECF2',
      },
      fontFamily: {
        // RN 은 weight 별로 별도 fontFamily 명을 요구 (FONT_MAP 의 키와 1:1).
        // 본 phase (typography) 가 실제 사용하는 weight 만 alias 등록.
        // 새 weight 가 필요해지면 그 때 추가 (CLAUDE.md "추가는 ADR 로 정당화").
        manrope: ['Manrope', 'Pretendard', 'Apple SD Gothic Neo', 'system-ui'],
        'manrope-semibold': ['Manrope-SemiBold', 'Pretendard', 'Apple SD Gothic Neo', 'system-ui'],
        'manrope-bold': ['Manrope-Bold', 'Pretendard', 'Apple SD Gothic Neo', 'system-ui'],
        'manrope-extrabold': ['Manrope-ExtraBold', 'Pretendard', 'Apple SD Gothic Neo', 'system-ui'],
        mulish: ['Mulish', 'Pretendard', 'Apple SD Gothic Neo', 'system-ui'],
        pretendard: ['Pretendard', 'Apple SD Gothic Neo', 'system-ui'],
      },
      fontSize: {
        display: ['30px', { lineHeight: '33px', letterSpacing: '-0.6px' }],
        h1: ['24px', { lineHeight: '28px', letterSpacing: '-0.48px' }],
        h2: ['18px', { lineHeight: '22px', letterSpacing: '-0.18px' }],
        h3: ['14px', { lineHeight: '18px' }],
        body: ['14px', { lineHeight: '20px' }],
        small: ['12px', { lineHeight: '16px' }],
        tiny: ['11px', { lineHeight: '14px' }],
        'mono-label': ['10px', { lineHeight: '12px', letterSpacing: '1px' }],
        // BottomTabBar 라벨 전용 — mono-label 과 size 동일 (10px) 하지만
        // letter-spacing / uppercase 없음. design/README §Bottom Tab Bar.
        'tab-label': ['10px', { lineHeight: '12px' }],
      },
      borderRadius: {
        chip: '999px',
        button: '14px',
        card: '16px',
        'card-lg': '18px',
        hero: '20px',
        'hero-lg': '22px',
        'icon-sm': '10px',
        'icon-md': '16px',
      },
      spacing: {
        'screen-x': '20px',
        'screen-x-tight': '16px',
        'screen-x-loose': '22px',
        section: '16px',
        'card-pad': '14px',
      },
    },
  },
  plugins: [],
};
