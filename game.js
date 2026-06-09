'use strict';

const APP_VERSION = 'v41';
const MOBILE_WORLD_ZOOM = 1;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const start_screen = document.getElementById('start-screen');
const game_over_screen = document.getElementById('game-over-screen');
const start_button = document.getElementById('start-button');
const return_button = document.getElementById('return-button');
const final_score = document.getElementById('final-score');
const game_over_message = document.getElementById('game-over-message');
const param_grid = document.getElementById('param-grid');
const start_high_score = document.getElementById('start-high-score');
const game_over_high_score = document.getElementById('game-over-high-score');
const mobile_controls = document.getElementById('mobile-controls');
const mobile_rotation_pad = document.getElementById('mobile-rotation-pad');
const mobile_jump_button = document.getElementById('mobile-jump-button');
const hard_mode_toggle = document.getElementById('hard-mode-toggle');
const game_over_hard_mode_toggle = document.getElementById('game-over-hard-mode-toggle');

const default_params = {
  gravity: 1450,
  leg_length: 120,
  body_radius: 28,
  angular_accel: 7.28,
  pendulum_gravity_scale: 0.7,
  angular_damping_ground: 1.7,
  angular_damping_air: 0.14,
  max_angular_speed: 5.2,
  jump_impulse: 730,
  ground_push: 115,
  lateral_air_drag: 0.18,
  camera_lag: 0.095,
  obstacle_spacing: 290,
  obstacle_min_height: 28,
  obstacle_max_height: 92,
  obstacle_width: 72
};

const param_meta = [
  ['gravity', '중력 가속도 px/s²', 100, 4000, 10],
  ['leg_length', '포고스틱 길이 px', 50, 220, 1],
  ['body_radius', '몸통 반지름 px', 12, 55, 1],
  ['angular_accel', '방향키 회전속도 변화율 rad/s²', 0.2, 20, 0.1],
  ['pendulum_gravity_scale', '지상 중력 회전 효과 배율', 0, 3, 0.05],
  ['max_angular_speed', '회전속도 최댓값 rad/s', 0.5, 15, 0.1],
  ['angular_damping_ground', '지상 회전 감쇠 1/s', 0, 8, 0.1],
  ['angular_damping_air', '공중 회전 감쇠 1/s', 0, 3, 0.01],
  ['jump_impulse', '점프 초기속도 px/s', 100, 1600, 10],
  ['ground_push', '점프 전진 보정 px/s', 0, 500, 5],
  ['lateral_air_drag', '공중 수평 감쇠 1/s', 0, 2, 0.01],
  ['camera_lag', '카메라 추종 지연 계수', 0.01, 0.3, 0.005],
  ['obstacle_spacing', '장애물 간격 px', 160, 520, 5],
  ['obstacle_min_height', '장애물 최소 높이 px', 0, 160, 1],
  ['obstacle_max_height', '장애물 최대 높이 px', 10, 190, 1],
  ['obstacle_width', '장애물 폭 px', 25, 140, 1]
];

const params = { ...default_params };
const input_elements = new Map();

const POGO_LINE_WIDTH = 10;
const POGO_HALF_WIDTH = POGO_LINE_WIDTH * 0.5;
const FOOT_SAFE_LENGTH = 18;
function pit_bottom_y() { return canvas.height + 120; }

const penguin_sprite = new Image();
let penguin_sprite_loaded = false;
const penguin_sprite_meta = {
  pivot_x: 276,
  pivot_y: 980,
  reference_leg_length: 620
};
penguin_sprite.onload = () => { penguin_sprite_loaded = true; };
penguin_sprite.src = 'assets/penguin_pogo_simple.png';

const sea_lion_sprite = new Image();
let sea_lion_sprite_loaded = false;
const sea_lion_sprite_meta = {
  pivot_x: 406,
  pivot_y: 850,
  reference_width: 969,
  reference_height: 859
};
sea_lion_sprite.onload = () => { sea_lion_sprite_loaded = true; };
sea_lion_sprite.src = 'assets/sea_lion_simple.png';

const polar_bear_sprite = new Image();
let polar_bear_sprite_loaded = false;
const polar_bear_sprite_meta = {
  pivot_x: 754,
  pivot_y: 970,
  reference_width: 1172,
  reference_height: 979
};
polar_bear_sprite.onload = () => { polar_bear_sprite_loaded = true; };
polar_bear_sprite.src = 'assets/polar_bear_chaser.png';

let state = 'start';
let last_time = performance.now();
let keys = { left: false, right: false, space: false };
let mobile_rotation_input = 0;
let hard_mode_enabled = false;
let player;
let camera_x = 0;
let obstacles = [];
let pits = [];
let sea_lions = [];
let polar_bear = null;
let score = 0;
let normal_high_score = Number((() => { try { return localStorage.getItem('ip_runner_high_score') || '0'; } catch (_) { return '0'; } })());
let hard_high_score = Number((() => { try { return localStorage.getItem('ip_runner_hard_high_score') || '0'; } catch (_) { return '0'; } })());
let difficulty_level = 0;
let game_over_reason = '';
let audio_context = null;
let audio_enabled = false;
let audio_unlocked = false;
let bgm_started = false;
let bgm_step = 0;
let bgm_timer = null;
let last_landed_state = false;
let game_over_sound_kind = 'default';

function clamp(value, min_value, max_value) {
  return Math.max(min_value, Math.min(max_value, value));
}

function random_range(min_value, max_value) {
  return min_value + Math.random() * (max_value - min_value);
}

function ranges_overlap(a0, a1, b0, b1, margin = 0) {
  return a1 > b0 - margin && a0 < b1 + margin;
}

function has_coarse_pointer() {
  return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}

function is_mobile_layout_enabled() {
  return has_coarse_pointer();
}

function resize_canvas_to_display() {
  const mobile_layout_enabled = is_mobile_layout_enabled();
  const target_width = mobile_layout_enabled ? 554 : 960;
  const target_height = mobile_layout_enabled ? 648 : 540;
  if (canvas.width !== target_width) canvas.width = target_width;
  if (canvas.height !== target_height) canvas.height = target_height;

  const game_shell = document.getElementById('game-shell');
  if (mobile_layout_enabled) {
    const viewport_width = Math.min(window.innerWidth || target_width, document.documentElement.clientWidth || target_width);
    const display_width = Math.max(320, viewport_width);
    const display_height = Math.round(display_width * target_height / target_width);
    document.documentElement.style.setProperty('--mobile-canvas-width', `${display_width}px`);
    document.documentElement.style.setProperty('--mobile-canvas-height', `${display_height}px`);
    document.documentElement.style.setProperty('--mobile-canvas-ratio-width', `${target_width}`);
    document.documentElement.style.setProperty('--mobile-canvas-ratio-height', `${target_height}`);
    canvas.style.width = `${display_width}px`;
    canvas.style.height = `${display_height}px`;
    canvas.style.aspectRatio = `${target_width} / ${target_height}`;
    if (game_shell) {
      game_shell.style.width = `${display_width}px`;
      game_shell.style.height = '100dvh';
      game_shell.style.aspectRatio = 'auto';
    }
  } else {
    document.documentElement.style.removeProperty('--mobile-canvas-width');
    document.documentElement.style.removeProperty('--mobile-canvas-height');
    document.documentElement.style.removeProperty('--mobile-canvas-ratio-width');
    document.documentElement.style.removeProperty('--mobile-canvas-ratio-height');
    canvas.style.width = '';
    canvas.style.height = '';
    canvas.style.aspectRatio = '';
    if (game_shell) {
      game_shell.style.width = '';
      game_shell.style.height = '';
      game_shell.style.aspectRatio = '';
    }
  }
}

function mobile_pointer_to_zone(client_x) {
  if (!mobile_rotation_pad) return 0;
  const rect = mobile_rotation_pad.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  const local_x = clamp(client_x - rect.left, 0, rect.width);
  return local_x < rect.width * 0.5 ? -1 : 1;
}

function update_mobile_rotation_pad_visual() {
  if (!mobile_rotation_pad) return;
  mobile_rotation_pad.classList.toggle('left-active', mobile_rotation_input < 0);
  mobile_rotation_pad.classList.toggle('right-active', mobile_rotation_input > 0);
}

function get_rotation_control() {
  const keyboard_control = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  return clamp(keyboard_control + mobile_rotation_input, -1, 1);
}

function update_mobile_controls_visibility() {
  const mobile_layout_enabled = is_mobile_layout_enabled();
  const should_show = state === 'playing' && mobile_layout_enabled;
  const game_shell = document.getElementById('game-shell');
  if (mobile_controls) mobile_controls.classList.toggle('visible', should_show);
  if (game_shell) game_shell.classList.toggle('mobile-layout', mobile_layout_enabled);
  document.body.classList.toggle('mobile-layout-active', mobile_layout_enabled);
  requestAnimationFrame(resize_canvas_to_display);
}

function reset_mobile_rotation() {
  mobile_rotation_input = 0;
  update_mobile_rotation_pad_visual();
}

function sync_hard_toggles(source = null) {
  if (source === hard_mode_toggle && hard_mode_toggle) {
    hard_mode_enabled = hard_mode_toggle.checked;
  } else if (source === game_over_hard_mode_toggle && game_over_hard_mode_toggle) {
    hard_mode_enabled = game_over_hard_mode_toggle.checked;
  }

  if (hard_mode_toggle) hard_mode_toggle.checked = hard_mode_enabled;
  if (game_over_hard_mode_toggle) game_over_hard_mode_toggle.checked = hard_mode_enabled;
  update_high_score_display();
}


function update_version_labels() {
  document.querySelectorAll('.version-label').forEach((el) => { el.textContent = APP_VERSION; });
}

function get_current_high_score() {
  return hard_mode_enabled ? hard_high_score : normal_high_score;
}

function update_high_score_display() {
  const label = hard_mode_enabled ? 'Hard Best' : 'Best';
  const current_best = get_current_high_score();
  if (start_high_score) start_high_score.textContent = `${label} ${current_best}`;
  if (game_over_high_score) game_over_high_score.textContent = `${label} ${current_best}`;
}

function update_high_score() {
  if (hard_mode_enabled) {
    if (score > hard_high_score) {
      hard_high_score = score;
      try { localStorage.setItem('ip_runner_hard_high_score', String(hard_high_score)); } catch (_) {}
    }
  } else if (score > normal_high_score) {
    normal_high_score = score;
    try { localStorage.setItem('ip_runner_high_score', String(normal_high_score)); } catch (_) {}
  }
  update_version_labels();
  update_high_score_display();
}

function get_ground_gravity_scale() {
  return hard_mode_enabled ? params.pendulum_gravity_scale : params.pendulum_gravity_scale * 0.48;
}

function get_ground_damping() {
  return hard_mode_enabled ? params.angular_damping_ground : params.angular_damping_ground * 1.65;
}

function get_air_damping() {
  return hard_mode_enabled ? params.angular_damping_air : params.angular_damping_air * 2.2;
}

function get_lateral_air_drag() {
  return hard_mode_enabled ? params.lateral_air_drag : params.lateral_air_drag * 1.7;
}

function get_air_stabilizing_accel() {
  return hard_mode_enabled ? 3.0 : 4.8;
}

function get_air_stabilizing_damping() {
  return hard_mode_enabled ? 0.35 : 0.55;
}

function get_pit_spacing_multiplier() {
  return hard_mode_enabled ? 1 : 1.65;
}


function get_difficulty_level() {
  return Math.floor(score / 200);
}

function get_difficulty_scale() {
  return 1 + get_difficulty_level() * 0.075;
}

function normalize_angle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function base_ground_y_at(x) {
  return 445 + Math.sin(x * 0.0038) * 7 + Math.sin(x * 0.0016 + 1.2) * 12;
}

function terrain_height_step(index) {
  const raw = 34 + Math.sin(index * 1.11) * 28 + Math.sin(index * 0.37 + 0.7) * 18;
  return clamp(raw, params.obstacle_min_height, params.obstacle_max_height);
}

function ground_y_at(x) {
  return base_ground_y_at(x);
}

function initialize_audio() {
  if (audio_context) {
    audio_enabled = true;
    return audio_context;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  audio_context = new AudioCtx();
  audio_enabled = true;
  return audio_context;
}

function prime_audio_immediately(ctx) {
  if (!ctx || audio_unlocked) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    gain.gain.setValueAtTime(0.0015, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
    audio_unlocked = true;
  } catch (_) {}
}

function activate_audio_from_user_gesture() {
  const ctx = initialize_audio();
  if (!ctx) return Promise.resolve(null);

  try {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    prime_audio_immediately(ctx);
  } catch (_) {}

  const resume_promise = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
  return resume_promise.then(() => {
    prime_audio_immediately(ctx);
    return ctx;
  }).catch(() => ctx);
}

function ensure_audio_running() {
  if (audio_context && audio_context.state === 'suspended') {
    audio_context.resume().catch(() => {});
  }
}

function play_tone(type, frequency, duration, volume, ramp = 'exp') {
  if (!audio_enabled || !audio_context) return;
  if (audio_context.state === 'suspended') {
    audio_context.resume()
      .then(() => play_tone(type, frequency, duration, volume, ramp))
      .catch(() => {});
    return;
  }
  const now = audio_context.currentTime;
  const osc = audio_context.createOscillator();
  const gain = audio_context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.01);
  if (ramp === 'exp') gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  else gain.gain.linearRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(audio_context.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function play_jump_sound() {
  play_tone('square', 520, 0.08, 0.045);
  setTimeout(() => play_tone('square', 740, 0.08, 0.035), 35);
}

function play_land_sound() {
  play_tone('triangle', 220, 0.08, 0.04, 'linear');
  setTimeout(() => play_tone('triangle', 160, 0.05, 0.025, 'linear'), 25);
}

function play_game_over_sound() {
  play_tone('sawtooth', 240, 0.15, 0.045, 'linear');
  setTimeout(() => play_tone('sawtooth', 180, 0.15, 0.03, 'linear'), 90);
  setTimeout(() => play_tone('sawtooth', 120, 0.18, 0.025, 'linear'), 180);
}

function play_polar_bear_catch_sound() {
  play_tone('triangle', 210, 0.12, 0.05, 'linear');
  setTimeout(() => play_tone('triangle', 170, 0.14, 0.04, 'linear'), 70);
  setTimeout(() => play_tone('sine', 130, 0.28, 0.03, 'linear'), 150);
}

function play_start_sound() {
  play_tone('triangle', 440, 0.07, 0.03);
  setTimeout(() => play_tone('triangle', 660, 0.09, 0.035), 55);
}

function start_bgm() {
  if (!audio_enabled || bgm_started) return;
  bgm_started = true;
  const melody = [392, 440, 523, 440, 392, 330, 349, 330];
  const harmony = [196, 220, 262, 220, 196, 165, 175, 165];
  bgm_timer = setInterval(() => {
    if (!audio_enabled) return;
    ensure_audio_running();
    const note = melody[bgm_step % melody.length];
    const bass = harmony[bgm_step % harmony.length];
    play_tone('triangle', note, 0.18, 0.018);
    if (bgm_step % 2 === 0) play_tone('sine', bass, 0.24, 0.012);
    bgm_step += 1;
  }, 260);
}

function pit_at(x) {
  for (const pit of pits) {
    if (x >= pit.x && x <= pit.x + pit.width) return pit;
  }
  return null;
}

function is_in_pit(x) {
  return !!pit_at(x);
}

function surface_y_at(x) {
  let surface_y = is_in_pit(x) ? Infinity : ground_y_at(x);

  for (const obs of obstacles) {
    if (x >= obs.x && x <= obs.x + obs.width) {
      surface_y = Math.min(surface_y, obs.y);
    }
  }

  return surface_y;
}

function build_param_controls() {
  if (!param_grid) return;
  param_grid.innerHTML = '';
  input_elements.clear();

  for (const [key, label, min, max, step] of param_meta) {
    const row = document.createElement('div');
    row.className = 'param-row';

    const label_el = document.createElement('label');
    label_el.textContent = label;
    label_el.setAttribute('for', `param-${key}`);

    const input = document.createElement('input');
    input.id = `param-${key}`;
    input.type = 'number';
    input.value = params[key];
    input.min = min;
    input.max = max;
    input.step = step;
    input.addEventListener('change', () => {
      const parsed = Number(input.value);
      if (Number.isFinite(parsed)) {
        params[key] = clamp(parsed, min, max);
        input.value = params[key];
      } else {
        input.value = params[key];
      }
    });

    row.appendChild(label_el);
    row.appendChild(input);
    param_grid.appendChild(row);
    input_elements.set(key, input);
  }
}

function read_params_from_ui() {
  if (!input_elements || input_elements.size === 0) return;
  for (const [key, input] of input_elements.entries()) {
    const parsed = Number(input.value);
    if (Number.isFinite(parsed)) params[key] = parsed;
  }
  params.obstacle_max_height = Math.max(params.obstacle_max_height, params.obstacle_min_height + 5);
}

function reset_game() {
  sync_hard_toggles();
  read_params_from_ui();
  activate_audio_from_user_gesture();
  start_bgm();
  play_start_sound();

  const foot_x = 90;
  const foot_y = ground_y_at(foot_x);
  const start_angle = 0;
  player = {
    foot_x,
    foot_y,
    body_x: foot_x + Math.sin(start_angle) * params.leg_length,
    body_y: foot_y - Math.cos(start_angle) * params.leg_length,
    vx: 0,
    vy: 0,
    angle: start_angle,
    omega: 0,
    grounded: true,
    previous_grounded: true,
    jump_pressed_last: false,
    max_x: foot_x,
    jump_anim: 0,
    land_anim: 0,
    landing_torque_timer: 0,
    landing_torque_accel: 0
  };

  camera_x = 0;
  score = 0;
  difficulty_level = 0;
  game_over_reason = '';
  game_over_sound_kind = 'default';
  obstacles = generate_obstacles(0, 2600);
  pits = generate_pits(0, 2600, obstacles);
  sea_lions = [];
  sea_lions = generate_sea_lions(0, 2600);
  polar_bear = {
    x: foot_x - 780,
    y: ground_y_at(foot_x - 780),
    width: 190,
    height: 159,
    active: false,
    timer: 0,
    chase_delay: 5,
    intro_done: false,
    entrance_timer: 0,
    banner_timer: 0,
    walk_phase: 0,
    bob_phase: 0,
    opacity: 0,
    mode: 'chase',
    mode_timer: 1.2,
    y_offset: 0,
    jump_vy: 0,
    dash_flash: 0
  };
  state = 'playing';
  last_landed_state = true;
  update_mobile_controls_visibility();
  start_screen.classList.remove('visible');
  game_over_screen.classList.remove('visible');
}

function obstacle_overlaps_pit(x0, x1, pit_list) {
  return pit_list.some((pit) => ranges_overlap(x0, x1, pit.x, pit.x + pit.width, 24));
}

function obstacle_overlaps_obstacle(x0, x1, obstacle_list) {
  return obstacle_list.some((obs) => ranges_overlap(x0, x1, obs.x, obs.x + obs.width, 26));
}

function sea_lion_overlaps_blocker(x0, x1, ignore_lion = null) {
  if (obstacle_overlaps_pit(x0, x1, pits)) return true;
  if (obstacle_overlaps_obstacle(x0, x1, obstacles)) return true;
  return sea_lions.some((lion) => lion !== ignore_lion && ranges_overlap(x0, x1, lion.x - lion.width * 0.5, lion.x + lion.width * 0.5, 80));
}

function generate_pits(from_x, to_x, obstacle_list = []) {
  const list = [];
  let x = Math.max(760, from_x + random_range(520, 780));

  while (x < to_x) {
    const width = random_range(58, 122) * clamp(1 - get_difficulty_level() * 0.015, 0.82, 1);
    const overlaps_start_zone = x < 360;
    const overlaps_obstacle = obstacle_overlaps_pit(x, x + width, obstacle_list);

    if (!overlaps_start_zone && !overlaps_obstacle) {
      list.push({ x, width });
    }

    x += random_range(520, 820) * get_pit_spacing_multiplier() * clamp(1 - get_difficulty_level() * 0.025, 0.68, 1);
  }

  return list;
}

function generate_obstacles(from_x, to_x) {
  const list = [];
  let x = Math.max(520, from_x + random_range(300, 520));
  let index = obstacles.length + list.length;

  while (x < to_x) {
    const width = clamp(params.obstacle_width * random_range(0.82, 1.22), 32, 150);
    const height = random_range(params.obstacle_min_height, params.obstacle_max_height) * clamp(1 + get_difficulty_level() * 0.025, 1, 1.45);
    const base_y = ground_y_at(x + width * 0.5);

    if (!obstacle_overlaps_pit(x, x + width, pits)) {
      list.push({ x, y: base_y - height, width, height, index });
    }

    x += random_range(params.obstacle_spacing * 0.72, params.obstacle_spacing * 1.38) * clamp(1 - get_difficulty_level() * 0.018, 0.72, 1);
    index += 1;
  }

  return list;
}

function create_sea_lion(x, index) {
  const width = random_range(62, 82);
  return {
    index,
    base_x: x,
    x,
    y: ground_y_at(x) + 2,
    width,
    height: width * 0.68,
    move_range: random_range(34, 70),
    speed: random_range(0.75, 1.25) * clamp(1 + get_difficulty_level() * 0.05, 1, 1.7),
    phase: random_range(0, Math.PI * 2)
  };
}

function generate_sea_lions(from_x, to_x) {
  const list = [];
  let x = Math.max(920, from_x + random_range(680, 980));
  let index = sea_lions.length + list.length;

  while (x < to_x) {
    const width = 76;
    if (!sea_lion_overlaps_blocker(x - width, x + width)) {
      list.push(create_sea_lion(x, index));
    }

    x += random_range(780, 1180) * clamp(1 - get_difficulty_level() * 0.02, 0.72, 1);
    index += 1;
  }

  return list;
}

function update_sea_lions(dt) {
  for (const lion of sea_lions) {
    lion.phase += lion.speed * dt;
    const next_x = lion.base_x + Math.sin(lion.phase) * lion.move_range;

    if (!sea_lion_overlaps_blocker(next_x - lion.width * 0.45, next_x + lion.width * 0.45, lion)) {
      lion.x = next_x;
    }

    lion.y = ground_y_at(lion.x) + 2 + Math.sin(lion.phase * 2.1) * 2;
  }
}

function ensure_features_ahead() {
  const target = player.body_x + 4500;

  const farthest_obstacle = obstacles.length ? obstacles[obstacles.length - 1].x : 0;
  if (farthest_obstacle <= target) {
    const new_obstacles = generate_obstacles(farthest_obstacle, target + 1200);
    obstacles.push(...new_obstacles);
  }

  const farthest_pit = pits.length ? pits[pits.length - 1].x : 0;
  if (farthest_pit <= target) {
    const new_pits = generate_pits(farthest_pit, target + 1200, obstacles);
    pits.push(...new_pits);
  }

  const farthest_lion = sea_lions.length ? sea_lions[sea_lions.length - 1].base_x : 0;
  if (farthest_lion <= target) {
    const new_lions = generate_sea_lions(farthest_lion, target + 1400);
    sea_lions.push(...new_lions);
  }

  const cleanup_x = camera_x - 900;
  obstacles = obstacles.filter((obs) => obs.x + obs.width > cleanup_x);
  pits = pits.filter((pit) => pit.x + pit.width > cleanup_x);
  sea_lions = sea_lions.filter((lion) => lion.x + lion.width > cleanup_x);
}

function update_polar_bear(dt) {
  if (!polar_bear || !player) return;

  polar_bear.timer += dt;
  if (!polar_bear.active && polar_bear.timer >= polar_bear.chase_delay) {
    polar_bear.active = true;
    polar_bear.entrance_timer = 2.0;
    polar_bear.banner_timer = 2.8;
    polar_bear.x = camera_x - 260;
    polar_bear.opacity = 0;
  }
  if (!polar_bear.active) return;

  polar_bear.walk_phase += dt * (8.5 + difficulty_level * 0.25);
  polar_bear.bob_phase += dt * 5.2;
  polar_bear.banner_timer = Math.max(0, polar_bear.banner_timer - dt);
  polar_bear.entrance_timer = Math.max(0, polar_bear.entrance_timer - dt);
  polar_bear.dash_flash = Math.max(0, polar_bear.dash_flash - dt);
  polar_bear.opacity = polar_bear.entrance_timer > 0 ? Math.min(1, 1 - polar_bear.entrance_timer / 2.0 + 0.15) : 1;

  const advanced_chase = score >= 1000;
  if (advanced_chase) {
    polar_bear.mode_timer -= dt;
    if (polar_bear.mode_timer <= 0) {
      const r = Math.random();
      if (r < 0.34) {
        polar_bear.mode = 'pause';
        polar_bear.mode_timer = random_range(0.45, 0.85);
      } else if (r < 0.72) {
        polar_bear.mode = 'dash';
        polar_bear.mode_timer = random_range(0.35, 0.65);
        polar_bear.dash_flash = 0.35;
      } else {
        polar_bear.mode = 'jump';
        polar_bear.mode_timer = random_range(0.55, 0.9);
        if (polar_bear.y_offset <= 0.5) polar_bear.jump_vy = random_range(260, 340);
      }
    }
  } else {
    polar_bear.mode = 'chase';
    polar_bear.mode_timer = 1.0;
  }

  if (polar_bear.jump_vy > 0 || polar_bear.y_offset > 0) {
    polar_bear.y_offset += polar_bear.jump_vy * dt;
    polar_bear.jump_vy -= params.gravity * 0.62 * dt;
    if (polar_bear.y_offset < 0) {
      polar_bear.y_offset = 0;
      polar_bear.jump_vy = 0;
    }
  }

  const gap = player.body_x - polar_bear.x;
  if (gap > canvas.width + 520) {
    polar_bear.x = camera_x - 220;
    polar_bear.entrance_timer = 0.8;
    polar_bear.opacity = 0.65;
  }

  const target_gap = 280;
  let catchup_speed = gap > 520 ? 255 : gap > 360 ? 210 : 165;
  catchup_speed *= clamp(1 + difficulty_level * 0.035, 1, 1.55);
  if (advanced_chase && polar_bear.mode === 'pause') catchup_speed = 0;
  if (advanced_chase && polar_bear.mode === 'dash') catchup_speed += 280 + difficulty_level * 8;
  if (advanced_chase && polar_bear.mode === 'jump') catchup_speed += 65;

  const easing = gap < target_gap ? 0.72 : 1.0;
  polar_bear.x += catchup_speed * easing * dt;
  polar_bear.y = ground_y_at(polar_bear.x) + 3;
}

function polar_bear_collides() {
  if (!polar_bear || !polar_bear.active) return false;

  const bear_x = polar_bear.x;
  const bear_y = polar_bear.y - (polar_bear.y_offset || 0);
  const bear_body_cx = bear_x - polar_bear.width * 0.03;
  const bear_body_cy = bear_y - polar_bear.height * 0.45;
  const bear_r = polar_bear.height * 0.3;

  if (circle_circle_collision(player.body_x, player.body_y, params.body_radius * 0.94, bear_body_cx, bear_body_cy, bear_r)) {
    game_over_reason = '하얀 발걸음이 끝내 곁에 닿았습니다.';
    game_over_sound_kind = 'polar_bear';
    return true;
  }

  const { foot_x, foot_y } = get_player_pose();
  const dx = player.body_x - foot_x;
  const dy = player.body_y - foot_y;
  const left = bear_x - polar_bear.width * 0.46;
  const right = bear_x + polar_bear.width * 0.40;
  const top = bear_y - polar_bear.height * 0.92;
  const bottom = bear_y;
  const sample_count = Math.max(12, Math.ceil(params.leg_length / 8));
  for (let i = 1; i <= sample_count; i += 1) {
    const t = i / sample_count;
    const x = foot_x + dx * t;
    const y = foot_y + dy * t;
    if (x >= left && x <= right && y >= top && y <= bottom) {
      game_over_reason = '뒤따르던 온기가 포고스틱 끝에 닿았습니다.';
      game_over_sound_kind = 'polar_bear';
      return true;
    }
  }

  return false;
}

function leg_vector_from_angle(angle) {

  return { x: Math.sin(angle), y: -Math.cos(angle) };
}

function get_player_pose() {
  const leg = leg_vector_from_angle(player.angle);
  const foot_x = player.body_x - leg.x * params.leg_length;
  const foot_y = player.body_y - leg.y * params.leg_length;
  return { leg, foot_x, foot_y };
}

function leave_ground_if_support_missing() {
  const support_y = surface_y_at(player.foot_x);
  if (!Number.isFinite(support_y)) {
    player.grounded = false;
    player.vx = Math.sin(player.angle) * Math.abs(player.omega) * params.leg_length * 0.25;
    player.vy = 20;
    return true;
  }
  return false;
}

function update_grounded_kinematics(dt) {
  if (leave_ground_if_support_missing()) return;

  const control = get_rotation_control();
  const gravity_angular_accel = get_ground_gravity_scale() * (params.gravity / params.leg_length) * Math.sin(player.angle);
  let landing_angular_accel = 0;
  if (player.landing_torque_timer > 0) {
    const fade = player.landing_torque_timer / 0.12;
    landing_angular_accel = player.landing_torque_accel * fade;
    player.landing_torque_timer = Math.max(0, player.landing_torque_timer - dt);
  }

  player.omega += (control * params.angular_accel + gravity_angular_accel + landing_angular_accel) * dt;
  player.omega -= player.omega * get_ground_damping() * dt;
  player.omega = clamp(player.omega, -params.max_angular_speed, params.max_angular_speed);
  player.angle = normalize_angle(player.angle + player.omega * dt);

  const support_y = surface_y_at(player.foot_x);
  player.foot_y = support_y;
  const leg = leg_vector_from_angle(player.angle);
  player.body_x = player.foot_x + leg.x * params.leg_length;
  player.body_y = player.foot_y + leg.y * params.leg_length;

  if (keys.space && !player.jump_pressed_last) {
    const jump_vx = leg.x * params.jump_impulse + Math.max(0, leg.x) * params.ground_push;
    const jump_vy = leg.y * params.jump_impulse;

    player.vx = jump_vx;
    player.vy = jump_vy;
    player.grounded = false;
    player.jump_anim = 0.18;
    player.body_x += player.vx * dt * 0.5;
    player.body_y += player.vy * dt * 0.5;
    play_jump_sound();
  }
}

function update_air_kinematics(dt) {
  const control = get_rotation_control();
  const air_stabilizing_accel = -get_air_stabilizing_accel() * Math.sin(player.angle) - get_air_stabilizing_damping() * player.omega;
  player.omega += (control * params.angular_accel + air_stabilizing_accel) * dt;
  player.omega -= player.omega * get_air_damping() * dt;
  player.omega = clamp(player.omega, -params.max_angular_speed, params.max_angular_speed);
  player.angle = normalize_angle(player.angle + player.omega * dt);

  player.vy += params.gravity * dt;
  player.vx -= player.vx * get_lateral_air_drag() * dt;
  player.body_x += player.vx * dt;
  player.body_y += player.vy * dt;

  const leg = leg_vector_from_angle(player.angle);
  player.foot_x = player.body_x - leg.x * params.leg_length;
  player.foot_y = player.body_y - leg.y * params.leg_length;

  const support_y = surface_y_at(player.foot_x);
  const moving_down = player.vy > -40;
  if (Number.isFinite(support_y) && player.foot_y >= support_y && moving_down) {
    const pre_vx = player.vx;
    const pre_vy = player.vy;
    player.foot_y = support_y;
    player.body_x = player.foot_x + leg.x * params.leg_length;
    player.body_y = player.foot_y + leg.y * params.leg_length;
    const impact_speed = Math.max(0, pre_vy);
    // 착지 시 지면 반력은 몸통을 더 넘어뜨리는 방향으로 작용한다고 근사한다.
    // 따라서 부호는 지상 중력 회전 효과(g/L*sin(theta))와 항상 같은 방향이 되게 한다.
    const landing_alpha = 1.15 * (impact_speed / Math.max(params.leg_length, 1)) * Math.sin(player.angle);
    player.landing_torque_accel = clamp(landing_alpha, -18, 18);
    player.landing_torque_timer = 0.14;
    player.omega += clamp(player.landing_torque_accel * 0.045, -0.9, 0.9);
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
  }
}

function update_player(dt) {
  player.previous_grounded = player.grounded;

  if (player.grounded) update_grounded_kinematics(dt);
  else update_air_kinematics(dt);

  player.max_x = Math.max(player.max_x, player.body_x);
  score = Math.max(0, Math.floor((player.max_x - 90) / 10));
  difficulty_level = get_difficulty_level();
  update_high_score();
  player.jump_pressed_last = keys.space;

  player.jump_anim = Math.max(0, player.jump_anim - dt);
  player.land_anim = Math.max(0, player.land_anim - dt);

  if (!player.previous_grounded && player.grounded) {
    player.land_anim = 0.12;
    play_land_sound();
  }
}

function circle_rect_collision(cx, cy, radius, rect) {
  const nearest_x = clamp(cx, rect.x, rect.x + rect.width);
  const nearest_y = clamp(cy, rect.y, rect.y + rect.height);
  const dx = cx - nearest_x;
  const dy = cy - nearest_y;
  return dx * dx + dy * dy <= radius * radius;
}

function point_in_rect(x, y, rect, padding = 0) {
  return (
    x >= rect.x - padding &&
    x <= rect.x + rect.width + padding &&
    y >= rect.y - padding &&
    y <= rect.y + rect.height + padding
  );
}

function pole_collides_with_world() {
  const { foot_x, foot_y } = get_player_pose();
  const dx = player.body_x - foot_x;
  const dy = player.body_y - foot_y;
  const protected_length = Math.min(FOOT_SAFE_LENGTH, params.leg_length * 0.18);
  const start_t = clamp(protected_length / params.leg_length, 0, 0.95);
  const sample_count = Math.max(10, Math.ceil((params.leg_length - protected_length) / 8));

  for (let i = 0; i <= sample_count; i += 1) {
    const t = start_t + (1 - start_t) * (i / sample_count);
    const x = foot_x + dx * t;
    const y = foot_y + dy * t;

    if (!is_in_pit(x) && y + POGO_HALF_WIDTH >= ground_y_at(x)) return true;

    for (const obs of obstacles) {
      if (obs.x > x + 100) break;
      if (obs.x + obs.width < x - 100) continue;
      if (point_in_rect(x, y, obs, POGO_HALF_WIDTH - 1)) return true;
    }
  }

  return false;
}

function circle_circle_collision(x1, y1, r1, x2, y2, r2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy <= (r1 + r2) * (r1 + r2);
}

function sea_lion_collides() {
  const { foot_x, foot_y } = get_player_pose();
  const dx = player.body_x - foot_x;
  const dy = player.body_y - foot_y;

  for (const lion of sea_lions) {
    const left = lion.x - lion.width * 0.42;
    const right = lion.x + lion.width * 0.42;
    const top = lion.y - lion.height * 0.96;
    const bottom = lion.y;
    const cx = lion.x;
    const cy = lion.y - lion.height * 0.55;
    const cr = lion.height * 0.42;

    if (circle_circle_collision(player.body_x, player.body_y, params.body_radius * 0.92, cx, cy, cr)) {
      game_over_reason = '남극 친구와 너무 가까운 인사를 나눴습니다.';
      return true;
    }

    if (foot_x >= left && foot_x <= right && foot_y >= top && foot_y <= bottom + 4) {
      game_over_reason = '남극 친구의 낮잠을 살짝 깨웠습니다.';
      return true;
    }

    const sample_count = Math.max(10, Math.ceil(params.leg_length / 8));
    for (let i = 1; i <= sample_count; i += 1) {
      const t = i / sample_count;
      const x = foot_x + dx * t;
      const y = foot_y + dy * t;
      if (x >= left && x <= right && y >= top && y <= bottom) {
        game_over_reason = '남극 친구의 길을 잠시 어지럽혔습니다.';
        return true;
      }
    }
  }

  return false;
}

function check_collisions() {
  if (!is_in_pit(player.body_x)) {
    const body_bottom_ground = ground_y_at(player.body_x);
    if (player.body_y + params.body_radius >= body_bottom_ground) {
      game_over_reason = '눈밭에 작은 쉼표를 찍었습니다.';
      return true;
    }
  }

  for (const obs of obstacles) {
    if (obs.x + obs.width < player.body_x - params.body_radius - 110) continue;
    if (obs.x > player.body_x + params.body_radius + 110) break;
    if (circle_rect_collision(player.body_x, player.body_y, params.body_radius, obs)) {
      game_over_reason = '얼음 언덕이 오늘은 조금 높았네요.';
      return true;
    }
  }

  // 지형/고정 장애물에는 포고스틱이 닿아도 허용하고, 동물 캐릭터 접촉은 기존처럼 게임오버로 처리한다.
  if (sea_lion_collides()) return true;
  if (polar_bear_collides()) return true;

  const active_pit = pit_at(player.foot_x) || pit_at(player.body_x);
  if (active_pit && (player.foot_y > ground_y_at(active_pit.x) + 55 || player.body_y > ground_y_at(active_pit.x) + 80)) {
    game_over_reason = '푸른 틈 사이로 발자국이 사라졌습니다.';
    return true;
  }

  if (player.body_y > pit_bottom_y() || player.body_y < -900 || player.body_x < camera_x - 400) {
    game_over_reason = '하얀 바람 속으로 멀어졌습니다.';
    return true;
  }

  return false;
}

function update_camera(dt) {
  const target = Math.max(0, player.body_x - canvas.width * 0.38);
  const alpha = 1 - Math.pow(1 - clamp(params.camera_lag, 0.01, 0.35), dt * 60);
  camera_x += (target - camera_x) * alpha;
}

function draw_round_rect(x, y, w, h, r) {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function draw_background() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#86c9ff');
  sky.addColorStop(0.58, '#d9f1ff');
  sky.addColorStop(1, '#eefcff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255, 247, 200, 0.92)';
  ctx.beginPath();
  ctx.arc(canvas.width - 115, 80, 36, 0, Math.PI * 2);
  ctx.fill();

  draw_parallax_snow_hills(0.11, 355, 28, '#dbeffc');
  draw_parallax_snow_hills(0.2, 392, 40, '#c7e7fb');
  draw_ice_mountains();

  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  for (let i = 0; i < 7; i += 1) {
    const x = ((i * 240 - camera_x * 0.2) % 1280 + 1280) % 1280 - 150;
    const y = 54 + Math.sin(i * 1.5) * 18;
    draw_cloud(x, y, 0.85 + (i % 3) * 0.16);
  }

  for (let i = 0; i < 16; i += 1) {
    const x = ((i * 83 - camera_x * 0.08) % 1080 + 1080) % 1080;
    const y = 20 + (i % 5) * 24;
    draw_snowflake(x, y, 0.7 + (i % 3) * 0.25);
  }
}

function draw_parallax_snow_hills(parallax, baseline, amplitude, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  for (let sx = -60; sx <= canvas.width + 60; sx += 24) {
    const world_x = sx + camera_x * parallax;
    const y = baseline + Math.sin(world_x * 0.006) * amplitude + Math.sin(world_x * 0.0023 + 1) * amplitude * 0.65;
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(canvas.width + 80, canvas.height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function draw_ice_mountains() {
  ctx.save();
  ctx.fillStyle = '#b7ddf8';
  ctx.beginPath();
  ctx.moveTo(60, 320);
  ctx.lineTo(150, 210);
  ctx.lineTo(240, 320);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(670, 335);
  ctx.lineTo(760, 215);
  ctx.lineTo(850, 335);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e9f8ff';
  ctx.beginPath();
  ctx.moveTo(134, 230);
  ctx.lineTo(150, 210);
  ctx.lineTo(168, 235);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(742, 242);
  ctx.lineTo(760, 215);
  ctx.lineTo(781, 247);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function draw_cloud(x, y, scale) {
  ctx.beginPath();
  ctx.arc(x, y, 18 * scale, 0, Math.PI * 2);
  ctx.arc(x + 22 * scale, y - 8 * scale, 24 * scale, 0, Math.PI * 2);
  ctx.arc(x + 50 * scale, y, 18 * scale, 0, Math.PI * 2);
  ctx.rect(x - 2 * scale, y, 55 * scale, 17 * scale);
  ctx.fill();
}

function draw_snowflake(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i += 1) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, -5 * scale);
    ctx.lineTo(0, 5 * scale);
    ctx.stroke();
  }
  ctx.restore();
}

function draw_terrain() {
  ctx.save();
  ctx.translate(-camera_x, 0);

  const start_x = Math.floor(camera_x / 24) * 24 - 72;
  const end_x = camera_x + canvas.width + 90;

  draw_snow_ground_segments(start_x, end_x);
  draw_pits(start_x, end_x);
  draw_snow_caps(start_x, end_x);
  draw_ground_crystals(start_x, end_x);
  ctx.restore();
}

function draw_snow_ground_segments(start_x, end_x) {
  let segment_start = start_x;

  for (const pit of pits) {
    if (pit.x + pit.width < start_x || pit.x > end_x) continue;
    draw_ground_segment(segment_start, pit.x);
    segment_start = pit.x + pit.width;
  }

  draw_ground_segment(segment_start, end_x);
}

function draw_ground_segment(x0, x1) {
  if (x1 <= x0) return;

  ctx.fillStyle = '#b8d7ee';
  ctx.beginPath();
  ctx.moveTo(x0, canvas.height + 120);
  for (let x = x0; x <= x1; x += 12) ctx.lineTo(x, ground_y_at(x));
  ctx.lineTo(x1, canvas.height + 120);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ecfbff';
  ctx.beginPath();
  ctx.moveTo(x0, canvas.height + 120);
  for (let x = x0; x <= x1; x += 12) ctx.lineTo(x, ground_y_at(x) - 8);
  ctx.lineTo(x1, canvas.height + 120);
  ctx.closePath();
  ctx.fill();
}

function draw_snow_caps(start_x, end_x) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  let drawing = false;
  ctx.beginPath();
  for (let x = start_x; x <= end_x; x += 12) {
    if (is_in_pit(x)) {
      drawing = false;
      continue;
    }
    const y = ground_y_at(x) - 1;
    if (!drawing) {
      ctx.moveTo(x, y);
      drawing = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

function draw_ground_crystals(start_x, end_x) {
  for (let x = Math.floor(start_x / 120) * 120; x <= end_x; x += 120) {
    if (is_in_pit(x)) continue;
    const y = ground_y_at(x);
    ctx.fillStyle = '#d5f4ff';
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x + 7, y - 20);
    ctx.lineTo(x + 14, y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#9ed7f2';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function draw_pits(start_x, end_x) {
  for (const pit of pits) {
    if (pit.x + pit.width < start_x || pit.x > end_x) continue;
    const left_y = ground_y_at(pit.x);
    const right_y = ground_y_at(pit.x + pit.width);

    ctx.fillStyle = '#0b1d35';
    ctx.beginPath();
    ctx.moveTo(pit.x, left_y);
    ctx.lineTo(pit.x + pit.width, right_y);
    ctx.lineTo(pit.x + pit.width, canvas.height + 140);
    ctx.lineTo(pit.x, canvas.height + 140);
    ctx.closePath();
    ctx.fill();

    const glow = ctx.createLinearGradient(0, left_y, 0, canvas.height + 120);
    glow.addColorStop(0, 'rgba(72, 187, 255, 0.35)');
    glow.addColorStop(1, 'rgba(7, 28, 58, 0.9)');
    ctx.fillStyle = glow;
    ctx.fillRect(pit.x, Math.min(left_y, right_y), pit.width, canvas.height + 140);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(pit.x, left_y);
    ctx.lineTo(pit.x + 10, left_y + 14);
    ctx.moveTo(pit.x + pit.width, right_y);
    ctx.lineTo(pit.x + pit.width - 10, right_y + 14);
    ctx.stroke();
  }
}

function draw_obstacles() {
  ctx.save();
  ctx.translate(-camera_x, 0);
  for (const obs of obstacles) {
    if (obs.x + obs.width < camera_x - 80 || obs.x > camera_x + canvas.width + 80) continue;

    ctx.fillStyle = '#ccecff';
    draw_round_rect(obs.x, obs.y + 6, obs.width, obs.height - 6, 12);
    ctx.fill();

    ctx.fillStyle = '#effcff';
    draw_round_rect(obs.x - 2, obs.y - 8, obs.width + 4, 16, 10);
    ctx.fill();

    ctx.strokeStyle = '#86c5ea';
    ctx.lineWidth = 3;
    draw_round_rect(obs.x, obs.y + 6, obs.width, obs.height - 6, 12);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(obs.x + 8, obs.y + 18);
    ctx.lineTo(obs.x + obs.width - 8, obs.y + 18);
    ctx.moveTo(obs.x + 12, obs.y + 34);
    ctx.lineTo(obs.x + obs.width - 16, obs.y + 34);
    ctx.stroke();

    if (obs.width > 56) {
      ctx.fillStyle = '#dff7ff';
      ctx.beginPath();
      ctx.moveTo(obs.x + obs.width * 0.5, obs.y - 4);
      ctx.lineTo(obs.x + obs.width * 0.5 + 8, obs.y - 18);
      ctx.lineTo(obs.x + obs.width * 0.5 + 16, obs.y - 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#90d2f0';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function draw_penguin_fallback(scale_body_radius, leg_length, grounded) {
  const body_r = scale_body_radius;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(0, body_r * 0.7);
  ctx.lineTo(0, leg_length - 16);
  ctx.stroke();

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 12; i += 1) {
    const y = body_r + 10 + i * 4;
    const x = i % 2 === 0 ? -7 : 7;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = grounded ? '#3b82f6' : '#60a5fa';
  ctx.beginPath();
  ctx.roundRect(-14, leg_length - 10, 28, 14, 6);
  ctx.fill();

  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.ellipse(0, 0, body_r, body_r * 1.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fffdf4';
  ctx.beginPath();
  ctx.ellipse(2, 4, body_r * 0.66, body_r * 0.82, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111827';
  ctx.fillRect(5, -10, 4, 14);
  ctx.fillRect(16, -10, 4, 14);
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(25, -2);
  ctx.lineTo(38, 2);
  ctx.lineTo(26, 8);
  ctx.closePath();
  ctx.fill();
}

function draw_polar_bear() {
  if (!polar_bear || !polar_bear.active) return;
  const x = polar_bear.x;
  const y = polar_bear.y - (polar_bear.y_offset || 0);
  const width = polar_bear.width;
  const scale = width / polar_bear_sprite_meta.reference_width;
  const bob = Math.sin(polar_bear.bob_phase) * 3.5;
  const tilt = Math.sin(polar_bear.walk_phase * 0.5) * 0.04;
  const alpha = clamp(polar_bear.opacity, 0, 1);
  const dash_stretch = polar_bear.dash_flash > 0 ? 1 + polar_bear.dash_flash * 0.18 : 1;

  ctx.save();
  ctx.translate(-camera_x + x, y + bob);
  ctx.globalAlpha = alpha * 0.18;
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.ellipse(0, 2, width * 0.34, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  const paw_offsets = [-56, -18, 20, 58];
  for (let i = 0; i < paw_offsets.length; i += 1) {
    const phase = polar_bear.walk_phase + i * Math.PI * 0.5;
    const lift = Math.max(0, Math.sin(phase)) * 6;
    const stride = Math.cos(phase) * 5;
    ctx.globalAlpha = alpha * (0.58 + Math.max(0, Math.sin(phase)) * 0.22);
    ctx.fillStyle = '#eff6ff';
    ctx.beginPath();
    ctx.ellipse(paw_offsets[i] + stride, -3 - lift, 12, 7, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  if (polar_bear.entrance_timer > 0) {
    const snow_alpha = Math.min(1, polar_bear.entrance_timer / 2.0);
    ctx.globalAlpha = alpha * 0.45 * snow_alpha;
    for (let i = 0; i < 16; i += 1) {
      const tx = -110 - i * 10 + Math.sin(i * 0.9 + polar_bear.walk_phase) * 3;
      const ty = -12 - (i % 4) * 7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tx, ty, 2 + (i % 3) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = alpha;
  ctx.scale(dash_stretch, 1);
  ctx.rotate(tilt);
  if (polar_bear_sprite_loaded) {
    ctx.drawImage(
      polar_bear_sprite,
      -polar_bear_sprite_meta.pivot_x * scale,
      -polar_bear_sprite_meta.pivot_y * scale,
      polar_bear_sprite.width * scale,
      polar_bear_sprite.height * scale
    );
  } else {
    ctx.fillStyle = '#f3f4f6';
    ctx.beginPath();
    ctx.ellipse(0, -35, width * 0.48, width * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw_polar_bear_intro() {
  if (!polar_bear || !polar_bear.active || polar_bear.banner_timer <= 0) return;
  const t = polar_bear.banner_timer;
  const alpha = t > 2.1 ? (2.8 - t) / 0.7 : Math.min(1, t / 0.8);
  const mobile = is_mobile_layout_enabled();
  const box_width = mobile ? Math.min(canvas.width - 42, 640) : 420;
  const box_height = mobile ? 64 : 48;
  const box_x = canvas.width * 0.5 - box_width * 0.5;
  const box_y = mobile ? 76 : 84;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1) * 0.95;
  ctx.fillStyle = 'rgba(8, 23, 45, 0.66)';
  ctx.beginPath();
  ctx.roundRect(box_x, box_y, box_width, box_height, mobile ? 22 : 18);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.font = mobile ? 'bold 25px Arial' : 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('어느새, 하얀 발걸음이 뒤를 잇습니다.', canvas.width * 0.5, box_y + box_height * 0.5 + 1);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function draw_penguin_sprite(foot_x, foot_y, angle, leg_length, alpha = 1, squash = 0) {

  if (!penguin_sprite_loaded) return false;
  const scale = leg_length / penguin_sprite_meta.reference_leg_length;
  const y_scale = 1 - squash;
  const x_scale = 1 + squash * 0.35;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(-camera_x + foot_x, foot_y);
  ctx.rotate(angle);
  ctx.scale(x_scale, y_scale);
  ctx.drawImage(
    penguin_sprite,
    -penguin_sprite_meta.pivot_x * scale,
    -penguin_sprite_meta.pivot_y * scale,
    penguin_sprite.width * scale,
    penguin_sprite.height * scale
  );
  ctx.restore();
  return true;
}

function draw_sea_lion_sprite(x, y, width, alpha = 1) {
  const scale = width / sea_lion_sprite_meta.reference_width;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(-camera_x + x, y);
  if (sea_lion_sprite_loaded) {
    ctx.drawImage(
      sea_lion_sprite,
      -sea_lion_sprite_meta.pivot_x * scale,
      -sea_lion_sprite_meta.pivot_y * scale,
      sea_lion_sprite.width * scale,
      sea_lion_sprite.height * scale
    );
  } else {
    ctx.fillStyle = '#8b5e3c';
    ctx.beginPath();
    ctx.ellipse(0, -18, width * 0.5, width * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw_sea_lions() {
  for (const lion of sea_lions) {
    if (lion.x + lion.width < camera_x - 80 || lion.x - lion.width > camera_x + canvas.width + 80) continue;
    draw_sea_lion_sprite(lion.x, lion.y, lion.width);
  }
}

function draw_player() {
  const { foot_x, foot_y } = get_player_pose();
  let squash = 0;
  if (player.jump_anim > 0) {
    const phase = 1 - player.jump_anim / 0.18;
    squash = Math.max(0, 0.13 * Math.sin(Math.min(phase, 0.7) / 0.7 * Math.PI));
  } else if (player.land_anim > 0) {
    const phase = 1 - player.land_anim / 0.12;
    squash = Math.max(0, 0.08 * Math.sin(phase * Math.PI));
  }

  if (draw_penguin_sprite(foot_x, foot_y, player.angle, params.leg_length, 1, squash)) return;

  ctx.save();
  ctx.translate(-camera_x + player.body_x, player.body_y);
  ctx.rotate(player.angle);
  ctx.scale(1 + squash * 0.3, 1 - squash);
  draw_penguin_fallback(params.body_radius, params.leg_length, player.grounded);
  ctx.restore();
}

function draw_hud() {
  const mobile = is_mobile_layout_enabled();
  const panel_w = mobile ? 248 : 183;
  const panel_h = mobile ? 86 : 64;
  const panel_x = canvas.width - panel_w - (mobile ? 18 : 22);
  const panel_y = mobile ? 16 : 18;
  const score_font = mobile ? 34 : 24;
  const best_font = mobile ? 20 : 14;
  const right_x = canvas.width - (mobile ? 34 : 36);

  ctx.fillStyle = 'rgba(8, 23, 45, 0.72)';
  ctx.beginPath();
  ctx.roundRect(panel_x, panel_y, panel_w, panel_h, mobile ? 22 : 16);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.font = `bold ${score_font}px Arial`;
  ctx.textAlign = 'right';
  ctx.fillText(`Score ${score}`, right_x, panel_y + (mobile ? 39 : 29));
  ctx.font = `bold ${best_font}px Arial`;
  ctx.fillStyle = '#bae6fd';
  ctx.fillText(`${hard_mode_enabled ? 'Hard ' : 'Best '}${get_current_high_score()}`, right_x, panel_y + (mobile ? 68 : 50));

  if (hard_mode_enabled) {
    ctx.textAlign = 'left';
    ctx.font = mobile ? 'bold 18px Arial' : 'bold 13px Arial';
    ctx.fillStyle = 'rgba(248, 250, 252, 0.42)';
    ctx.fillText('HARD MODE', mobile ? 18 : 20, mobile ? 28 : 116);
  }
}

function draw_start_preview() {
  if (state !== 'start') return;
  const preview_foot_x = 120;
  const preview_foot_y = 416;
  const preview_angle = -0.32;

  if (draw_penguin_sprite(preview_foot_x, preview_foot_y, preview_angle, 118, 0.96)) return;

  ctx.save();
  ctx.translate(165, 308);
  ctx.rotate(preview_angle);
  ctx.globalAlpha = 0.95;
  draw_penguin_fallback(28, 118, true);
  ctx.restore();
}

function draw_world_scene() {
  draw_background();
  draw_terrain();
  draw_obstacles();
  draw_polar_bear();
  draw_sea_lions();
  if (player) draw_player();
  if (state === 'start') draw_start_preview();
}

function draw() {
  resize_canvas_to_display();
  const mobile_zoom = is_mobile_layout_enabled() ? MOBILE_WORLD_ZOOM : 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (mobile_zoom !== 1) {
    ctx.save();
    ctx.scale(mobile_zoom, mobile_zoom);
    draw_world_scene();
    ctx.restore();
  } else {
    draw_world_scene();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (state === 'playing' && player) {
    draw_hud();
    draw_polar_bear_intro();
  }
}

function end_game() {
  update_high_score();
  state = 'game_over';
  update_mobile_controls_visibility();
  reset_mobile_rotation();
  if (game_over_sound_kind === 'polar_bear') play_polar_bear_catch_sound();
  else play_game_over_sound();
  if (final_score) final_score.textContent = `Score: ${score}`;
  if (game_over_message) game_over_message.textContent = game_over_reason;
  sync_hard_toggles();
  game_over_screen.classList.add('visible');
}

function return_to_start_screen() {
  update_version_labels();
update_high_score_display();
  state = 'start';
  update_mobile_controls_visibility();
  reset_mobile_rotation();
  game_over_screen.classList.remove('visible');
  start_screen.classList.add('visible');
  keys.space = false;
  for (const [key, input] of input_elements.entries()) input.value = params[key];
}

function game_loop(now) {
  const raw_dt = (now - last_time) / 1000;
  const dt = Math.min(raw_dt, 1 / 30);
  last_time = now;

  if (state === 'playing') {
    ensure_features_ahead();
    update_sea_lions(dt);
    update_player(dt);
    update_polar_bear(dt);
    update_camera(dt);
    if (check_collisions()) end_game();
  }

  draw();
  requestAnimationFrame(game_loop);
}

window.addEventListener('keydown', (event) => {
  activate_audio_from_user_gesture();

  if (event.code === 'ArrowLeft') keys.left = true;
  if (event.code === 'ArrowRight') keys.right = true;
  if (event.code === 'Space') {
    if (event.repeat) {
      event.preventDefault();
      return;
    }

    if (state === 'start') reset_game();
    else if (state === 'game_over') reset_game();
    else keys.space = true;

    event.preventDefault();
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowLeft') keys.left = false;
  if (event.code === 'ArrowRight') keys.right = false;
  if (event.code === 'Space') keys.space = false;
});

start_button.addEventListener('click', () => {
  activate_audio_from_user_gesture();
  reset_game();
});
return_button.addEventListener('click', () => {
  activate_audio_from_user_gesture();
  reset_game();
});


if (hard_mode_toggle) {
  hard_mode_toggle.addEventListener('change', () => {
    sync_hard_toggles(hard_mode_toggle);
    update_mobile_controls_visibility();
  });
}

if (game_over_hard_mode_toggle) {
  game_over_hard_mode_toggle.addEventListener('change', () => {
    sync_hard_toggles(game_over_hard_mode_toggle);
    update_mobile_controls_visibility();
  });
}

if (mobile_rotation_pad) {
  const set_rotation_from_event = (event) => {
    activate_audio_from_user_gesture();
    const point = event.touches && event.touches.length ? event.touches[0] : event;
    mobile_rotation_input = mobile_pointer_to_zone(point.clientX);
    update_mobile_rotation_pad_visual();
    event.preventDefault();
  };

  const release_rotation = (event) => {
    reset_mobile_rotation();
    if (event) event.preventDefault();
  };

  mobile_rotation_pad.addEventListener('pointerdown', set_rotation_from_event);
  mobile_rotation_pad.addEventListener('pointermove', (event) => {
    if (event.buttons || event.pointerType === 'touch') set_rotation_from_event(event);
  });
  mobile_rotation_pad.addEventListener('pointerup', release_rotation);
  mobile_rotation_pad.addEventListener('pointercancel', release_rotation);
  mobile_rotation_pad.addEventListener('pointerleave', release_rotation);
  mobile_rotation_pad.addEventListener('touchstart', set_rotation_from_event, { passive: false });
  mobile_rotation_pad.addEventListener('touchmove', set_rotation_from_event, { passive: false });
  mobile_rotation_pad.addEventListener('touchend', release_rotation, { passive: false });
}


if (mobile_jump_button) {
  const press_jump = (event) => {
    activate_audio_from_user_gesture();
    if (state === 'start') reset_game();
    else if (state === 'game_over') reset_game();
    else keys.space = true;
    event.preventDefault();
  };

  const release_jump = (event) => {
    keys.space = false;
    event.preventDefault();
  };

  mobile_jump_button.addEventListener('pointerdown', press_jump);
  mobile_jump_button.addEventListener('pointerup', release_jump);
  mobile_jump_button.addEventListener('pointercancel', release_jump);
  mobile_jump_button.addEventListener('touchstart', press_jump, { passive: false });
  mobile_jump_button.addEventListener('touchend', release_jump, { passive: false });
}

window.addEventListener('pointerdown', () => { activate_audio_from_user_gesture(); }, { passive: true });
window.addEventListener('touchstart', () => { activate_audio_from_user_gesture(); }, { passive: true });

window.addEventListener('resize', () => { update_mobile_controls_visibility(); resize_canvas_to_display(); });
window.addEventListener('orientationchange', () => { setTimeout(() => { update_mobile_controls_visibility(); resize_canvas_to_display(); }, 120); });

update_version_labels();
update_high_score_display();
build_param_controls();
update_mobile_controls_visibility();
resize_canvas_to_display();
draw();
requestAnimationFrame(game_loop);
