/** Binary min-heap of the events of a sequence, by time then insertion order (deterministic). */

export type QueuedItem = { time: number; order: number };

export class EventQueue<T extends QueuedItem> {
  private readonly heap: T[] = [];

  push(event: T): void {
    const heap = this.heap;
    heap.push(event);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!before(heap[i]!, heap[parent]!)) break;
      [heap[i], heap[parent]] = [heap[parent]!, heap[i]!];
      i = parent;
    }
  }

  pop(): T | undefined {
    const heap = this.heap;
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0 && last) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < heap.length && before(heap[left]!, heap[smallest]!)) smallest = left;
        if (right < heap.length && before(heap[right]!, heap[smallest]!)) smallest = right;
        if (smallest === i) break;
        [heap[i], heap[smallest]] = [heap[smallest]!, heap[i]!];
        i = smallest;
      }
    }
    return top;
  }
}

function before(a: QueuedItem, b: QueuedItem): boolean {
  return a.time < b.time || (a.time === b.time && a.order < b.order);
}
