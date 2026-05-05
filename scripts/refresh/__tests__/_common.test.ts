/**
 * _common.mjs 테스트.
 * TESTING.md §9-A.1 공통 헬퍼 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  setupTestEnv,
  createTempCityFile,
  readTempCityFile,
  tempCityExists,
  getTestDataDir,
  VALID_CITY_FIXTURE,
} from './setup';
import {
  fetchWithRetry,
  readCity,
  writeCity,
  getCityPath,
  getDataDir,
  redactSecretsInUrl,
  redactSecretsInBody,
  createCitySeed,
} from '../_common.mjs';

setupTestEnv();

describe('getDataDir', () => {
  it('DATA_DIR 환경변수 반환', () => {
    const result = getDataDir();
    expect(result).toBe(process.env.DATA_DIR);
  });
});

describe('getCityPath', () => {
  it('정상 id: 경로 반환', () => {
    const result = getCityPath('vancouver');
    expect(result).toContain('vancouver.json');
  });

  it('빈 문자열: throws InvalidCityIdError', () => {
    expect(() => getCityPath('')).toThrow('invalid city id');
  });

  it('숫자로 시작: throws', () => {
    expect(() => getCityPath('123city')).toThrow('invalid city id format');
  });

  it('대문자 포함: throws', () => {
    expect(() => getCityPath('Vancouver')).toThrow('invalid city id format');
  });

  it('특수문자 포함: throws', () => {
    expect(() => getCityPath('city_name')).toThrow('invalid city id format');
  });

  it('path traversal (..): throws', () => {
    expect(() => getCityPath('../etc/passwd')).toThrow('invalid city id format');
  });

  it('하이픈 허용: 정상', () => {
    const result = getCityPath('san-francisco');
    expect(result).toContain('san-francisco.json');
  });
});

describe('readCity', () => {
  it('정상 파일: 파싱 + 반환', async () => {
    createTempCityFile('test-city', VALID_CITY_FIXTURE);
    const result = await readCity('test-city');
    expect(result.id).toBe('test-city');
    expect(result.name.ko).toBe('테스트');
  });

  it('파일 부재: throws CityNotFoundError', async () => {
    await expect(readCity('nonexistent')).rejects.toMatchObject({
      code: 'CITY_NOT_FOUND',
    });
  });

  it('깨진 JSON: throws CityParseError', async () => {
    const dataDir = getTestDataDir();
    fs.writeFileSync(path.join(dataDir, 'broken.json'), '{ invalid json }');

    await expect(readCity('broken')).rejects.toMatchObject({
      code: 'CITY_PARSE_FAILED',
    });
  });

  it('스키마 위반: throws CitySchemaError', async () => {
    createTempCityFile('invalid', { id: 'invalid' });

    await expect(readCity('invalid')).rejects.toMatchObject({
      code: 'CITY_SCHEMA_INVALID',
    });
  });

  it('경로 traversal 시도: throws InvalidCityIdError', async () => {
    await expect(readCity('../../etc/passwd')).rejects.toMatchObject({
      code: 'INVALID_CITY_ID',
    });
  });
});

describe('writeCity', () => {
  it('새 파일 작성', async () => {
    const source = { category: 'rent', name: 'Test', url: 'https://example.com' };
    await writeCity('new-city', { ...VALID_CITY_FIXTURE, id: 'new-city' } as any, source);

    expect(tempCityExists('new-city')).toBe(true);
    const written = readTempCityFile('new-city');
    expect(written.id).toBe('new-city');
  });

  it('기존 파일 덮어쓰기', async () => {
    createTempCityFile('existing', VALID_CITY_FIXTURE as any);

    const updated = { ...VALID_CITY_FIXTURE, id: 'existing', rent: { ...VALID_CITY_FIXTURE.rent, oneBed: 1000000 } };
    const source = { category: 'rent', name: 'Updated', url: 'https://updated.com' };
    await writeCity('existing', updated as any, source);

    const written = readTempCityFile('existing') as any;
    expect(written.rent.oneBed).toBe(1000000);
  });

  it('lastUpdated 자동 갱신', async () => {
    const source = { category: 'rent', name: 'Test', url: 'https://example.com' };
    await writeCity('auto-date', { ...VALID_CITY_FIXTURE, id: 'auto-date' } as any, source);

    const written = readTempCityFile('auto-date');
    // UTC 기준 — setSystemTime '2026-04-28T00:00:00+09:00' = UTC '2026-04-27T15:00:00Z'.
    expect(written.lastUpdated).toBe('2026-04-27');
  });

  it('sources[] 추가 (새 source)', async () => {
    const existingData = { ...VALID_CITY_FIXTURE, id: 'sources-test' };
    createTempCityFile('sources-test', existingData as any);

    const newSource = { category: 'food', name: 'New Food Source', url: 'https://food.com' };
    await writeCity('sources-test', existingData as any, newSource);

    const written = readTempCityFile('sources-test') as any;
    expect(written.sources).toHaveLength(2);
    expect(written.sources[1].name).toBe('New Food Source');
  });

  it('같은 source 있으면 accessedAt 만 갱신', async () => {
    const existingData = { ...VALID_CITY_FIXTURE, id: 'same-source' };
    createTempCityFile('same-source', existingData as any);

    const sameSource = { category: 'rent', name: 'Test Source', url: 'https://example.com' };
    await writeCity('same-source', existingData as any, sameSource);

    const written = readTempCityFile('same-source') as any;
    expect(written.sources).toHaveLength(1);
    expect(written.sources[0].accessedAt).toBe('2026-04-27');
  });

  it('sources 배열 — 한 호출로 여러 카테고리 누적 (vn_gso·ae_fcsc 패턴)', async () => {
    const existingData = { ...VALID_CITY_FIXTURE, id: 'multi-source' };
    createTempCityFile('multi-source', existingData as any);

    const sources = [
      { category: 'rent', name: 'Rent Src', url: 'https://rent.example.com' },
      { category: 'food', name: 'Food Src', url: 'https://food.example.com' },
      { category: 'transport', name: 'Transit Src', url: 'https://transit.example.com' },
    ];
    await writeCity('multi-source', existingData as any, sources);

    const written = readTempCityFile('multi-source') as any;
    // 기존 1개 + 새 3개 = 4개. 연쇄 writeCity 호출 시 발생하던 누락 버그 회귀 차단.
    expect(written.sources).toHaveLength(4);
    expect(written.sources.map((s: { name: string }) => s.name)).toEqual(
      expect.arrayContaining(['Test Source', 'Rent Src', 'Food Src', 'Transit Src']),
    );
  });

  it('스키마 위반 데이터: throws', async () => {
    const invalidData = { id: 'invalid' };
    const source = { category: 'rent', name: 'Test', url: 'https://example.com' };

    await expect(writeCity('invalid', invalidData as any, source)).rejects.toMatchObject({
      code: 'CITY_SCHEMA_INVALID',
    });
  });

  it('디렉터리 부재 시 자동 생성', async () => {
    const testDir = getTestDataDir();
    const subDir = path.join(testDir, 'subdir');
    process.env.DATA_DIR = subDir;

    const source = { category: 'rent', name: 'Test', url: 'https://example.com' };
    await writeCity('nested-city', { ...VALID_CITY_FIXTURE, id: 'nested-city' } as any, source);

    expect(fs.existsSync(path.join(subDir, 'nested-city.json'))).toBe(true);

    process.env.DATA_DIR = testDir;
  });
});

describe('fetchWithRetry', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it('첫 시도 성공: response 반환, 재시도 없음', async () => {
    const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const result = await fetchWithRetry('https://example.com');
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('method/headers/body 옵션을 fetch 로 forward (POST API 지원)', async () => {
    const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await fetchWithRetry('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 1 }),
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0]!;
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 1 }),
    });
    // signal 은 내부에서 합성되므로 truthy
    expect((init as RequestInit).signal).toBeDefined();
  });

  it('4xx 응답: 재시도 없이 즉시 throw', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('not found', { status: 404 }));

    await expect(fetchWithRetry('https://example.com')).rejects.toMatchObject({
      code: 'FETCH_RETRY_EXHAUSTED',
      message: expect.stringContaining('404'),
    });
  });

  it('maxRetries=0 이면 첫 시도만', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('Fails'));

    await expect(fetchWithRetry('https://example.com', { maxRetries: 0 })).rejects.toMatchObject({
      code: 'FETCH_RETRY_EXHAUSTED',
    });
  });

  // PR #20 review round 18 — 재시도/backoff 로직 회귀 테스트.
  it('5xx 응답 후 성공: 재시도 동작 (attempts 카운트)', async () => {
    let attempt = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      attempt += 1;
      if (attempt < 3) return new Response('temporary', { status: 503 });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const result = await fetchWithRetry('https://example.com', { maxRetries: 3 });
    expect(result.ok).toBe(true);
    expect(attempt).toBe(3);
  }, 30000);

  it('429 (Rate limit) 도 5xx 와 동일하게 재시도 (transient)', async () => {
    let attempt = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      attempt += 1;
      if (attempt < 2) return new Response('rate limited', { status: 429 });
      return new Response('ok', { status: 200 });
    });

    await fetchWithRetry('https://example.com', { maxRetries: 3 });
    expect(attempt).toBe(2);
  }, 30000);

  it('네트워크 에러 → 모든 시도 실패 시 maxRetries+1 회 호출', async () => {
    let attempt = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      attempt += 1;
      throw new Error('Network down');
    });

    await expect(
      fetchWithRetry('https://example.com', { maxRetries: 2 }),
    ).rejects.toMatchObject({ code: 'FETCH_RETRY_EXHAUSTED' });
    // maxRetries=2 → 3회 시도 (initial + 2 retries).
    expect(attempt).toBe(3);
  }, 30000);
});

describe('redactSecretsInUrl', () => {
  it('serviceKey 마스킹', () => {
    expect(redactSecretsInUrl('https://api.example.com/path?serviceKey=abc123&LAWD=11000')).toBe(
      'https://api.example.com/path?serviceKey=***REDACTED***&LAWD=11000'
    );
  });

  it('apiKey / apikey / api_key 모두 마스킹 (case insensitive)', () => {
    expect(redactSecretsInUrl('https://x.com/?apikey=AAA')).toContain('***REDACTED***');
    expect(redactSecretsInUrl('https://x.com/?api_Key=AAA')).toContain('***REDACTED***');
    expect(redactSecretsInUrl('https://x.com/?ApiKey=AAA')).toContain('***REDACTED***');
  });

  it('민감하지 않은 파라미터는 유지', () => {
    expect(redactSecretsInUrl('https://x.com/?LAWD_CD=11680&numOfRows=100')).toBe(
      'https://x.com/?LAWD_CD=11680&numOfRows=100'
    );
  });

  it('잘못된 URL 은 원본 반환', () => {
    expect(redactSecretsInUrl('not a url')).toBe('not a url');
  });
});

describe('redactSecretsInBody', () => {
  // PR #20 review round 18 — POST body 의 API 키 마스킹.
  it('registrationkey 마스킹 (us_bls 패턴)', () => {
    const body = JSON.stringify({ seriesid: ['APU0100709112'], registrationkey: 'secret-key-123', startyear: 2025 });
    expect(redactSecretsInBody(body)).toContain('"registrationkey":"***REDACTED***"');
    expect(redactSecretsInBody(body)).not.toContain('secret-key-123');
    expect(redactSecretsInBody(body)).toContain('"seriesid"');
  });

  it('apiKey / apikey / api_key 모두 마스킹 (case insensitive)', () => {
    expect(redactSecretsInBody('{"apikey":"AAA"}')).toContain('***REDACTED***');
    expect(redactSecretsInBody('{"api_Key":"AAA"}')).toContain('***REDACTED***');
    expect(redactSecretsInBody('{"ApiKey":"AAA"}')).toContain('***REDACTED***');
  });

  it('appId / token / serviceKey 마스킹 (다른 fetcher 패턴)', () => {
    expect(redactSecretsInBody('{"appId":"X"}')).toContain('***REDACTED***');
    expect(redactSecretsInBody('{"token":"Y"}')).toContain('***REDACTED***');
    expect(redactSecretsInBody('{"serviceKey":"Z"}')).toContain('***REDACTED***');
  });

  it('민감하지 않은 키는 유지', () => {
    const body = '{"seriesid":["A","B"],"startyear":2025,"endyear":2026}';
    expect(redactSecretsInBody(body)).toBe(body);
  });
});

describe('createCitySeed', () => {
  it('config 의 메타 + 0/null 초기 값 반환', () => {
    const seed = createCitySeed({
      id: 'seoul',
      name: { ko: '서울', en: 'Seoul' },
      country: 'KR',
      currency: 'KRW',
      region: 'asia',
    });
    expect(seed.id).toBe('seoul');
    expect(seed.region).toBe('asia');
    expect(seed.rent.share).toBeNull();
    expect(seed.food.restaurantMeal).toBe(0);
    expect(seed.transport.monthlyPass).toBe(0);
    expect(seed.sources).toEqual([]);
  });
});
