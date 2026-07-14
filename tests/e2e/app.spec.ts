import { expect, test } from '@playwright/test';

test('reports and clears WebGL context interruption', async ({ page }) => {
  await page.goto('./?benchmark=1&benchmarkWarmup=100&benchmarkDuration=300');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const benchmark = page.locator('output[data-phase="complete"]');
  await expect(benchmark).toContainText('fps');
  await expect(benchmark).toContainText('p95');
  await canvas.dispatchEvent('webglcontextlost', { cancelable: true });
  const contextStatus = page.getByText(
    '图形上下文暂时中断，正在等待浏览器恢复。',
  );
  await expect(contextStatus).toBeVisible();
  await canvas.dispatchEvent('webglcontextrestored');
  await expect(contextStatus).toBeHidden();
});

test('loads the laboratory shell and switches language', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '地球另一端' })).toBeVisible();
  await page.getByRole('button', { name: '切换为英文' }).click();
  await expect(page.getByRole('heading', { name: 'Other Side' })).toBeVisible();
});

test('keeps all observation modes keyboard accessible', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /发展的不同侧面/ }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: '发展的不同侧面' }),
  ).toBeVisible();
});

test('restores shareable state and browser history', async ({ page }) => {
  await page.goto('./?mode=sunline&point=0%2C-140&v=1');
  await expect(page.getByRole('heading', { name: '日照线' })).toBeVisible();
  await expect(page.getByText('海洋或未知区域').first()).toBeVisible();

  await page.getByRole('button', { name: /发展的不同侧面/ }).click();
  await expect(page).toHaveURL(/mode=development/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: '日照线' })).toBeVisible();
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
    await page.getByRole('button', { name: '展开地点控件' }).click();
  }
  await page.getByLabel('纬度').fill('91');
  await page.getByLabel('经度').fill('0');
  await page.getByRole('button', { name: '前往' }).click();
  await expect(page.getByRole('alert')).toContainText('纬度需在');
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
});
