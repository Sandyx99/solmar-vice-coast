// Keyboard and mouse input. Held keys give movement and driving; the mouse
// gives the aim point and fires while held; one-shot presses (confirm,
// pause, steal, punch) are queued as flags and taken once by the loop, so a
// press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const PUNCH = new Set(['KeyF']);

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, sprint: false };
  const mouse = { x: 0, y: 0, down: false, seen: false };
  let queued = 0;

  function press(event) {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (SPRINT.has(event.code)) held.sprint = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) queued |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) queued |= ACTION_PAUSE;
    } else if (event.code === 'KeyE') {
      if (!event.repeat) queued |= ACTION_ENTER;
    } else if (PUNCH.has(event.code)) {
      if (!event.repeat) queued |= ACTION_PUNCH;
    } else return;
    event.preventDefault();
  }

  function release(event) {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (SPRINT.has(event.code)) held.sprint = false;
  }

  window.addEventListener('keydown', press);
  window.addEventListener('keyup', release);
  // A key let go while the tab is hidden never sends keyup: drop everything.
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    held.sprint = false;
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.seen = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.seen = true;
    mouse.down = true;
    queued |= ACTION_CONFIRM;
    event.preventDefault();
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    /** The frame's controls: -1/0/1 movement, sprint, mouse aim and fire. */
    snapshot() {
      return {
        moveX: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        moveY: (held.down ? 1 : 0) - (held.up ? 1 : 0),
        sprint: held.sprint,
        shoot: mouse.down,
        mouseX: mouse.x,
        mouseY: mouse.y,
        mouseSeen: mouse.seen,
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
  };
}
