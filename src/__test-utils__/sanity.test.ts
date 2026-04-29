import { colors, HOT_MULTIPLIER_THRESHOLD } from '@/theme/tokens';

describe('bootstrap sanity', () => {
  it('colors.orange === #FC6011', () => {
    expect(colors.orange).toBe('#FC6011');
  });

  it('HOT_MULTIPLIER_THRESHOLD === 2.0', () => {
    expect(HOT_MULTIPLIER_THRESHOLD).toBe(2.0);
  });
});
