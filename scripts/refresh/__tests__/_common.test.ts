/**
 * _common.mjs 테스트.
 * TESTING.md §9-A.1 공통 헬퍼 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
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
    expect(written.lastUpdated).toBe('2026-04-28');
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
    expect(written.sources[0].accessedAt).toBe('2026-04-28');
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
});
