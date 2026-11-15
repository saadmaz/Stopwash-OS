import { enqueue, flushOutbox, resetOutboxForTests } from './outbox';
import { renderHook } from '@testing-library/react';
import { useOutbox } from './outbox';

const ok = () => new Response('{"id":"o1"}', { status: 201 });

beforeEach(() => resetOutboxForTests());
afterEach(() => vi.restoreAllMocks());

describe('offline outbox', () => {
  it('replays with the original idempotency key and empties on success', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok());
    await enqueue({ key: 'k-1', path: '/orders', body: { plate: 'CAB-1' }, label: 'CAB-1' });
    expect(await flushOutbox()).toBe(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['idempotency-key']).toBe('k-1');
    const { result } = renderHook(() => useOutbox());
    expect(result.current).toHaveLength(0);
  });

  it('stops at a network failure and keeps order', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    await enqueue({ key: 'a', path: '/orders', body: {}, label: 'A' });
    await enqueue({ key: 'b', path: '/orders', body: {}, label: 'B' });
    expect(await flushOutbox()).toBe(0);
    const { result } = renderHook(() => useOutbox());
    expect(result.current.map((i) => i.key)).toEqual(['a', 'b']);
  });

  it('marks server rejections instead of retrying them forever', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response('{"error":{"code":"NO_OPEN_SHIFT","message":"x"}}', { status: 409 }),
      )
      .mockResolvedValueOnce(ok());
    await enqueue({ key: 'a', path: '/orders', body: {}, label: 'A' });
    await enqueue({ key: 'b', path: '/orders', body: {}, label: 'B' });
    expect(await flushOutbox()).toBe(1);
    const { result } = renderHook(() => useOutbox());
    expect(result.current).toEqual([expect.objectContaining({ key: 'a', error: 'NO_OPEN_SHIFT' })]);
  });
});
