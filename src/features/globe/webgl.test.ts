import { describe, expect, it, vi } from 'vitest';
import { supportsWebGL2 } from './webgl';

describe('WebGL2 capability detection', () => {
  it('releases the temporary probe context', () => {
    const loseContext = vi.fn();
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        getExtension: () => ({ loseContext }),
      } as unknown as WebGL2RenderingContext);

    expect(supportsWebGL2()).toBe(true);
    expect(loseContext).toHaveBeenCalledOnce();
    getContext.mockRestore();
  });
});
