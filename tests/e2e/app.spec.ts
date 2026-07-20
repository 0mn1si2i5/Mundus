import { expect, test } from '@playwright/test';

test('reports and clears WebGL context interruption', async ({ page }) => {
  await page.goto('./?benchmark=1&benchmarkWarmup=100&benchmarkDuration=300');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const benchmark = page.locator('output[data-phase="complete"]');
  await expect(benchmark).toContainText('fps');
  await expect(benchmark).toContainText('p95');
  const canLoseContext = await canvas.evaluate((element) => {
    const context = (element as HTMLCanvasElement).getContext('webgl2');
    const extension = context?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext();
    window.setTimeout(() => extension.restoreContext(), 500);
    return true;
  });
  test.skip(!canLoseContext, 'WEBGL_lose_context is unavailable');
  const contextStatus = page.getByText(
    '图形上下文暂时中断，正在等待浏览器恢复。',
  );
  await expect(contextStatus).toBeVisible();
  await expect(contextStatus).toBeHidden();
});

test('keeps country semantics when WebGL2 is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (contextId, ...options) {
      if (contextId === 'webgl2') return null;
      return Reflect.apply(original, this, [contextId, ...options]);
    } as typeof original;
  });
  await page.goto('./?point=31.2304%2C121.4737&v=1');
  await expect(page.getByText(/无法启用 WebGL2/)).toBeVisible();
  await expect(page.getByText('China', { exact: true })).toBeVisible();
});

test('loads the laboratory shell and switches language', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '地球另一端' })).toBeVisible();
  await page.getByRole('button', { name: '切换为英文' }).click();
  await expect(page.getByRole('heading', { name: 'Other Side' })).toBeVisible();
});

test('dismisses the first-interaction hint after real globe use', async ({
  page,
}) => {
  await page.goto('./');
  const hint = page.getByTestId('first-interaction-hint');
  await expect(hint).toBeVisible();
  expect(
    overlaps(
      await hint.boundingBox(),
      await page.locator('section[data-mode]').boundingBox(),
    ),
  ).toBe(false);
  expect(
    overlaps(
      await hint.boundingBox(),
      await page.locator('[data-mode-panel="place-controls"]').boundingBox(),
    ),
  ).toBe(false);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Globe canvas has no bounding box.');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y + 8, { steps: 5 });
  await page.mouse.up();

  await expect(hint).toBeHidden();
  await page.reload();
  await expect(hint).toBeHidden();
});

test('keeps the hint for incidental pointing and accepts wheel use', async ({
  page,
}) => {
  await page.goto('./');
  const hint = page.getByTestId('first-interaction-hint');
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Globe canvas has no bounding box.');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 2, y + 2);
  await page.mouse.up();
  await expect(hint).toBeVisible();

  await page.mouse.wheel(0, 120);
  await expect(hint).toBeHidden();
});

test('opens the mode atlas and restores keyboard focus', async ({ page }) => {
  await page.goto('./?point=30.25%2C120.75&v=1');
  const opener = page.getByRole('button', { name: '模式图鉴' });
  expect((await opener.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await opener.focus();
  await opener.click();

  const atlas = page.getByRole('dialog', { name: '三种观察地球的方式' });
  await expect(atlas).toBeVisible();
  await expect(atlas.getByRole('heading', { level: 3 })).toHaveCount(3);
  await expect(page.locator('#root')).toHaveAttribute('inert', '');
  await expect(
    atlas.getByRole('button', { name: '关闭模式图鉴' }),
  ).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(
    atlas.getByRole('button', { name: '用这种方式观察' }).last(),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(atlas).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page).toHaveURL(/point=30.25%2C120.75/);
});

test('selects a mode from the atlas without moving the selected place', async ({
  page,
}) => {
  await page.goto('./?point=30.25%2C120.75&v=1');
  await page.getByRole('button', { name: '模式图鉴' }).click();
  const developmentEntry = page
    .getByRole('listitem')
    .filter({ hasText: '发展的不同侧面' });
  await developmentEntry
    .getByRole('button', { name: '用这种方式观察' })
    .click();

  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(
    page.getByRole('heading', { name: '发展的不同侧面' }),
  ).toBeFocused();
  await expect(page).toHaveURL(/mode=development/);
  await expect(page).toHaveURL(/point=30.25%2C120.75/);

  await page.goBack();
  await expect(page.getByRole('heading', { name: '地球另一端' })).toBeVisible();
  await expect(page).toHaveURL(/point=30.25%2C120.75/);

  await page.goForward();
  await expect(
    page.getByRole('heading', { name: '发展的不同侧面' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/mode=development/);
  await expect(page).toHaveURL(/point=30.25%2C120.75/);
});

test('keeps the English mode atlas usable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('./');
  await page.getByRole('button', { name: '切换为英文' }).click();

  const opener = page.getByRole('button', { name: 'Mode atlas' });
  expect((await opener.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  await opener.click();
  const atlas = page.getByRole('dialog', {
    name: 'Three ways of seeing Earth',
  });
  await expect(atlas).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  const buttons = atlas.getByRole('button');
  for (let index = 0; index < (await buttons.count()); index += 1) {
    expect(
      (await buttons.nth(index).boundingBox())?.height,
    ).toBeGreaterThanOrEqual(44);
  }
});

test('keeps compact result, collapsed controls, and mode navigation separate', async ({
  page,
}) => {
  const compactViewports = [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 760, height: 844 },
  ];
  await page.setViewportSize(compactViewports[0]);
  await page.goto('./');

  const stage = page.getByTestId('app-stage');
  const result = page.getByRole('complementary', { name: '结果' });
  const panel = page.locator('[data-mode-panel="place-controls"]');
  const navigation = page.getByRole('navigation', { name: '观察模式' });
  await expect(stage).toBeVisible();
  await expect(result).toBeVisible();
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-expanded', 'false');
  await expect(navigation).toBeVisible();

  for (const viewport of compactViewports) {
    await page.setViewportSize(viewport);
    const rectangles = await Promise.all(
      [stage, result, panel, navigation].map((surface) =>
        surface.boundingBox(),
      ),
    );
    for (const rectangle of rectangles) {
      expect(rectangle).not.toBeNull();
      expect(rectangle!.x).toBeGreaterThanOrEqual(0);
      expect(rectangle!.y).toBeGreaterThanOrEqual(0);
      expect(rectangle!.x + rectangle!.width).toBeLessThanOrEqual(
        viewport.width,
      );
      expect(rectangle!.y + rectangle!.height).toBeLessThanOrEqual(
        viewport.height,
      );
    }
    for (let second = 1; second < rectangles.length; second += 1) {
      expect(overlaps(rectangles[0], rectangles[second])).toBe(false);
    }
    for (let first = 1; first < rectangles.length; first += 1) {
      for (let second = first + 1; second < rectangles.length; second += 1) {
        expect(overlaps(rectangles[first], rectangles[second])).toBe(false);
      }
    }
    expect(
      rectangles[2]!.y - (rectangles[1]!.y + rectangles[1]!.height),
    ).toBeLessThanOrEqual(16);
  }

  await page.setViewportSize({ width: 761, height: 844 });
  const title = page.getByRole('heading', { name: '地球另一端' });
  await expect(title).toBeVisible();
  await expect(result).toHaveCSS('position', 'absolute');
  await expect(panel).toHaveCSS('position', 'absolute');
  await expect(navigation).toHaveCSS('position', 'absolute');
  const desktopRectangles = await Promise.all(
    [title, result, panel, navigation].map((surface) => surface.boundingBox()),
  );
  const desktopSurfaceNames = ['title', 'result', 'controls', 'navigation'];
  for (const rectangle of desktopRectangles) {
    expect(rectangle).not.toBeNull();
    expect(rectangle!.x).toBeGreaterThanOrEqual(0);
    expect(rectangle!.y).toBeGreaterThanOrEqual(0);
    expect(rectangle!.x + rectangle!.width).toBeLessThanOrEqual(761);
    expect(rectangle!.y + rectangle!.height).toBeLessThanOrEqual(844);
  }
  for (let first = 1; first < desktopRectangles.length; first += 1) {
    for (
      let second = first + 1;
      second < desktopRectangles.length;
      second += 1
    ) {
      expect(
        overlaps(desktopRectangles[first], desktopRectangles[second]),
        `${desktopSurfaceNames[first]} overlaps ${desktopSurfaceNames[second]}`,
      ).toBe(false);
    }
  }
  for (let second = 1; second < desktopRectangles.length; second += 1) {
    expect(
      overlaps(desktopRectangles[0], desktopRectangles[second]),
      `title overlaps ${desktopSurfaceNames[second]}`,
    ).toBe(false);
  }
});

test('protects landscape desktop poster edges with safe-area-aware base rules', async ({
  page,
}) => {
  const viewport = { width: 844, height: 390 };
  await page.setViewportSize(viewport);
  await page.goto('./');

  const baseRules = await page.evaluate(() => {
    function collectRules(rules: CSSRuleList): {
      cssText: string;
      selector: string;
    }[] {
      return Array.from(rules).flatMap((rule) => {
        if (rule instanceof CSSStyleRule) {
          return [{ cssText: rule.style.cssText, selector: rule.selectorText }];
        }
        return 'cssRules' in rule
          ? collectRules((rule as CSSGroupingRule).cssRules)
          : [];
      });
    }

    return Array.from(document.styleSheets).flatMap((styleSheet) =>
      collectRules(styleSheet.cssRules),
    );
  });
  const headerRule = baseRules.find(({ selector }) =>
    /^\._header_[\w-]+$/u.test(selector),
  );
  const navigationRule = baseRules.find(({ selector }) =>
    /^\._modeNav_[\w-]+$/u.test(selector),
  );
  const introRule = baseRules.find(({ selector }) =>
    /^\._intro_[\w-]+$/u.test(selector),
  );
  const panelRule = baseRules.find(({ selector }) =>
    /^\._panel_[\w-]+$/u.test(selector),
  );
  const resultRule = baseRules.find(({ selector }) =>
    /^\._result_[\w-]+$/u.test(selector),
  );
  const recoverableModeRule = baseRules.find(({ selector }) =>
    /^\._recoverableMode_[\w-]+$/u.test(selector),
  );
  const shortDevelopmentIntroRule = baseRules.find(
    ({ cssText, selector }) =>
      /^\._intro_[\w-]+\[data-mode=['"]development['"]\]$/u.test(selector) &&
      cssText.includes('right:'),
  );
  expect(headerRule?.cssText).toMatch(/safe-area-inset-(top|left|right)/);
  expect(navigationRule?.cssText).toMatch(
    /safe-area-inset-(bottom|left|right)/,
  );
  expect(introRule?.cssText).toContain('safe-area-inset-left');
  expect(panelRule?.cssText).toContain('safe-area-inset-left');
  expect(panelRule?.cssText).toContain('safe-area-inset-right');
  expect(resultRule?.cssText).toContain('safe-area-inset-right');
  expect(recoverableModeRule?.cssText).toContain('safe-area-inset-left');
  expect(shortDevelopmentIntroRule?.cssText).toContain('safe-area-inset-right');

  const title = page.getByRole('heading', { name: '地球另一端' });
  const result = page.getByRole('complementary', { name: '结果' });
  const panel = page.locator('[data-mode-panel="place-controls"]');
  const navigation = page.getByRole('navigation', { name: '观察模式' });
  const surfaces = [title, result, panel, navigation];
  const surfaceNames = ['title', 'result', 'controls', 'navigation'];
  await Promise.all(surfaces.map((surface) => expect(surface).toBeVisible()));
  const rectangles = await Promise.all(
    surfaces.map((surface) => surface.boundingBox()),
  );
  for (const [index, rectangle] of rectangles.entries()) {
    expect(rectangle).not.toBeNull();
    expect(
      rectangle!.x,
      `${surfaceNames[index]} left edge`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      rectangle!.y,
      `${surfaceNames[index]} top edge`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      rectangle!.x + rectangle!.width,
      `${surfaceNames[index]} right edge`,
    ).toBeLessThanOrEqual(viewport.width);
    expect(
      rectangle!.y + rectangle!.height,
      `${surfaceNames[index]} bottom edge`,
    ).toBeLessThanOrEqual(viewport.height);
  }
  for (let first = 0; first < rectangles.length; first += 1) {
    for (let second = first + 1; second < rectangles.length; second += 1) {
      expect(
        overlaps(rectangles[first], rectangles[second]),
        `${surfaceNames[first]} overlaps ${surfaceNames[second]}`,
      ).toBe(false);
    }
  }

  await page.goto('./?mode=development&indicator=hdi&year=2023&v=1');
  const developmentTitle = page.getByRole('heading', {
    name: '发展的不同侧面',
  });
  const developmentPanel = page.locator(
    '[data-mode-panel="development-controls"]',
  );
  const developmentNavigation = page.getByRole('navigation', {
    name: '观察模式',
  });
  const developmentSurfaces = [
    developmentTitle,
    developmentPanel,
    developmentNavigation,
  ];
  const developmentSurfaceNames = ['title', 'controls', 'navigation'];
  await Promise.all(
    developmentSurfaces.map((surface) => expect(surface).toBeVisible()),
  );
  const developmentRectangles = await Promise.all(
    developmentSurfaces.map((surface) => surface.boundingBox()),
  );
  for (const [index, rectangle] of developmentRectangles.entries()) {
    expect(rectangle).not.toBeNull();
    expect(
      rectangle!.x,
      `Development ${developmentSurfaceNames[index]} left edge`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      rectangle!.y,
      `Development ${developmentSurfaceNames[index]} top edge`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      rectangle!.x + rectangle!.width,
      `Development ${developmentSurfaceNames[index]} right edge`,
    ).toBeLessThanOrEqual(viewport.width);
    expect(
      rectangle!.y + rectangle!.height,
      `Development ${developmentSurfaceNames[index]} bottom edge`,
    ).toBeLessThanOrEqual(viewport.height);
  }
  for (let first = 0; first < developmentRectangles.length; first += 1) {
    for (
      let second = first + 1;
      second < developmentRectangles.length;
      second += 1
    ) {
      expect(
        overlaps(developmentRectangles[first], developmentRectangles[second]),
        `Development ${developmentSurfaceNames[first]} overlaps ${developmentSurfaceNames[second]}`,
      ).toBe(false);
    }
  }
});

test('contains expanded desktop modes by height without changing the normal poster', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const scenarios = [
    {
      name: 'Other Side',
      path: './',
      title: '地球另一端',
      panel: 'place-controls',
      result: '结果',
      ready: 'Santa Fe, Argentina',
    },
    {
      name: 'Development',
      path: './?mode=development&indicator=hdi&year=2023&v=1',
      title: '发展的不同侧面',
      panel: 'development-controls',
      result: null,
      ready: '全球中位数',
    },
    {
      name: 'Sunline',
      path: './?mode=sunline&v=1',
      title: '日照线',
      panel: 'sunline-controls',
      result: '太阳位置结果',
      ready: '太阳高度',
    },
  ];

  for (const viewport of [
    { width: 1024, height: 520 },
    { width: 1024, height: 568 },
  ]) {
    for (const scenario of scenarios) {
      await page.setViewportSize(viewport);
      await page.goto(scenario.path);
      await expect(
        page.getByText(scenario.ready, { exact: true }),
      ).toBeVisible();

      const title = page.getByRole('heading', { name: scenario.title });
      const panel = page.locator(`[data-mode-panel="${scenario.panel}"]`);
      const navigation = page.getByRole('navigation', { name: '观察模式' });
      const result = scenario.result
        ? page.getByRole('complementary', { name: scenario.result })
        : null;
      const surfaces = result
        ? [title, result, panel, navigation]
        : [title, panel, navigation];
      const surfaceNames = result
        ? ['title', 'result', 'controls', 'navigation']
        : ['title', 'controls', 'navigation'];
      await Promise.all(
        surfaces.map((surface) => expect(surface).toBeVisible()),
      );
      const rectangles = await Promise.all(
        surfaces.map((surface) => surface.boundingBox()),
      );
      for (const [index, rectangle] of rectangles.entries()) {
        expect(rectangle).not.toBeNull();
        expect(
          rectangle!.x,
          `${scenario.name} ${surfaceNames[index]} left edge at ${viewport.height}px`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          rectangle!.y,
          `${scenario.name} ${surfaceNames[index]} top edge at ${viewport.height}px`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          rectangle!.x + rectangle!.width,
          `${scenario.name} ${surfaceNames[index]} right edge at ${viewport.height}px`,
        ).toBeLessThanOrEqual(viewport.width);
        expect(
          rectangle!.y + rectangle!.height,
          `${scenario.name} ${surfaceNames[index]} bottom edge at ${viewport.height}px`,
        ).toBeLessThanOrEqual(viewport.height);
      }
      for (let first = 0; first < rectangles.length; first += 1) {
        for (let second = first + 1; second < rectangles.length; second += 1) {
          expect(
            overlaps(rectangles[first], rectangles[second]),
            `${scenario.name} ${surfaceNames[first]} overlaps ${surfaceNames[second]} at ${viewport.height}px`,
          ).toBe(false);
        }
      }
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  const normalPanel = page.locator('[data-mode-panel="place-controls"]');
  const normalResult = page.getByRole('complementary', { name: '结果' });
  await expect(normalPanel).toHaveCSS('max-height', 'none');
  await expect(normalResult).toHaveCSS('grid-template-columns', '240px');
});

test('keeps every expanded compact drawer and navigation reachable', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const viewportMeta = page.locator('meta[name="viewport"]');
  const scenarios = [
    {
      path: './',
      panel: 'place-controls',
      expand: '展开地点控件',
      primary: () => page.getByLabel('搜索本地城市'),
      result: () => page.getByRole('complementary', { name: '结果' }),
      ready: () => page.getByText('Santa Fe, Argentina'),
    },
    {
      path: './?mode=development&indicator=hdi&year=2023&v=1',
      panel: 'development-controls',
      expand: '展开发展控件',
      primary: () => page.getByRole('slider', { name: /年份/ }),
      result: () => null,
      ready: () => page.getByText('全球中位数', { exact: true }),
    },
    {
      path: './?mode=sunline&v=1',
      panel: 'sunline-controls',
      expand: '展开日照线控件',
      primary: () => page.getByRole('slider', { name: /UTC 时间/ }),
      result: () => page.getByRole('complementary', { name: '太阳位置结果' }),
      ready: () => page.getByText('太阳高度', { exact: true }),
    },
  ];

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('./');
  await expect(viewportMeta).toHaveAttribute('content', /viewport-fit=cover/);

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 760, height: 568 },
  ]) {
    for (const scenario of scenarios) {
      await page.setViewportSize(viewport);
      await page.goto(scenario.path);
      await page.getByRole('button', { name: scenario.expand }).click();
      await expect(scenario.ready()).toBeVisible();

      const panel = page.locator(`[data-mode-panel="${scenario.panel}"]`);
      const panelBody = panel.locator(':scope > div').nth(1);
      const stage = page.getByTestId('app-stage');
      const navigation = page.getByRole('navigation', { name: '观察模式' });
      const result = scenario.result();
      await expect(panel).toHaveAttribute('data-expanded', 'true');
      await expect(panel).toBeVisible();
      await expect(panelBody).toHaveCSS('overflow-y', 'auto');
      await expect(navigation).toBeVisible();

      const stageRectangle = await stage.boundingBox();
      expect(stageRectangle).not.toBeNull();
      expect(stageRectangle!.height).toBeGreaterThanOrEqual(64);

      const surfaces = result
        ? [result, panel, navigation]
        : [panel, navigation];
      const rectangles = await Promise.all(
        surfaces.map((surface) => surface.boundingBox()),
      );
      for (const rectangle of rectangles) {
        expect(rectangle).not.toBeNull();
        expect(rectangle!.x).toBeGreaterThanOrEqual(0);
        expect(rectangle!.y).toBeGreaterThanOrEqual(0);
        expect(rectangle!.x + rectangle!.width).toBeLessThanOrEqual(
          viewport.width,
        );
        expect(rectangle!.y + rectangle!.height).toBeLessThanOrEqual(
          viewport.height,
        );
      }
      for (let first = 0; first < rectangles.length; first += 1) {
        for (let second = first + 1; second < rectangles.length; second += 1) {
          expect(overlaps(rectangles[first], rectangles[second])).toBe(false);
        }
      }

      const primary = scenario.primary();
      await primary.scrollIntoViewIfNeeded();
      await expect(primary).toBeVisible();
      const primaryRectangle = await primary.boundingBox();
      const panelRectangle = await panel.boundingBox();
      expect(primaryRectangle).not.toBeNull();
      expect(panelRectangle).not.toBeNull();
      expect(primaryRectangle!.y).toBeGreaterThanOrEqual(panelRectangle!.y);
      expect(
        primaryRectangle!.y + primaryRectangle!.height,
      ).toBeLessThanOrEqual(panelRectangle!.y + panelRectangle!.height);
    }
  }
});

test('allows the English display title to wrap within 320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('./?mode=development&indicator=hdi&year=2023&v=1');
  await page.getByRole('button', { name: '切换为英文' }).click();

  const title = page.getByRole('heading', {
    name: 'Development, Unpacked',
  });
  const layout = await title.evaluate((element) => {
    const text = element.textContent ?? '';
    const textNode = element.firstChild;
    if (!(textNode instanceof Text)) {
      throw new Error('English title must render as plain text.');
    }

    const characterRects = Array.from(text).flatMap((character, index) => {
      if (/\s/u.test(character)) return [];
      const range = document.createRange();
      range.setStart(textNode, index);
      range.setEnd(textNode, index + 1);
      const rect = range.getBoundingClientRect();
      return [{ right: rect.right, top: Math.round(rect.top) }];
    });

    return {
      lineCount: new Set(characterRects.map(({ top }) => top)).size,
      maxRight: Math.max(...characterRects.map(({ right }) => right)),
      viewportWidth: document.documentElement.clientWidth,
      whiteSpace: getComputedStyle(element).whiteSpace,
    };
  });

  expect(layout.whiteSpace).toBe('normal');
  expect(layout.lineCount).toBeGreaterThan(1);
  expect(layout.maxRight).toBeLessThanOrEqual(layout.viewportWidth);
});

test('keeps Chinese display-title phrase units intact at 320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('./?mode=development&indicator=hdi&year=2023&v=1');

  const title = page.getByRole('heading', { name: '发展的不同侧面' });
  const phrases = title.locator('[data-title-phrase]');
  await expect(phrases).toHaveCount(2);

  const layout = await title.evaluate((element) => {
    const titleRect = element.getBoundingClientRect();
    const hanCharacters = Array.from(element.textContent ?? '').filter(
      (value) => /\p{Script=Han}/u.test(value),
    );
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
    const characterRects = textNodes.flatMap((textNode) =>
      Array.from(textNode.data).flatMap((character, index) => {
        if (!/\p{Script=Han}/u.test(character)) return [];
        const range = document.createRange();
        range.setStart(textNode, index);
        range.setEnd(textNode, index + 1);
        const rect = range.getBoundingClientRect();
        return [{ character, top: Math.round(rect.top) }];
      }),
    );
    const visualLines = new Map<number, typeof characterRects>();
    for (const characterRect of characterRects) {
      const line = visualLines.get(characterRect.top) ?? [];
      line.push(characterRect);
      visualLines.set(characterRect.top, line);
    }
    const units = Array.from(
      element.querySelectorAll<HTMLElement>('[data-title-phrase]'),
    ).map((unit) => ({
      text: unit.textContent ?? '',
      rectCount: unit.getClientRects().length,
      right: unit.getBoundingClientRect().right,
      whiteSpace: getComputedStyle(unit).whiteSpace,
    }));

    return {
      titleRight: titleRect.right,
      viewportWidth: document.documentElement.clientWidth,
      textWrap: getComputedStyle(element).textWrap,
      hanCharacters,
      visualLineLengths: Array.from(
        visualLines.values(),
        (line) => line.length,
      ),
      units,
    };
  });

  expect(layout.textWrap).toBe('balance');
  expect(layout.titleRight).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.units.map(({ text }) => text).join('')).toBe('发展的不同侧面');
  expect(layout.units.every(({ rectCount }) => rectCount === 1)).toBe(true);
  expect(layout.units.every(({ right }) => right <= layout.viewportWidth)).toBe(
    true,
  );
  expect(layout.units.every(({ whiteSpace }) => whiteSpace === 'nowrap')).toBe(
    true,
  );
  expect(layout.hanCharacters).toHaveLength(7);
  expect(layout.visualLineLengths.length).toBeGreaterThan(1);
  expect(layout.visualLineLengths.every((length) => length > 1)).toBe(true);
});

test('matches the document language to an English browser', async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle(/Interactive terrestrial laboratory/);
  await context.close();
});

test('keeps all observation modes keyboard accessible', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /发展的不同侧面/ }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: '发展的不同侧面' }),
  ).toBeVisible();
});

test('rotates and selects the globe from the keyboard', async ({ page }) => {
  await page.goto('./');
  const globe = page.getByRole('region', { name: '交互式三维地球' });
  await globe.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('=');
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/point=31.2304%2C121.4737/);
  await expect(globe).toBeFocused();
});

test('does not turn a globe drag into a point selection', async ({ page }) => {
  await page.goto('./?mode=sunline&v=1');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Globe canvas has no bounding box.');

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const urlBeforeDrag = page.url();
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 70, startY + 12, { steps: 6 });
  await page.mouse.up();

  await expect(page).toHaveURL(urlBeforeDrag);
});

test('restores shareable state and browser history', async ({ page }) => {
  await page.goto('./?mode=sunline&point=0%2C-140&v=1');
  await expect(page.getByRole('heading', { name: '日照线' })).toBeVisible();
  await expect(page).toHaveURL(/point=0%2C-140/);

  await page.getByRole('button', { name: /发展的不同侧面/ }).click();
  await expect(page).toHaveURL(/mode=development/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: '日照线' })).toBeVisible();
});

test('replaces continuous timeline changes instead of flooding history', async ({
  page,
}, testInfo) => {
  await page.goto('./?mode=development&indicator=education&year=2005&v=1');
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '展开发展控件' }).click();
  }

  await page.getByRole('button', { name: '收入' }).click();
  await page.getByRole('slider', { name: /年份/ }).fill('2010');
  await page.getByRole('slider', { name: /年份/ }).fill('2011');
  await page.goBack();

  await expect(page).toHaveURL(/indicator=education/);
  await expect(page).toHaveURL(/year=2005/);
});

test('selects a local city and validates coordinate input', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '展开地点控件' }).click();
  }
  await page.getByLabel('搜索本地城市').fill('Tokyo');
  await page.getByRole('button', { name: /东京/ }).click();
  await expect(page.getByText('Japan', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/point=35.6762%2C139.6503/);

  if (testInfo.project.name === 'mobile') {
    const expand = page.getByRole('button', { name: '展开地点控件' });
    await expect(expand).toBeFocused();
    await expand.click();
  }
  await page.getByLabel('纬度').fill('91');
  await page.getByLabel('经度').fill('0');
  await page.getByRole('button', { name: '前往' }).click();
  await expect(page.getByRole('alert')).toContainText('纬度需在');

  await page.getByLabel('纬度').fill('');
  await page.getByLabel('经度').fill('');
  await page.getByRole('button', { name: '前往' }).click();
  await expect(page.getByRole('alert')).toContainText('纬度需在');
});

test('keeps controls reachable after crossing the mobile breakpoint', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?mode=sunline&v=1');
  await expect(
    page.getByRole('button', { name: '展开日照线控件' }),
  ).toBeVisible();

  await page.setViewportSize({ width: 915, height: 412 });
  await expect(page.getByLabel('UTC 日期')).toBeVisible();
  await expect(page.getByRole('slider', { name: /UTC 时间/ })).toBeVisible();

  await page.getByRole('button', { name: '模式图鉴' }).click();
  const developmentEntry = page
    .getByRole('listitem')
    .filter({ hasText: '发展的不同侧面' });
  await developmentEntry
    .getByRole('button', { name: '用这种方式观察' })
    .click();
  await expect(
    page.getByRole('heading', { name: '发展的不同侧面' }),
  ).toBeFocused();
  await expect(
    page.locator('[data-mode-panel="development-controls"]'),
  ).toBeVisible();
});

test('keeps the Development title visible on a short desktop stage', async ({
  page,
}) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto('./?mode=development&indicator=hdi&year=2023&v=1');

  const intro = page.locator('section[data-mode="development"]');
  const panel = page.locator('[data-mode-panel="development-controls"]');
  const navigation = page.getByRole('navigation', { name: '观察模式' });
  const title = page.getByRole('heading', { name: '发展的不同侧面' });
  await expect(title).toBeVisible();
  const introLayout = await intro.evaluate((element) => ({
    clipPath: getComputedStyle(element).clipPath,
    height: element.getBoundingClientRect().height,
    width: element.getBoundingClientRect().width,
  }));
  expect(introLayout.clipPath).toBe('none');
  expect(introLayout.width).toBeGreaterThan(200);
  expect(introLayout.height).toBeGreaterThan(50);
  expect(overlaps(await title.boundingBox(), await panel.boundingBox())).toBe(
    false,
  );
  expect(
    overlaps(await title.boundingBox(), await navigation.boundingBox()),
  ).toBe(false);
});

test('loads the scoped Natural Earth nearest-place result', async ({
  page,
}) => {
  await page.goto('./?mode=sunline&v=1');
  await expect(page.getByText('数据中最近的聚居点')).toBeHidden();

  await page.getByRole('button', { name: /地球另一端/ }).click();
  await expect(page.getByText('Santa Fe, Argentina')).toBeVisible();
  await expect(
    page.getByText('Natural Earth 50m 选点，非完整城市名录', { exact: true }),
  ).toBeVisible();
});

test('shows the Other Side method and Natural Earth attribution', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '展开地点控件' }).click();
  }
  await page.getByText('数据与方法', { exact: true }).click();
  const panel = page.locator('[data-mode-panel="place-controls"]');
  await expect(panel).toContainText('Natural Earth 110m');
  await expect(panel).toContainText('Natural Earth 50m');
  await expect(panel).toContainText('Made with Natural Earth · 公共领域数据');
  await expect(
    panel.getByRole('link', { name: /Natural Earth 来源/ }),
  ).toHaveAttribute('href', 'https://www.naturalearthdata.com/');
});

test('keeps development map, controls, URL and table synchronized', async ({
  page,
}, testInfo) => {
  await page.goto('./?mode=development&indicator=education&year=2005&v=1');
  await expect(
    page.getByRole('heading', { name: '发展的不同侧面' }),
  ).toBeVisible();

  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '展开发展控件' }).click();
  }
  const panel = page.locator('[data-mode-panel="development-controls"]');

  await expect(panel.getByRole('button', { name: '教育' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(panel.getByRole('slider', { name: /年份/ })).toHaveValue('2005');
  await expect(panel.getByText('0.540', { exact: true }).first()).toBeVisible();
  await expect(panel.getByText('0.607', { exact: true })).toBeVisible();
  await expect(panel).toContainText('187 个有观测值的国家和地区');
  await expect(panel).toContainText('−0.066 指数点');
  await expect(panel).toContainText('+0.163 指数点');
  await expect(panel).toContainText('1990–2005');
  await expect(panel).toContainText('Gabon');
  await expect(panel).toContainText('结构差异值 0.386');
  await expect(panel).toContainText('不代表典型性、相似社会条件或因果关系');
  if (testInfo.project.name === 'chromium') {
    for (const surface of [
      page.locator('header').first(),
      page.locator('section[data-mode="development"]'),
      page.getByRole('navigation', { name: '观察模式' }),
    ]) {
      expect(
        overlaps(await panel.boundingBox(), await surface.boundingBox()),
      ).toBe(false);
    }
    const panelBody = panel.locator('#development-controls-body');
    expect(
      await panelBody.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    ).toBe(true);
  } else {
    expect(
      overlaps(
        await panel.boundingBox(),
        await page.getByRole('navigation', { name: '观察模式' }).boundingBox(),
      ),
    ).toBe(false);
    const panelBody = panel.locator(':scope > div').nth(1);
    expect(
      await panelBody.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    ).toBe(true);
  }

  const tableButton = panel.getByRole('button', { name: '表格视图' });
  await tableButton.click();
  const table = page.getByRole('dialog', { name: '表格视图' });
  await expect(table).toBeVisible();
  await expect(page.locator('#root')).toHaveAttribute('inert', '');
  const closeTable = table.getByRole('button', { name: '关闭表格' });
  await expect(closeTable).toBeFocused();
  expect((await closeTable.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  const tableScroll = table.getByRole('region', {
    name: '发展数据表滚动区',
  });
  await page.keyboard.press('Tab');
  await expect(tableScroll).toBeFocused();
  await page.keyboard.press('PageDown');
  expect(
    await tableScroll.evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(0);
  if (testInfo.project.name === 'mobile') {
    await page.keyboard.press('ArrowRight');
    expect(
      await tableScroll.evaluate((element) => element.scrollLeft),
    ).toBeGreaterThan(0);
  }
  await expect(table.getByRole('columnheader')).toHaveText([
    '国家或地区',
    '指数',
    '相对中位数',
    '历史端点变化',
  ]);
  await expect(table.getByRole('row').nth(1)).toContainText('Afghanistan');
  await expect(table.getByRole('row', { name: /^China / })).toContainText(
    /0\.540.*−0\.066.*\+0\.163.*1990–2005/,
  );
  await page.keyboard.press('Tab');
  await expect(closeTable).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(table).toBeHidden();
  await expect(tableButton).toBeFocused();

  await panel.getByRole('button', { name: '收入' }).click();
  await expect(page).toHaveURL(/indicator=income/);
  await panel.getByRole('slider', { name: /年份/ }).fill('2010');
  await expect(page).toHaveURL(/year=2010/);
});

test('signposts Development evidence that continues below the panel', async ({
  page,
}, testInfo) => {
  await page.goto('./?mode=development&indicator=education&year=2005&v=1');
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '展开发展控件' }).click();
  }

  const panel = page.locator('[data-mode-panel="development-controls"]');
  const panelBody = panel.locator('#development-controls-body');
  const immediateEvidence = [
    panel.getByText('0.540', { exact: true }).first(),
    panel.getByText('0.607', { exact: true }),
    panel.getByText('−0.066 指数点', { exact: true }),
    panel.getByText('+0.163 指数点', { exact: true }),
    panel.getByText('1990–2005', { exact: true }),
  ];
  await Promise.all(
    immediateEvidence.map((evidence) => expect(evidence).toBeVisible()),
  );

  if (testInfo.project.name === 'mobile') {
    const bodyBox = await panelBody.boundingBox();
    expect(bodyBox).not.toBeNull();
    for (const evidence of immediateEvidence) {
      const evidenceBox = await evidence.boundingBox();
      expect(evidenceBox).not.toBeNull();
      expect(evidenceBox!.y).toBeGreaterThanOrEqual(bodyBox!.y);
      expect(evidenceBox!.y + evidenceBox!.height).toBeLessThanOrEqual(
        bodyBox!.y + bodyBox!.height,
      );
    }
  }

  const continuation = panel.getByRole('button', {
    name: '继续查看算法结构对照',
  });
  const contrastHeading = panel.getByRole('heading', { name: '算法结构对照' });
  await expect(continuation).toBeVisible();

  const remainingAfterContrastEnters = await panelBody.evaluate(
    (element, contrast) => {
      const bodyRect = element.getBoundingClientRect();
      const contrastRect = contrast.getBoundingClientRect();
      element.scrollTop += contrastRect.top - bodyRect.top;
      element.dispatchEvent(new Event('scroll'));
      return element.scrollHeight - element.clientHeight - element.scrollTop;
    },
    await contrastHeading.elementHandle(),
  );
  await expect(contrastHeading).toBeVisible();
  expect(remainingAfterContrastEnters).toBeGreaterThan(2);
  await expect(continuation).toBeHidden();

  await panelBody.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(continuation).toBeVisible();
  await continuation.click();
  await expect(contrastHeading).toBeVisible();
  await expect(contrastHeading).toBeFocused();
  await expect(contrastHeading).toHaveCSS('outline-style', 'solid');
  await expect(continuation).toBeHidden();
  await expect(panel.getByText('Gabon', { exact: true }).first()).toBeVisible();
});

test('keeps Development data lazy and cached across mode switches', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'One request trace is sufficient',
  );
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('./');
  await expect(page.locator('canvas')).toBeVisible();
  expect(requests.some((url) => url.includes('undp-hdr'))).toBe(false);

  await page.getByRole('button', { name: /发展的不同侧面/ }).click();
  await expect(page.getByText('全球中位数', { exact: true })).toBeVisible();
  expect(requests.filter((url) => url.includes('undp-hdr'))).toHaveLength(1);
  await page.getByRole('button', { name: /地球另一端/ }).click();
  await page.getByRole('button', { name: /发展的不同侧面/ }).click();
  await expect(page.getByText('全球中位数', { exact: true })).toBeVisible();
  expect(requests.filter((url) => url.includes('undp-hdr'))).toHaveLength(1);
});

test('explains Development evidence consistently in English', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Desktop copy coverage');
  await page.goto('./?mode=development&indicator=education&year=2005&v=1');
  await page.getByRole('button', { name: '切换为英文' }).click();
  const panel = page.locator('[data-mode-panel="development-controls"]');
  await expect(panel).toContainText('Global median');
  await expect(panel).toContainText('187 observed countries and territories');
  await expect(panel).toContainText('−0.066 index points');
  await expect(panel).toContainText('Algorithmic structural contrast');
  await expect(panel).toContainText('Gabon');
  await expect(panel).toContainText(
    'not evidence of typicality, similar social conditions, or causation',
  );
});

test('drives fixed, playing, and live Sunline time in UTC', async ({
  page,
}, testInfo) => {
  await page.goto('./?mode=sunline&point=0%2C0&time=2024-03-20T12%3A00Z&v=1');
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '展开日照线控件' }).click();
  }

  const timeline = page.getByRole('slider', { name: /UTC 时间/ });
  await expect(timeline).toHaveValue('720');
  await expect(page.getByText('白昼', { exact: true })).toBeVisible();
  await expect(page.getByText('03-20 06:04 UTC')).toBeVisible();

  await timeline.fill('0');
  await expect(page).toHaveURL(/time=2024-03-20T00%3A00Z/);
  await expect(page.getByText('夜晚', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '播放一天' }).click();
  await expect(page.getByRole('button', { name: '暂停' })).toBeVisible();
  await expect(timeline).not.toHaveValue('0');
  await page.getByRole('button', { name: '暂停' }).click();

  await page.getByRole('button', { name: '回到此刻' }).click();
  await expect(page).not.toHaveURL(/time=/);
  await expect(page.getByText(/实时 · 1440×/)).toBeVisible();

  await page.getByRole('button', { name: '分享' }).click();
  await expect(page.getByRole('dialog')).toContainText(/time=/);
});

test('keeps mode lifecycle stable across repeated switching', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name === 'mobile', 'Desktop lifecycle coverage');
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('./?mode=sunline&time=2024-03-20T12%3A00Z&v=1');

  for (let index = 0; index < 20; index += 1) {
    const name =
      index % 3 === 0
        ? /地球另一端/
        : index % 3 === 1
          ? /发展的不同侧面/
          : /日照线/;
    await page.getByRole('button', { name }).click();
  }

  await expect(page.locator('canvas')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('isolates Share, traps focus, closes cleanly, and preserves URL state', async ({
  page,
}) => {
  await page.goto('./?point=30.25%2C120.75&v=1');
  const initialUrl = page.url();
  const opener = page.getByRole('button', { name: '分享' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: '分享这一视角' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#root')).toHaveAttribute('inert', '');
  await expect(page).toHaveURL(initialUrl);
  await expect(dialog.getByText(/point=30%2C121/)).toBeVisible();
  const close = dialog.getByRole('button', { name: '关闭' });
  const approximate = dialog.getByRole('button', { name: '复制约略位置' });
  const exact = dialog.getByRole('button', { name: '复制精确位置' });
  await expect(approximate).toBeVisible();
  await expect(exact).toBeVisible();
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(exact).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();

  await dialog.locator('..').click({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeHidden();
  await expect(page.locator('#root')).not.toHaveAttribute('inert', '');
  await expect(opener).toBeFocused();
  await expect(page).toHaveURL(initialUrl);

  await opener.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#root')).not.toHaveAttribute('inert', '');
  await expect(opener).toBeFocused();
  await expect(page).toHaveURL(initialUrl);
});

test('keeps frequent mobile controls at least 44px tall', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  const placeToggle = page.getByRole('button', { name: '展开地点控件' });
  await expectMinimumHeight(placeToggle, 44);
  await placeToggle.click();
  const placePanel = page.locator('[data-mode-panel="place-controls"]');
  for (const control of [
    placePanel.getByRole('searchbox'),
    placePanel.locator('input[name="latitude"]'),
    placePanel.locator('input[name="longitude"]'),
    placePanel.getByRole('button', { name: '前往' }),
    placePanel.getByRole('button', { name: '使用我的位置' }),
    placePanel.getByRole('button', { name: '上海' }),
    placePanel.getByRole('button', { name: '马德里' }),
  ]) {
    await expectMinimumHeight(control, 44);
  }

  await page.getByRole('button', { name: /发展的不同侧面/ }).click();
  const developmentToggle = page.getByRole('button', { name: '展开发展控件' });
  await expectMinimumHeight(developmentToggle, 44);
  await developmentToggle.click();
  const developmentPanel = page.locator(
    '[data-mode-panel="development-controls"]',
  );
  for (const indicator of ['综合 HDI', '健康', '教育', '收入']) {
    await expectMinimumHeight(
      developmentPanel.getByRole('button', { name: indicator }),
      44,
    );
  }

  await page.getByRole('button', { name: /日照线/ }).click();
  const sunlineToggle = page.getByRole('button', { name: '展开日照线控件' });
  await expectMinimumHeight(sunlineToggle, 44);
  await sunlineToggle.click();
  const sunlinePanel = page.locator('[data-mode-panel="sunline-controls"]');
  await expectMinimumHeight(sunlinePanel.getByLabel('UTC 日期'), 44);
  await expectMinimumHeight(
    sunlinePanel.getByRole('button', { name: '播放一天' }),
    44,
  );
  await expectMinimumHeight(
    sunlinePanel.getByRole('button', { name: '回到此刻' }),
    44,
  );

  await page.getByRole('button', { name: '分享' }).click();
  const share = page.getByRole('dialog', { name: '分享这一视角' });
  for (const action of ['关闭', '复制约略位置', '复制精确位置']) {
    await expectMinimumHeight(share.getByRole('button', { name: action }), 44);
  }

  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 320, height: 568 });
  await expectMinimumHeight(
    page.getByRole('button', { name: '收起日照线控件' }),
    44,
  );
  await page.getByRole('button', { name: '分享' }).click();
  const compactShare = page.getByRole('dialog', { name: '分享这一视角' });
  for (const action of ['关闭', '复制约略位置', '复制精确位置']) {
    await expectMinimumHeight(
      compactShare.getByRole('button', { name: action }),
      44,
    );
  }
});

test('keeps the flip-to-antipode target at least 44px tall at compact widths', async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await page.getByRole('button', { name: '展开地点控件' }).click();
    await expectMinimumHeight(
      page.getByRole('button', { name: '翻到另一端' }),
      44,
    );
  }
});

test('uses the accent focus ring for keyboard form and disclosure controls only', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const toggle = page.getByRole('button', { name: '展开地点控件' });
  await toggle.click();
  const panel = page.locator('[data-mode-panel="place-controls"]');
  const search = panel.getByRole('searchbox');
  const summary = panel.getByText('数据与方法', { exact: true });

  await search.focus();
  await expectAccentFocusRing(search);
  await summary.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expectAccentFocusRing(summary);

  const shareButton = page.getByRole('button', { name: '分享' });
  await shareButton.click();
  await page.keyboard.press('Escape');
  await page.mouse.click(4, 4);
  await shareButton.click();
  expect(
    await shareButton.evaluate((element) => element.matches(':focus-visible')),
  ).toBe(false);
  expect(
    await shareButton.evaluate(
      (element) => getComputedStyle(element).outlineStyle,
    ),
  ).toBe('none');
});

async function expectMinimumHeight(
  locator: import('@playwright/test').Locator,
  minimum: number,
) {
  await expect(locator).toBeVisible();
  expect((await locator.boundingBox())?.height).toBeGreaterThanOrEqual(minimum);
}

async function expectAccentFocusRing(
  locator: import('@playwright/test').Locator,
) {
  expect(
    await locator.evaluate((element) => element.matches(':focus-visible')),
  ).toBe(true);
  expect(
    await locator.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).toBe('solid');
  expect(
    await locator.evaluate((element) => getComputedStyle(element).outlineWidth),
  ).toBe('2px');
}

function overlaps(
  first: { x: number; y: number; width: number; height: number } | null,
  second: { x: number; y: number; width: number; height: number } | null,
): boolean {
  if (!first || !second) return false;
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}
