import { formatMs } from './format-ms';

describe('formatMs', () => {
  it.each([
    [0, '0.0 ms'],
    [3.449, '3.4 ms'],
    [9.96, '10.0 ms'],
    [10, '10 ms'],
    [42.4, '42 ms'],
    [42.5, '43 ms'],
    [1234.6, '1235 ms'],
  ])('%s is shown as "%s"', (ms, text) => {
    expect(formatMs(ms)).toBe(text);
  });
});
