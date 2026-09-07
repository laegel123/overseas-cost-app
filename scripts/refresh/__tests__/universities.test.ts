/**
 * universities.mjs 테스트.
 * TESTING.md §9-A.9 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshUniversities, {
  UNIVERSITY_REGISTRY,
  CITY_CONFIGS,
  buildSource,
  getTuitionForCity,
  fetchUniversityTuition,
} from '../universities.mjs';
import type { RefreshChange } from './_test-types';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-universities-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-universities-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

describe('UNIVERSITY_REGISTRY', () => {
  it('20개 도시 모두 포함', () => {
    expect(Object.keys(UNIVERSITY_REGISTRY)).toHaveLength(20);
  });

  it('각 도시에 최소 1개 대학 매핑', () => {
    for (const [cityId, universities] of Object.entries(UNIVERSITY_REGISTRY)) {
      expect(universities.length).toBeGreaterThanOrEqual(1);
      for (const uni of universities) {
        expect(uni.school).toBeDefined();
        expect(uni.level).toMatch(/^(undergrad|graduate|language)$/);
        expect(uni.url).toMatch(/^https?:\/\//);
        expect(typeof uni.staticAnnual).toBe('number');
        expect(uni.staticAnnual).toBeGreaterThan(0);
      }
    }
  });
});

describe('CITY_CONFIGS', () => {
  it('20개 도시 설정', () => {
    expect(Object.keys(CITY_CONFIGS)).toHaveLength(20);
  });

  it('각 도시 필수 필드 포함', () => {
    for (const [cityId, config] of Object.entries(CITY_CONFIGS)) {
      expect(config.id).toBe(cityId);
      expect(config.name.ko).toBeDefined();
      expect(config.name.en).toBeDefined();
      expect(config.country).toBeDefined();
      expect(config.currency).toBeDefined();
      expect(config.region).toBeDefined();
    }
  });
});

describe('buildSource', () => {
  it('tuition 카테고리', () => {
    expect(buildSource('vancouver').category).toBe('tuition');
  });

  it('url = 해당 도시 registry 첫 대학의 실제 페이지 (ADR-071)', () => {
    expect(buildSource('vancouver').url).toBe(UNIVERSITY_REGISTRY.vancouver[0]!.url);
    expect(buildSource('tokyo').url).toBe(UNIVERSITY_REGISTRY.tokyo[0]!.url);
  });

  it('url 이 우리 저장소(github.com) 를 가리키지 않음 — 20개 도시 전부 (ADR-071)', () => {
    for (const cityId of Object.keys(UNIVERSITY_REGISTRY)) {
      expect(buildSource(cityId).url).not.toContain('github.com');
    }
  });

  it('출처명은 도시별 대학명 + 한국어 서술 + "정적 추정치" 마커 (ADR-070, AUTOMATION.md §8)', () => {
    expect(buildSource('vancouver').name).toBe(
      'UBC · SFU · BCIT 공식 국제학생 학비 페이지 (정적 추정치)',
    );
    expect(buildSource('tokyo').name).toBe(
      '東京大学 · 早稲田大学 · 慶應義塾大学 공식 국제학생 학비 페이지 (정적 추정치)',
    );
  });

  it('출처명이 도시별로 다름 + 모든 도시가 마커 유지', () => {
    const names = Object.keys(UNIVERSITY_REGISTRY).map((id) => buildSource(id).name);
    for (const name of names) {
      expect(name).toContain('학비');
      expect(name).toContain('정적 추정치');
    }
    expect(buildSource('vancouver').name).not.toBe(buildSource('tokyo').name);
  });

  it('legacyNames 에 구 한국어명·구 영문명 둘 다 포함 (데이터 중복 방지)', () => {
    const { legacyNames } = buildSource('vancouver');
    expect(legacyNames).toContain('각 대학 공식 국제학생 학비 페이지 (정적 추정치)');
    expect(legacyNames).toContain(
      'Official university international tuition pages (static estimates)',
    );
  });

  it('registry 미등록 도시: 명시적 throw (silent fallback 금지)', () => {
    expect(() => buildSource('unknown-city')).toThrow(/No university registry entry/);
  });
});

describe('fetchUniversityTuition', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useRealTimers();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('정상 응답: school, level, annual 반환', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<html>tuition page</html>',
    });

    const university = UNIVERSITY_REGISTRY.vancouver[0]!;
    const result = await fetchUniversityTuition(university);

    expect(result.school).toBe(university.school);
    expect(result.level).toBe(university.level);
    expect(result.annual).toBe(university.staticAnnual);
    expect(result.fetchedFromPage).toBe(true);
  }, 30000);

  it('fetch 실패: static fallback 사용', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const university = UNIVERSITY_REGISTRY.vancouver[0]!;
    const result = await fetchUniversityTuition(university);

    expect(result.school).toBe(university.school);
    expect(result.annual).toBe(university.staticAnnual);
    expect(result.fetchedFromPage).toBe(false);
  }, 30000);

  it('4xx 응답: static fallback 사용', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 404,
    });

    const university = UNIVERSITY_REGISTRY.vancouver[0]!;
    const result = await fetchUniversityTuition(university);

    expect(result.fetchedFromPage).toBe(false);
  }, 30000);
});

describe('getTuitionForCity', () => {
  it('정상 도시: tuition 배열 반환', async () => {
    const result = await getTuitionForCity('vancouver', { useStatic: true });

    expect(result.tuition.length).toBe(UNIVERSITY_REGISTRY.vancouver.length);
    for (const entry of result.tuition) {
      expect(entry.school).toBeDefined();
      expect(entry.level).toBeDefined();
      expect(entry.annual).toBeGreaterThan(0);
    }
  });

  it('알 수 없는 도시: 빈 배열 + 에러', async () => {
    const result = await getTuitionForCity('unknown-city', { useStatic: true });

    expect(result.tuition).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('독일 도시: 등록비 수준 학비 (700 EUR 내외)', async () => {
    const result = await getTuitionForCity('berlin', { useStatic: true });

    for (const entry of result.tuition) {
      expect(entry.annual).toBeLessThan(1000);
    }
  });

  it('일본 도시: JPY 단위 학비', async () => {
    const result = await getTuitionForCity('tokyo', { useStatic: true });

    for (const entry of result.tuition) {
      expect(entry.annual).toBeGreaterThan(100000);
    }
  });

  it('호치민: VND 단위 학비', async () => {
    const result = await getTuitionForCity('hochiminh', { useStatic: true });

    for (const entry of result.tuition) {
      expect(entry.annual).toBeGreaterThan(1000000);
    }
  });
});

describe('refresh (integration)', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useRealTimers();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('dryRun=true + useStatic=true: 파일 미갱신', async () => {
    const result = await refreshUniversities({ dryRun: true, useStatic: true });

    expect(result.source).toBe('universities');
    expect(result.changes.length).toBeGreaterThan(0);

    const vancouverPath = path.join(testDir, 'cities', 'vancouver.json');
    expect(fs.existsSync(vancouverPath)).toBe(false);
  }, 30000);

  it('특정 도시만 갱신', async () => {
    const result = await refreshUniversities({ dryRun: true, useStatic: true, cities: ['vancouver'] });

    const vancouverChanges = result.changes.filter((c: RefreshChange) => c.cityId === 'vancouver');
    const torontoChanges = result.changes.filter((c: RefreshChange) => c.cityId === 'toronto');

    expect(vancouverChanges.length).toBeGreaterThan(0);
    expect(torontoChanges.length).toBe(0);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshUniversities({ dryRun: true, useStatic: true });

    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('cities');
    expect(result).toHaveProperty('fields');
    expect(result).toHaveProperty('changes');
    expect(result).toHaveProperty('errors');
    expect(Array.isArray(result.cities)).toBe(true);
    expect(Array.isArray(result.fields)).toBe(true);
    expect(Array.isArray(result.changes)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  }, 30000);

  it('기존 데이터 대비 changes 계산', async () => {
    const existingData = {
      id: 'vancouver',
      name: { ko: '밴쿠버', en: 'Vancouver' },
      country: 'CA',
      currency: 'CAD',
      region: 'na',
      lastUpdated: '2026-04-01',
      rent: { share: 1000, studio: 1500, oneBed: 1800, twoBed: 2200 },
      food: { restaurantMeal: 2000, cafe: 500, groceries: { milk1L: 300, eggs12: 400, rice1kg: 350, chicken1kg: 1400, bread: 350 } },
      transport: { monthlyPass: 10000, singleRide: 300, taxiBase: 400 },
      tuition: [
        { school: 'UBC', level: 'undergrad', annual: 40000 },
      ],
      sources: [{ category: 'rent', name: 'CMHC', url: 'https://cmhc.ca/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'vancouver.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshUniversities({ dryRun: true, useStatic: true, cities: ['vancouver'] });

    expect(result.changes.length).toBeGreaterThan(0);
    const tuitionChange = result.changes.find((c: RefreshChange) => c.field.includes('tuition'));
    expect(tuitionChange).toBeDefined();
    expect(typeof tuitionChange?.pctChange).toBe('number');
  }, 30000);

  it('값 변동 0 + 구 출처명 잔존: 이름만 이전 (ADR-070) — 재실행은 no-op', async () => {
    const cityPath = path.join(testDir, 'cities', 'vancouver.json');
    const existingData = {
      id: 'vancouver',
      name: { ko: '밴쿠버', en: 'Vancouver' },
      country: 'CA',
      currency: 'CAD',
      region: 'na',
      lastUpdated: '2026-04-01',
      rent: { share: 1000, studio: 1500, oneBed: 1800, twoBed: 2200 },
      food: { restaurantMeal: 2000, cafe: 500, groceries: { milk1L: 300, eggs12: 400, rice1kg: 350, chicken1kg: 1400, bread: 350 } },
      transport: { monthlyPass: 10000, singleRide: 300, taxiBase: 400 },
      // registry 와 동일한 값 → 숫자 변동 0.
      tuition: UNIVERSITY_REGISTRY.vancouver.map((u) => ({
        school: u.school,
        level: u.level,
        annual: u.staticAnnual,
      })),
      // 이전 상태: 구 한국어 출처명 + 우리 저장소를 가리키던 url.
      sources: [
        {
          category: 'tuition',
          name: '각 대학 공식 국제학생 학비 페이지 (정적 추정치)',
          url: 'https://github.com/laegel123/overseas-cost-app/blob/main/docs/DATA_SOURCES.md',
          accessedAt: '2026-04-01',
        },
      ],
    };
    fs.writeFileSync(cityPath, JSON.stringify(existingData));

    const first = await refreshUniversities({ useStatic: true, cities: ['vancouver'] });
    expect(first.changes).toHaveLength(0);
    expect(first.cities).toContain('vancouver');

    const written = JSON.parse(fs.readFileSync(cityPath, 'utf-8'));
    const tuitionSources = written.sources.filter((s: { category: string }) => s.category === 'tuition');
    expect(tuitionSources).toHaveLength(1);
    expect(tuitionSources[0].name).toBe(buildSource('vancouver').name);
    expect(tuitionSources[0].url).toBe(buildSource('vancouver').url);
    expect(written.tuition).toEqual(existingData.tuition);

    // 이전 완료 후 재실행 = 쓸 이유 없음.
    const second = await refreshUniversities({ useStatic: true, cities: ['vancouver'] });
    expect(second.cities).not.toContain('vancouver');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshUniversities({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.length).toBeGreaterThan(0);
  }, 30000);

  it('페이지 fetch 실패: errors에 추가 + static fallback', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshUniversities({ dryRun: true, cities: ['vancouver'] });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);
});
