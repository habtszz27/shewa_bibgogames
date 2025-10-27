import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';
import Parse from 'parse/node.js';

const {
  TELEGRAM_BOT_TOKEN,
  PARSE_APP_ID,
  PARSE_JS_KEY,
  PARSE_SERVER_URL,
  TELEGRAM_WEBHOOK_URL,
  HOST_USER_ID = 'CYquS7rysG',
  PORT = 3000
} = process.env;

if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN missing');
if (!PARSE_APP_ID || !PARSE_JS_KEY || !PARSE_SERVER_URL) throw new Error('Parse env vars missing');

Parse.initialize(PARSE_APP_ID, PARSE_JS_KEY);
Parse.serverURL = PARSE_SERVER_URL;

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

function argCode(text) {
  const parts = (text || '').trim().split(/\s+/);
  return parts[1];
}

bot.start(async (ctx) => {
  await ctx.reply('Welcome to SHEWA BINGO! Commands: /newgame [entry] [prize], /join CODE, /startgame CODE, /draw CODE, /bingo CODE, /card CODE, /status CODE');
});

bot.command('newgame', async (ctx) => {
  const args = (ctx.message.text || '').split(/\s+/);
  const entryFee = Number(args[1] || 0);
  const prizePool = Number(args[2] || 0);
  try {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    await Parse.Cloud.run('newGame', {
      name: `SHEWA Bingo ${new Date().toLocaleString()}`,
      code,
      hostId: HOST_USER_ID,
      entryFee,
      prizePool,
      isPublic: true
    });
    await ctx.reply(`Game created. Code: ${code}\nUse /join ${code} to join.`);
  } catch (e) {
    await ctx.reply(`Failed to create game: ${e.message}`);
  }
});

bot.command('join', async (ctx) => {
  const code = argCode(ctx.message.text);
  if (!code) return ctx.reply('Usage: /join GAME_CODE');
  try {
    const res = await Parse.Cloud.run('joinGame', {
      code,
      telegramUserId: String(ctx.from.id),
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      languageCode: ctx.from.language_code
    });
    await ctx.reply(`Joined game ${code}. Card: ${res.cardId}`);
  } catch (e) {
    await ctx.reply(`Join failed: ${e.message}`);
  }
});

bot.command('startgame', async (ctx) => {
  const code = argCode(ctx.message.text);
  if (!code) return ctx.reply('Usage: /startgame GAME_CODE');
  try {
    await Parse.Cloud.run('startGame', { code });
    await ctx.reply('Game started.');
  } catch (e) {
    await ctx.reply(`Start failed: ${e.message}`);
  }
});

bot.command('draw', async (ctx) => {
  const code = argCode(ctx.message.text);
  if (!code) return ctx.reply('Usage: /draw GAME_CODE');
  try {
    const res = await Parse.Cloud.run('nextNumber', { code });
    if (res.done) return ctx.reply('All numbers drawn.');
    const letter = (n => n<=15?'B':n<=30?'I':n<=45?'N':n<=60?'G':'O')(res.number);
    await ctx.reply(`Draw #${res.sequence}: ${letter}-${res.number}`);
  } catch (e) {
    await ctx.reply(`Draw failed: ${e.message}`);
  }
});

bot.command('bingo', async (ctx) => {
  const code = argCode(ctx.message.text);
  if (!code) return ctx.reply('Usage: /bingo GAME_CODE');
  try {
    const res = await Parse.Cloud.run('claimBingo', {
      code,
      telegramUserId: String(ctx.from.id)
    });
    if (res.ok) return ctx.reply(`BINGO! Pattern: ${res.pattern}`);
    return ctx.reply(`No valid bingo: ${res.reason || 'try again later'}`);
  } catch (e) {
    await ctx.reply(`Claim failed: ${e.message}`);
  }
});

bot.command('card', async (ctx) => {
  const code = argCode(ctx.message.text);
  if (!code) return ctx.reply('Usage: /card GAME_CODE');
  try {
    const res = await Parse.Cloud.run('getCard', {
      code,
      telegramUserId: String(ctx.from.id)
    });
    const nums = res.numbers || [];
    const rows = [];
    for (let i = 0; i < 25; i += 5) rows.push(nums.slice(i, i + 5).map(n => String(n).padStart(2, ' ')).join(' '));
    await ctx.reply(['Your card:', ...rows].join('\n'));
  } catch (e) {
    await ctx.reply(`Card failed: ${e.message}`);
  }
});

bot.command('status', async (ctx) => {
  const code = argCode(ctx.message.text);
  if (!code) return ctx.reply('Usage: /status GAME_CODE');
  try {
    const res = await Parse.Cloud.run('getGameStatus', { code });
    const calls = (res.calls || []).map(c => c.number).join(', ');
    await ctx.reply(`Game ${res.game.name} (${res.game.status})\nCalls: ${calls}`);
  } catch (e) {
    await ctx.reply(`Status failed: ${e.message}`);
  }
});

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
