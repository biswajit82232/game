export const SERVER_PORT = 3001;
export const TICK_RATE = 15;
export const TICK_DT = 1 / TICK_RATE;

export const WALK_SPEED = 3.4;
export const SPRINT_SPEED = 5.8;
export const WATCHER_FLY_SPEED = 5.2;
export const PLAYER_RADIUS = 0.38;
export const PLAYER_HEIGHT = 1.7;
export const INTERACT_RANGE = 2.1;

export const MAX_STAMINA = 100;
export const STAMINA_DRAIN = 22;
export const STAMINA_REGEN = 14;

export const MAX_BATTERY = 100;
export const BATTERY_DRAIN = 1.45;
export const BATTERY_PICKUP = 50;

export const MAX_ENERGY = 100;
export const MODE_SWITCH_COST = 18;
export const ENERGY_REGEN = 7;
export const MODE_COOLDOWN = 1.4;

export const MAX_HEALTH = 100;

export const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;

export const BEHIND_EVENT_DURATION = 4.2;
export const BEHIND_EVENT_MIN_INTERVAL = 18;
/** Must face within this many radians of the rear to count as looking back. */
export const BEHIND_LOOK_ANGLE = 0.32;
/** Hold that facing this long before it counts (stops stick/mouse twitch kills). */
export const BEHIND_LOOK_HOLD = 0.7;
/** Hunt catches are ignored until this many seconds into a round. */
export const HUNT_GRACE_SECONDS = 55;

export const TRUST_START = 100;
