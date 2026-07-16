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
    expect(
      await panel.evaluate(
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
    expect(
      await panel.evaluate(
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

test('offers explicit share precision choices', async ({ page }) => {
  await page.goto('./?point=30.25%2C120.75&v=1');
  await page.getByRole('button', { name: '分享' }).click();
  const dialog = page.getByRole('dialog', { name: '分享这一视角' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/point=30%2C121/)).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: '复制精确位置' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: '复制约略位置' }),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: '关闭' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: '分享' })).toBeFocused();
});

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
