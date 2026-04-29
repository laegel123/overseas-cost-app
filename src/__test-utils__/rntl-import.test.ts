import { render } from '@testing-library/react-native';

describe('RNTL bootstrap', () => {
  it('render function is importable', () => {
    expect(typeof render).toBe('function');
  });
});
