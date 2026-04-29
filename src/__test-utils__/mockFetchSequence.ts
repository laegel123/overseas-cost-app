/**
 * 테스트용 fetch 시퀀스 모킹 헬퍼 (TESTING.md §8.4).
 *
 * 호출 순서대로 응답을 큐잉. 각 호출은 한 번만 사용된다.
 * - { ok: true, status, body }: 정상 응답. body 가 객체면 JSON 직렬화 / 문자열은 그대로.
 * - { ok: false, status }: HTTP 에러 (status 만)
 * - { error: 'timeout' }: AbortError 시뮬레이션
 * - { error: 'network' }: TypeError 시뮬레이션 (네트워크 실패)
 *
 * 사용:
 *   const spy = mockFetchSequence([
 *     { ok: true, status: 200, body: { result: 'success', rates: { KRW: 1380 } } },
 *     { error: 'timeout' },
 *   ]);
 */

export type FetchResponseSpec =
  | { ok: true; status: number; body: object | string }
  | { ok: false; status: number; body?: object | string }
  | { error: 'timeout' | 'network' };

export function mockFetchSequence(responses: FetchResponseSpec[]): jest.SpyInstance {
  const spy = jest.spyOn(globalThis, 'fetch') as jest.SpyInstance;
  for (const r of responses) {
    spy.mockImplementationOnce(async () => {
      if ('error' in r) {
        if (r.error === 'timeout') {
          const err = new Error('aborted');
          err.name = 'AbortError';
          throw err;
        }
        throw new TypeError('Network request failed');
      }
      const text = typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? '');
      return {
        ok: r.ok,
        status: r.status,
        json: async () => JSON.parse(text) as unknown,
        text: async () => text,
      } as unknown as Response;
    });
  }
  return spy;
}
