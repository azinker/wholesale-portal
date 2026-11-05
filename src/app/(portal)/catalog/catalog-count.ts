type Listener = (count: number) => void;

let live: number | null = null;
const listeners = new Set<Listener>();

export function watchAddedCount(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishAddedCount(count: number) {
  live = count;
  listeners.forEach((listener) => listener(count));
}

export function changeAddedCount(delta: number) {
  if (live === null) return;
  publishAddedCount(Math.max(0, live + delta));
}
