import { expect, test } from '@playwright/test';

test('reports and clears WebGL context interruption', async ({ page }) => {
  await page.goto('./');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await canvas.dispatchEvent('webglcontextlost', { cancelable: true });
  await expect(page.getByRole('status')).toContainText('图形上下文暂时中断');
  await canvas.dispatchEvent('webglcontextrestored');
  await expect(page.getByText('图形上下文暂时中断')).toBeHidden();
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
  await expect(page.getByText('海洋或未知区域')).toBeVisible();

  await page.getByRole('button', { name: /发展的不同侧面/ }).click();
  await expect(page).toHaveURL(/mode=development/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: '日照线' })).toBeVisible();
});
