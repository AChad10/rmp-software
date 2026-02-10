import { App } from '@slack/bolt';

export function registerActions(app: App): void {
  // Handle external link buttons (just acknowledge, URL opens automatically)
  app.action('open_fresha', async ({ ack }) => {
    await ack();
  });

  app.action('open_attendance', async ({ ack }) => {
    await ack();
  });

  app.action('open_powerbi', async ({ ack }) => {
    await ack();
  });

  app.action('open_referral_form', async ({ ack }) => {
    await ack();
  });

  app.action('open_customers', async ({ ack }) => {
    await ack();
  });

  app.action('open_bsc_form', async ({ ack }) => {
    await ack();
  });

  // Command button acknowledgements
  app.action('cmd_open_attendance', async ({ ack }) => {
    await ack();
  });

  app.action('cmd_open_customers', async ({ ack }) => {
    await ack();
  });

  app.action('cmd_open_performance', async ({ ack }) => {
    await ack();
  });
}
