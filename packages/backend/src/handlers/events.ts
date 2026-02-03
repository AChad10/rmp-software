import { App } from '@slack/bolt';
import { buildHomeView } from '../views/home';

export function registerEvents(app: App): void {
  // Handle App Home opened event
  app.event('app_home_opened', async ({ event, client, logger }) => {
    try {
      // Get user info to personalize the greeting
      const userInfo = await client.users.info({ user: event.user });
      const userName = userInfo.user?.real_name || userInfo.user?.name || 'Trainer';

      // Publish the home view
      await client.views.publish({
        user_id: event.user,
        view: await buildHomeView({
          userName,
          userId: event.user,
        }),
      });

      logger.info(`Home tab published for user ${event.user}`);
    } catch (error) {
      logger.error('Error publishing home tab:', error);
    }
  });
}
