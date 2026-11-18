// Keyboard and pointer input. Held keys give a move/steer vector every frame;
// one-shot presses (confirm, pause, enter car, punch, mute) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost
// and never counted twice. The mouse position is kept in screen pixels and
// turned into a world aim point by the renderer.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter', 'Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const BRAKE = new Set(['Space']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let mouse = { x: 0, y: 0, down: false };
  let mouseDownQueued = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)
      || SPRINT.has(event.code) || BRAKE.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (PUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of
  // everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.down = true;
    mouseDownQueued = true;
    event.preventDefault();
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  function has(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Move vector: x right, y down, each -1, 0 or 1. */
    move() {
      return {
        x: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
        y: (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0),
      };
    },
    sprint() {
      return has(SPRINT);
    },
    brake() {
      return has(BRAKE);
    },
    mouse() {
      return mouse;
    },
    /** True once for a fresh mouse press since the last call. */
    takeMousePress() {
      const pressed = mouseDownQueued;
      mouseDownQueued = false;
      return pressed;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
