import Parse from 'parse/node.js';

const ACTIVE_POLLERS = new Map(); // chatId -> { timer, lastSeq, code }
const POLL_INTERVAL_MS = (Number(process.env.DRAW_INTERVAL_SECONDS || 20) * 1000);

export function startPoller(bot, chatId, code) {
  stopPoller(chatId);
  const state = { timer: null, lastSeq: 0, code };
  ACTIVE_POLLERS.set(String(chatId), state);

  async function tick() {
    try {
      const res = await Parse.Cloud.run('getGameStatus', { code });
      const calls = res.calls || [];
      const latest = calls.length ? calls[calls.length - 1].sequence : 0;
      const from = state.lastSeq + 1;
      for (const c of calls) {
        if (c.sequence >= from) {
          const letter = letterForNumber(c.number);
          await bot.telegram.sendMessage(chatId, `Draw #${c.sequence}: ${letter}-${c.number}`);
        }
      }
      state.lastSeq = latest;
      if (res.game.status === 'completed') {
        await bot.telegram.sendMessage(chatId, `Game ${res.game.name} completed.`);
        stopPoller(chatId);
        return;
      }
    } catch (e) {
      console.error('poller error', e.message);
    }
  }

  // fire immediately then every interval
  tick();
  state.timer = setInterval(tick, POLL_INTERVAL_MS);
}

export function stopPoller(chatId) {
  const s = ACTIVE_POLLERS.get(String(chatId));
  if (s && s.timer) clearInterval(s.timer);
  ACTIVE_POLLERS.delete(String(chatId));
}

function letterForNumber(n) {
  if (n >= 1 && n <= 15) return 'B';
  if (n >= 16 && n <= 30) return 'I';
  if (n >= 31 && n <= 45) return 'N';
  if (n >= 46 && n <= 60) return 'G';
  return 'O';
}
