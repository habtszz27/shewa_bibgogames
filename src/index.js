import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';
import Parse from 'parse/node.js';
import { registerHandlers } from './handlers.js';

const {
  TELEGRAM_BOT_TOKEN,
  PARSE_APP_ID,
  PARSE_JS_KEY,
  PARSE_SERVER_URL,
  TELEGRAM_WEBHOOK_URL,
  PORT = 3000
} = process.env;

if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN missing');
if (!PARSE_APP_ID || !PARSE_JS_KEY || !PARSE_SERVER_URL) throw new Error('Parse env vars missing');

Parse.initialize(PARSE_APP_ID, PARSE_JS_KEY);
Parse.serverURL = PARSE_SERVER_URL;

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
registerHandlers(bot);

const app = express();
app.get('/', (req, res) => res.send('OK'));
app.use(bot.webhookCallback('/webhook'));

if (TELEGRAM_WEBHOOK_URL) {
  const base = TELEGRAM_WEBHOOK_URL.replace(/\/$/, '');
  const url = `${base}/webhook`;
  bot.telegram.setWebhook(url)
    .then(() => console.log('Webhook set to', url))
    .catch(err => console.error('Webhook error', err));
} else {
  bot.launch().then(() => console.log('Bot started with long polling'));
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

app.listen(PORT, () => console.log('Health server on', PORT));
