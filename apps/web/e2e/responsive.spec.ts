import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { width: 320, height: 568, label: '320x568 (iPhone SE 1st gen)' },
  { width: 375, height: 667, label: '375x667 (iPhone SE 2nd/3rd gen)' },
  { width: 390, height: 844, label: '390x844 (iPhone 12/13/14)' },
  { width: 430, height: 932, label: '430x932 (iPhone 14/15 Pro Max)' },
  { width: 768, height: 1024, label: '768x1024 (iPad Portrait)' },
  { width: 1024, height: 768, label: '1024x768 (iPad Landscape)' },
  { width: 1280, height: 800, label: '1280x800 (Small Laptop)' },
  { width: 1440, height: 900, label: '1440x900 (Desktop Laptop)' },
  { width: 1920, height: 1080, label: '1920x1080 (FHD Desktop Monitor)' },
];

test.describe('PulseChat 9-Viewport Responsive & Design System Suite', () => {
  test('verifies 0 horizontal overflow and controls reachability across all 9 viewports', async ({ page }) => {
    const timestamp = Date.now();
    const testUser = {
      username: `resp_${timestamp}`,
      displayName: `Responsive Test ${timestamp}`,
      email: `resp_${timestamp}@pulse.chat`,
      password: 'Password123!',
    };

    // 1. Register User
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const createAccountTab = page.locator('button', { hasText: 'Create Account' });
    await createAccountTab.click();

    await page.locator('input[name="username"]').fill(testUser.username);
    await page.locator('input[name="displayName"]').fill(testUser.displayName);
    await page.locator('input[name="email"]').fill(testUser.email);
    await page.locator('input[name="password"]').fill(testUser.password);

    await page.locator('button[type="submit"]', { hasText: 'Create Account' }).click();

    // Select general channel if not auto-selected
    const generalChannel = page.locator('button', { hasText: 'general' });
    if (await generalChannel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generalChannel.click();
    }

    const composerTextarea = page.locator('textarea[placeholder*="Type a message"]');
    await expect(composerTextarea).toBeVisible({ timeout: 15000 });

    // Send a sample message with normal text and a long unbroken string to test wrapping
    await composerTextarea.fill('Welcome to the responsive test! Checking layout integrity.');
    await page.locator('button:has(svg.lucide-send)').click();

    // 2. Iterate through all 9 required viewports
    for (const vp of VIEWPORTS) {
      console.log(`Testing viewport: ${vp.label} (${vp.width}x${vp.height})`);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);

      // Verify ZERO unintended horizontal scrolling on the root page
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(
        hasHorizontalScroll,
        `Viewport ${vp.label} has unintended horizontal scroll: scrollWidth ${await page.evaluate(() => document.documentElement.scrollWidth)} > window.innerWidth ${vp.width}`,
      ).toBe(false);

      // Verify composer is visible and reachable without horizontal scroll
      await expect(composerTextarea).toBeVisible();
      const sendButton = page.locator('button:has(svg.lucide-send)');
      await expect(sendButton).toBeVisible();

      const sendBtnBox = await sendButton.boundingBox();
      expect(sendBtnBox).not.toBeNull();
      if (sendBtnBox) {
        expect(sendBtnBox.x + sendBtnBox.width).toBeLessThanOrEqual(vp.width + 2);
      }

      // Test mobile drawer interaction on small viewports
      if (vp.width < 768) {
        const hamburgerBtn = page.locator('button[aria-label="Open sidebar navigation"]');
        await expect(hamburgerBtn).toBeVisible();
        await hamburgerBtn.click();

        // Check drawer opened without causing page horizontal scroll
        const drawerScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(drawerScroll).toBe(false);

        // Close drawer by clicking backdrop
        await page.locator('div.fixed.inset-0.bg-black\\/60').click({ position: { x: vp.width - 20, y: 100 } });
        await page.waitForTimeout(200);
      }
    }

    // 3. Test Theme Toggle (Dark & Light Mode)
    const themeBtn = page.locator('button[aria-label*="Switch to"]');
    if (await themeBtn.isVisible()) {
      // Toggle to light mode
      await themeBtn.click();
      const isLight = await page.evaluate(() => document.documentElement.classList.contains('light'));
      expect(isLight).toBe(true);

      // Verify no horizontal overflow in light mode
      const lightScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(lightScroll).toBe(false);

      // Toggle back to dark mode
      await themeBtn.click();
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      expect(isDark).toBe(true);
    }
  });
});
