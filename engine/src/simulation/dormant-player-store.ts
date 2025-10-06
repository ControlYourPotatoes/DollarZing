import type { PlayerRecord } from "./player-registry";

export interface DormantPlayerStore {
  take(count: number): PlayerRecord[];
  add(record: PlayerRecord): void;
  remove(playerId: string): void;
  size(): number;
}

export class InMemoryDormantPlayerStore implements DormantPlayerStore {
  private queue: PlayerRecord[] = [];

  take(count: number): PlayerRecord[] {
    if (count <= 0 || this.queue.length === 0) {
      return [];
    }
    return this.queue.splice(0, Math.min(count, this.queue.length));
  }

  add(record: PlayerRecord): void {
    this.remove(record.id);
    this.queue.push(record);
  }

  remove(playerId: string): void {
    if (this.queue.length === 0) {
      return;
    }
    this.queue = this.queue.filter((player) => player.id !== playerId);
  }

  size(): number {
    return this.queue.length;
  }
}
