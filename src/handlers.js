import Parse from 'parse/node.js';
import { startPoller, stopPoller } from './poller.js';

const HOST_USER_ID = process.env.HOST_USER_ID || 'CYquS7rysG';

function argCode(text) {
  const parts = (text || '').trim().split(/\s+/);
  return parts[1];
}

export function registerHandlers(bot) {
  bot.start((ctx) => ctx.reply('Welcome to SHEWA BINGO. Commands: /newgame [entry] [prize], /join CODE, /startgame CODE, /draw CODE, /bingo CODE, /card CODE, /status CODE, /bind CODE, /unbind'));

  bot.command('newgame', async (ctx) => {
    const args = (ctx.message.text || '').split(/\s+/);
    const entryFee = Number(args[1] || 0);
    const prizePool = Number(args[2] || 0);
    try {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const result = await Parse.Cloud.run('newGame', {
        name: `SHEWA Bingo ${new Date().toLocaleString()}`,
        code,
        hostId: HOST_USER_ID,
        entryFee,
        prizePool,
        isPublic: true
      });
      try { await upsertTelegramChat(ctx.chat, result.objectId); } catch (_) {}
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
      await ctx.reply(`Joined game. Card: ${res.cardId}`);
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
      if (ctx.chat) startPoller(bot, ctx.chat.id, code);
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
      const letter = letterForNumber(res.number);
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

  bot.command('bind', async (ctx) => {
    const code = argCode(ctx.message.text);
    if (!code) return ctx.reply('Usage: /bind GAME_CODE');
    try {
      const res = await Parse.Cloud.run('getGameStatus', { code });
      await upsertTelegramChat(ctx.chat, res.game.id);
      startPoller(bot, ctx.chat.id, code);
      await ctx.reply(`Bound this chat to game ${res.game.name}. I will post new draws automatically.`);
    } catch (e) {
      await ctx.reply(`Bind failed: ${e.message}`);
    }
  });

  bot.command('unbind', async (ctx) => {
    stopPoller(ctx.chat.id);
    await ctx.reply('Unbound. I will stop posting updates here.');
  });
}

async function upsertTelegramChat(chat, gameId) {
  if (!chat) return;
  const TelegramChat = Parse.Object.extend('TelegramChat');
  const q = new Parse.Query(TelegramChat);
  q.equalTo('chatId', String(chat.id));
  let row = await q.first({ useMasterKey: true });
  if (!row) row = new TelegramChat();
  row.set('chatId', String(chat.id));
  if (chat.title) row.set('title', chat.title);
  if (chat.type) row.set('type', chat.type);
  if (gameId) row.set('game', new Parse.Object('Game', { id: gameId }));
  await row.save(null, { useMasterKey: true });
  return row.id;
}

function letterForNumber(n) {
  if (n >= 1 && n <= 15) return 'B';
  if (n >= 16 && n <= 30) return 'I';
  if (n >= 31 && n <= 45) return 'N';
  if (n >= 46 && n <= 60) return 'G';
  return 'O';
}
