import { CashOutStrategy } from "../types/virtual-dollar-engine";

export interface PlayerRecord {
  id: string;
  strategy: CashOutStrategy;
  initialDonation: number;
  createdAt: Date;
  activeRunIds: string[];
  totalRunsCreated: number;
}

export type PlayerRegistry = Map<string, PlayerRecord>;

export interface DormantPlayerStore {
  take(count: number): PlayerRecord[];
  add(record: PlayerRecord): void;
  remove(playerId: string): void;
  size(): number;
}

export class InMemoryDormantPlayerStore implements DormantPlayerStore {
  private queue: PlayerRecord[] = [];

  take(count: number): PlayerRecord[] {
    if (count <= 0) {
      return [];
    }
    return this.queue.splice(0, Math.min(count, this.queue.length));
  }

  add(record: PlayerRecord): void {
    this.remove(record.id);
    this.queue.push(record);
  }

  remove(playerId: string): void {
    this.queue = this.queue.filter((entry) => entry.id !== playerId);
  }

  size(): number {
    return this.queue.length;
  }
}
