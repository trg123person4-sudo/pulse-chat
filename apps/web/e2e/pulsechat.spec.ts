import { test, expect } from '@playwright/test';

test.describe('PulseChat Full E2E Verification', () => {
  test('multi-user delivery, threads, offline outbox, and scheduled message', async ({ browser }) => {
    const timestamp = Date.now();
    const userA = {
      username: `alice_${timestamp}`,
      displayName: `Alice ${timestamp}`,
      email: `alice_${timestamp}@pulse.chat`,
      password: 'Password123!',
    };
    const userB = {
      username: `bob_${timestamp}`,
      displayName: `Bob ${timestamp}`,
      email: `bob_${timestamp}@pulse.chat`,
      password: 'Password123!',
    };

    // 1. Create two isolated browser contexts for User A and User B
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    pageA.on('console', (msg) => console.log(`[PAGE-A ${msg.type()}]`, msg.text()));
    pageB.on('console', (msg) => console.log(`[PAGE-B ${msg.type()}]`, msg.text()));
    pageA.on('pageerror', (err) => console.log('[PAGE-A PAGEERROR]', err.message, err.stack));
    pageB.on('pageerror', (err) => console.log('[PAGE-B PAGEERROR]', err.message, err.stack));

    // Helper: Register user on a page
    const registerUser = async (page: any, user: typeof userA) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Click "Create Account" tab
      const createAccountTab = page.locator('button', { hasText: 'Create Account' });
      await createAccountTab.click();

      // Fill registration form
      await page.locator('input[name="username"]').fill(user.username);
      await page.locator('input[name="displayName"]').fill(user.displayName);
      await page.locator('input[name="email"]').fill(user.email);
      await page.locator('input[name="password"]').fill(user.password);

      // Submit registration
      await page.locator('button[type="submit"]', { hasText: 'Create Account' }).click();

      // Ensure general channel is selected if not auto-selected
      const generalChannel = page.locator('button', { hasText: 'general' });
      if (await generalChannel.isVisible({ timeout: 5000 }).catch(() => false)) {
        await generalChannel.click();
      }

      // Verify redirection to main chat interface (composer is visible)
      await expect(
        page.locator('textarea[placeholder*="Type a message"]'),
      ).toBeVisible({ timeout: 15000 });
    };

    // --- Scenario 1: Register two users and confirm real-time delivery ---
    await registerUser(pageA, userA);
    await registerUser(pageB, userB);

    const message1Text = `Real-time message from Alice: ${timestamp}`;
    const composerA = pageA.locator('textarea[placeholder*="Type a message"]');
    await composerA.fill(message1Text);
    await pageA.locator('button:has(svg.lucide-send)').click();

    // Verify User A sees their sent message
    await expect(pageA.getByText(message1Text)).toBeVisible({ timeout: 10000 });

    // Verify User B receives and sees the message in real-time without reloading
    await expect(pageB.getByText(message1Text)).toBeVisible({ timeout: 10000 });

    // --- Scenario 2: Reply into a thread and confirm it appears in the thread panel ---
    // User B hovers over Alice's message and opens the thread
    const msgElementB = pageB.locator('div.group', { hasText: message1Text }).first();
    await msgElementB.hover();

    const replyThreadBtn = msgElementB.getByTestId('reply-in-thread');
    await replyThreadBtn.click({ force: true });

    // Confirm ThreadPanel is open
    const threadPanel = pageB.getByTestId('thread-panel');
    await expect(threadPanel).toBeVisible({ timeout: 8000 });

    // Reply in thread composer
    const threadReplyText = `Thread reply from Bob: ${timestamp}`;
    const threadTextarea = threadPanel.locator('textarea[placeholder="Reply in thread..."]');
    await threadTextarea.fill(threadReplyText);
    await threadPanel.locator('button:has(svg.lucide-send)').click();

    // Confirm the reply appears in the thread panel
    await expect(threadPanel.getByText(threadReplyText)).toBeVisible({ timeout: 10000 });

    // Confirm parent message shows thread replies indicator
    await expect(pageB.locator('button', { hasText: /reply/i })).toBeVisible({ timeout: 10000 });

    // --- Scenario 3: Compose while offline and confirm delivery after reconnecting (Fix #12) ---
    // User A goes offline
    await contextA.setOffline(true);

    const offlineText = `Offline outbox message from Alice: ${timestamp}`;
    await composerA.fill(offlineText);
    await pageA.locator('button:has(svg.lucide-send)').click();

    // Verify message appears in Alice's message list (queued in outbox / pending)
    await expect(pageA.getByText(offlineText)).toBeVisible({ timeout: 5000 });

    // User A comes back online
    await contextA.setOffline(false);

    // Confirm outbox flushes and Bob receives the offline message
    await expect(pageB.getByText(offlineText)).toBeVisible({ timeout: 15000 });

    // --- Scenario 4: Scheduled message firing at the right time (Fix #5) ---
    // User A schedules a message 2 seconds in the future
    const scheduledText = `Scheduled future announcement: ${timestamp}`;
    await composerA.fill(`/schedule 2s ${scheduledText}`);
    await pageA.locator('button:has(svg.lucide-send)').click();

    // Verify scheduling confirmation toast/banner appears
    await expect(pageA.getByText(/Message scheduled to post in 2s/i)).toBeVisible({ timeout: 5000 });

    // Wait 3.5s for ScheduledMessageWorker (polls every 1000ms) to claim and publish
    await pageA.waitForTimeout(3500);

    // Verify the scheduled message appears in the chat for both users
    await expect(pageA.getByText(scheduledText)).toBeVisible({ timeout: 10000 });
    await expect(pageB.getByText(scheduledText)).toBeVisible({ timeout: 10000 });

    // Cleanup contexts
    await contextA.close();
    await contextB.close();
  });
});
