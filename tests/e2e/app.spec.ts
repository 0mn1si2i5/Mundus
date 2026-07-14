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
});

test('loads the scoped Natural Earth nearest-place result', async ({
  page,
}) => {
  await page.goto('./?mode=sunline&v=1');
  await expect(page.getByText('数据中最近的聚居点')).toBeHidden();

  await page.getByRole('button', { name: /地球另一端/ }).click();
  await expect(page.getByText('Santa Fe, Argentina')).toBeVisible();
  await expect(page.getByText(/非完整城市名录/)).toBeVisible();
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

  await expect(page.getByRole('button', { name: '教育' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('slider', { name: /年份/ })).toHaveValue('2005');
  await expect(page.getByText('0.540', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '收入' }).click();
  await expect(page).toHaveURL(/indicator=income/);
  await page.getByRole('slider', { name: /年份/ }).fill('2010');
  await expect(page).toHaveURL(/year=2010/);

  await page.getByRole('button', { name: '表格视图' }).click();
  const table = page.getByRole('complementary', { name: '表格视图' });
  await expect(table).toBeVisible();
  await expect(table.getByRole('row').nth(1)).toContainText(/\d\.\d{3}/);
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
