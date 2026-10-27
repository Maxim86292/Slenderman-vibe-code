const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const pageCountEl = document.getElementById('page-count');
const batteryLevelEl = document.getElementById('battery-level');
const sanityLevelEl = document.getElementById('sanity-level');
const objectiveTextEl = document.getElementById('objective-text');
const inventoryEl = document.getElementById('inventory');
const logEl = document.getElementById('log');
const startScreen = document.getElementById('start-screen');
const endScreen = document.getElementById('end-screen');
const resultTag = document.getElementById('result-tag');
const resultTitle = document.getElementById('result-title');
const resultMessage = document.getElementById('result-message');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

const keys = {};
const TOTAL_PAGES = 5;

const state = {
  running: false,
  time: 0,
  lastTime: 0,
  pageCount: 0,
  battery: 100,
  sanity: 100,
  danger: 0,
  flashlightOn: true,
  flashlightRadius: 220,
  inventory: ['🔲', '🔲', '🔲', '🔲', '🔲'],
  logs: [],
  player: { x: 130, y: 670, radius: 12, speed: 210 },
  monster: { x: 1080, y: 140, radius: 24 },
  campfire: { x: 260, y: 640, radius: 30 },
  exitGate: { x: 1160, y: 160, w: 60, h: 120, unlocked: false },
  pages: [
    { x: 220, y: 260, collected: false },
    { x: 500, y: 180, collected: false },
    { x: 700, y: 360, collected: false },
    { x: 930, y: 500, collected: false },
    { x: 1090, y: 270, collected: false }
  ]
};

function pushLog(text) {
  state.logs.unshift(text);
  state.logs = state.logs.slice(0, 5);
  logEl.innerHTML = state.logs.map((item) => `<li>${item}</li>`).join('');
}

function renderInventory() {
  inventoryEl.innerHTML = '';
  for (const item of state.inventory) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    if (item !== '🔲') slot.classList.add('filled');
    slot.textContent = item;
    inventoryEl.appendChild(slot);
  }
}

function updateHud() {
  pageCountEl.textContent = `${state.pageCount} / ${TOTAL_PAGES}`;
  batteryLevelEl.textContent = `${Math.max(0, Math.round(state.battery))}%`;
  sanityLevelEl.textContent = `${Math.max(0, Math.round(state.sanity))}%`;
}

function setObjective(text) {
  objectiveTextEl.textContent = text;
}

function resetGame() {
  state.running = true;
  state.time = 0;
  state.pageCount = 0;
  state.battery = 100;
  state.sanity = 100;
  state.flashlightOn = true;
  state.flashlightRadius = 220;
  state.inventory = ['🔲', '🔲', '🔲', '🔲', '🔲'];
  state.player.x = 130;
  state.player.y = 670;
  state.monster.x = 1080;
  state.monster.y = 140;
  state.exitGate.unlocked = false;
  state.pages.forEach((page) => {
    page.collected = false;
  });
  state.logs = [
    'Ліс шепоче між деревами.',
    'Фонарь тріщить у руках.',
    'Щось рухається в тумані.'
  ];
  logEl.innerHTML = state.logs.map((item) => `<li>${item}</li>`).join('');
  renderInventory();
  updateHud();
  setObjective('Збери сторінки');
}

function endGame(win) {
  state.running = false;
  if (win) {
    resultTag.textContent = 'Вітаємо';
    resultTitle.textContent = 'Ви вижили';
    resultMessage.textContent = 'Вам вдалося зібрати всі сторінки й знайти вихід. Ліс нарешті затих.';
  } else {
    resultTag.textContent = 'Провал';
    resultTitle.textContent = 'Ліс знайшов вас';
    resultMessage.textContent = 'Slender Man був ближче, ніж ви думали. Ніч забрала вас у себе.';
  }
  endScreen.classList.remove('hidden');
}

function handleInput(dt) {
  let dx = 0;
  let dy = 0;

  if (keys.ArrowLeft || keys.a) dx -= 1;
  if (keys.ArrowRight || keys.d) dx += 1;
  if (keys.ArrowUp || keys.w) dy -= 1;
  if (keys.ArrowDown || keys.s) dy += 1;

  const sprintBoost = keys.Shift ? 1.35 : 1;

  if (dx || dy) {
    const length = Math.hypot(dx, dy) || 1;
    state.player.x += (dx / length) * state.player.speed * sprintBoost * dt;
    state.player.y += (dy / length) * state.player.speed * sprintBoost * dt;
  }

  state.player.x = Math.max(20, Math.min(canvas.width - 20, state.player.x));
  state.player.y = Math.max(20, Math.min(canvas.height - 20, state.player.y));
}

function updateBattery(dt) {
  const nearCamp = Math.hypot(state.player.x - state.campfire.x, state.player.y - state.campfire.y) < 44;

  if (nearCamp && (keys.e || keys.E)) {
    state.battery = Math.min(100, state.battery + 32 * dt);
    if (state.battery >= 100) pushLog('Фонарь повністю заряджений.');
  } else if (state.flashlightOn) {
    state.battery -= (keys.Shift ? 13 : 8.5) * dt;
  } else {
    state.battery -= 3.2 * dt;
  }

  if (state.battery <= 0) {
    state.battery = 0;
    state.flashlightOn = false;
    pushLog('Ліхтарик згас. Шепіт лісу стане гучнішим.');
  }

  if (state.battery < 25) {
    setObjective('Батарея низька — зарядь ліхтарик');
  }

  updateHud();
}

function updateSanity(dt) {
  const dist = Math.hypot(state.player.x - state.monster.x, state.player.y - state.monster.y);
  state.danger = Math.max(0, 1 - dist / 240);
  state.sanity -= (state.danger * 18 + 1.5) * dt;

  if (state.sanity <= 0) {
    state.sanity = 0;
    endGame(false);
  }

  updateHud();
}

function updatePages() {
  for (const page of state.pages) {
    if (page.collected) continue;
    const dist = Math.hypot(state.player.x - page.x, state.player.y - page.y);
    if (dist < 26) {
      page.collected = true;
      state.pageCount += 1;
      state.inventory[state.pageCount - 1] = '📄';
      renderInventory();
      if (state.pageCount >= TOTAL_PAGES) {
        state.exitGate.unlocked = true;
        setObjective('Вийди через браму');
        pushLog('Брама відчинилася. Ви готові до виходу.');
      } else {
        setObjective(`Знайдено ${state.pageCount} / ${TOTAL_PAGES}`);
        pushLog('Ще одна сторінка знайшлася.');
      }
      updateHud();
    }
  }
}

function updateMonster(dt) {
  const dist = Math.hypot(state.player.x - state.monster.x, state.player.y - state.monster.y);
  if (dist < 240) {
    const angle = Math.atan2(state.player.y - state.monster.y, state.player.x - state.monster.x);
    state.monster.x += Math.cos(angle) * 75 * dt;
    state.monster.y += Math.sin(angle) * 75 * dt;
  } else {
    state.monster.x += Math.cos(state.time * 0.7) * 12 * dt;
    state.monster.y += Math.sin(state.time * 0.9) * 10 * dt;
  }

  if (Math.hypot(state.player.x - state.monster.x, state.player.y - state.monster.y) < 28) {
    endGame(false);
  }
}

function checkExit() {
  const gate = state.exitGate;
  const insideGate =
    state.player.x > gate.x &&
    state.player.x < gate.x + gate.w &&
    state.player.y > gate.y &&
    state.player.y < gate.y + gate.h;

  if (insideGate && gate.unlocked) {
    endGame(true);
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#04080d');
  sky.addColorStop(0.35, '#12201c');
  sky.addColorStop(1, '#091d1b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const moon = ctx.createRadialGradient(1020, 110, 10, 1020, 110, 120);
  moon.addColorStop(0, 'rgba(243,245,255,0.9)');
  moon.addColorStop(0.25, 'rgba(206,216,240,0.4)');
  moon.addColorStop(1, 'rgba(206,216,240,0)');
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(1020, 110, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(15, 20, 21, 0.7)';
  ctx.fillRect(0, 620, canvas.width, 140);

  for (let i = 0; i < 40; i++) {
    const x = (i * 78 + (state.time * 14)) % (canvas.width + 60) - 30;
    const y = 80 + ((i * 59) % 400);
    const h = 90 + (i % 5) * 18;

    ctx.strokeStyle = 'rgba(15, 23, 20, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, canvas.height);
    ctx.lineTo(x, canvas.height - h);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(26, 35, 31, 0.8)';
    ctx.beginPath();
    ctx.moveTo(x - 15, canvas.height - h + 22);
    ctx.lineTo(x + 8, canvas.height - h - 16);
    ctx.moveTo(x + 18, canvas.height - h + 20);
    ctx.lineTo(x - 8, canvas.height - h - 18);
    ctx.stroke();
  }

  for (let i = 0; i < 7; i++) {
    const x = (i * 220 + state.time * 22) % (canvas.width + 200);
    const y = 120 + (i % 3) * 110 + Math.sin(state.time * 0.5 + i) * 18;
    const fog = ctx.createRadialGradient(x, y, 20, x, y, 200);
    fog.addColorStop(0, 'rgba(200,220,240,0.10)');
    fog.addColorStop(0.4, 'rgba(200,220,240,0.06)');
    fog.addColorStop(1, 'rgba(200,220,240,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(x - 180, y - 80, 360, 200);
  }

  const fireGlow = ctx.createRadialGradient(state.campfire.x, state.campfire.y, 6, state.campfire.x, state.campfire.y, 70);
  fireGlow.addColorStop(0, 'rgba(255, 200, 80, 0.9)');
  fireGlow.addColorStop(0.3, 'rgba(255, 150, 60, 0.45)');
  fireGlow.addColorStop(1, 'rgba(255, 150, 60, 0)');
  ctx.fillStyle = fireGlow;
  ctx.beginPath();
  ctx.arc(state.campfire.x, state.campfire.y, 70, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ff9d3d';
  ctx.beginPath();
  ctx.arc(state.campfire.x, state.campfire.y, 12, 0, Math.PI * 2);
  ctx.fill();

  const gate = state.exitGate;
  ctx.fillStyle = gate.unlocked ? '#7af7af' : '#3c4652';
  ctx.fillRect(gate.x, gate.y, gate.w, gate.h);
  ctx.strokeStyle = '#dfeaf6';
  ctx.strokeRect(gate.x, gate.y, gate.w, gate.h);
}

function drawPages() {
  for (const page of state.pages) {
    if (page.collected) continue;
    const bob = Math.sin(state.time * 7 + page.x) * 4;
    ctx.save();
    ctx.translate(page.x, page.y + bob);
    ctx.fillStyle = '#f2d58e';
    ctx.fillRect(-10, -14, 20, 28);
    ctx.strokeStyle = '#7d5b22';
    ctx.strokeRect(-10, -14, 20, 28);
    ctx.fillStyle = '#2f2916';
    ctx.fillText('!', 2, 2);
    ctx.restore();
  }
}

function drawMonster() {
  const { x, y } = state.monster;
  const dx = state.player.x - x;
  const dy = state.player.y - y;
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(-10, -24, 20, 48);
  ctx.strokeStyle = '#dfeaf7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(12, 90);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-18, 18);
  ctx.lineTo(8, 52);
  ctx.moveTo(18, 18);
  ctx.lineTo(-8, 52);
  ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  ctx.fillStyle = '#e6edf9';
  ctx.beginPath();
  ctx.arc(0, 0, state.player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7ee3ff';
  ctx.fillRect(-2, 12, 4, 12);
  ctx.restore();
}

function drawFlashlight() {
  const radius = state.flashlightOn ? state.flashlightRadius : 40;
  const glow = ctx.createRadialGradient(state.player.x, state.player.y, 20, state.player.x, state.player.y, radius);
  glow.addColorStop(0, 'rgba(255,255,255,0.18)');
  glow.addColorStop(0.2, 'rgba(140,180,210,0.14)');
  glow.addColorStop(1, 'rgba(0,0,0,0.9)');

  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHint() {
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '15px Arial';
  ctx.fillText('WASD / стрілки — рух', 20, canvas.height - 34);
  ctx.fillText('E — заряджати біля багаття', 250, canvas.height - 34);
  ctx.fillText('F — ліхтарик / Shift — біг', 560, canvas.height - 34);

  if (state.battery < 25) {
    ctx.fillStyle = 'rgba(255, 120, 120, 0.95)';
    ctx.fillText('ЛІХТАРИК МАЄ МАЛО БАТАРЕЇ', 20, canvas.height - 12);
  }
}

function drawDangerEffects() {
  if (state.danger < 0.2) return;

  const alpha = Math.min(0.45, state.danger * 0.5);
  ctx.fillStyle = `rgba(255, 50, 60, ${alpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const flicker = 0.05 + Math.sin(state.time * 16) * 0.04;
  ctx.fillStyle = `rgba(255,255,255,${flicker})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (Math.sin(state.time * 6) > 0.93) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function render() {
  drawBackground();
  drawPages();
  drawMonster();
  drawPlayer();
  drawFlashlight();
  drawDangerEffects();
  drawHint();
}

function gameLoop(timestamp) {
  if (!state.running) {
    render();
    requestAnimationFrame(gameLoop);
    return;
  }

  if (!state.lastTime) state.lastTime = timestamp;
  const dt = Math.min((timestamp - state.lastTime) / 1000, 0.03);
  state.lastTime = timestamp;
  state.time += dt;

  handleInput(dt);
  updateBattery(dt);
  updateSanity(dt);
  updatePages();
  updateMonster(dt);
  checkExit();
  render();

  requestAnimationFrame(gameLoop);
}

function toggleFlashlight() {
  if (!state.running) return;
  state.flashlightOn = !state.flashlightOn;
  pushLog(state.flashlightOn ? 'Ліхтарик увімкнено.' : 'Ліхтарик вимкнено.');
}

window.addEventListener('keydown', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys[key] = true;

  if (key === 'f') {
    toggleFlashlight();
  }

  if (key === 'r') {
    endScreen.classList.add('hidden');
    resetGame();
  }

  if (event.key === ' ') event.preventDefault();
});

window.addEventListener('keyup', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys[key] = false;
});

startBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  resetGame();
});

restartBtn.addEventListener('click', () => {
  endScreen.classList.add('hidden');
  resetGame();
});

renderInventory();
logEl.innerHTML = ['Ліс шепоче між деревами.', 'Туман густіє над стежкою.'].map((item) => `<li>${item}</li>`).join('');
startScreen.classList.remove('hidden');
render();
requestAnimationFrame(gameLoop);