import { CashOutStrategy, VirtualDollar } from "../types/virtual-dollar-engine";
import { EventBus } from "../events/event-bus";
import {
  EVENT_TYPES,
  PlayerCreatedEvent,
  NewRunCreatedEvent,
} from "../events/event-types";

export interface PlayerRecord {
  id: string;
  strategy: CashOutStrategy;
  initialDonation: number;
  createdAt: Date;
  activeRunIds: string[];
  totalRunsCreated: number;
}

export type PlayerRegistry = Map<string, PlayerRecord>;

export interface CreateRunRequest {
  playerId: string;
  cashOutStrategy: CashOutStrategy;
  fundingSource: "DONATION" | "WINNINGS";
}

export interface CreateActivePlayersRequest {
  count: number;
  isNew: boolean;
  playerStrategies: Partial<Record<CashOutStrategy, number>>;
  initialDonationAmount: number;
  newPlayerStartingDollars: number;
  allowancePerDay: Record<CashOutStrategy, number>;
}

export interface CreateActivePlayersDependencies {
  eventBus: EventBus;
  playerRegistry: PlayerRegistry;
  simulationTerminated: () => boolean;
  createRun: (request: CreateRunRequest) => VirtualDollar | null;
}

export async function createActivePlayers(
  request: CreateActivePlayersRequest,
  deps: CreateActivePlayersDependencies
): Promise<void> {
  const {
    count,
    isNew,
    playerStrategies,
    initialDonationAmount,
    newPlayerStartingDollars,
    allowancePerDay,
  } = request;

  const { eventBus, playerRegistry, simulationTerminated, createRun } = deps;

  if (count <= 0 || simulationTerminated()) {
    return;
  }

  const strategies = Object.keys(playerStrategies) as CashOutStrategy[];
  const weights = Object.values(playerStrategies);
  const seededAt = new Date();
  const baseIdPrefix = isNew ? "player-new" : "player-reactivated";

  for (let i = 0; i < count; i++) {
    if (simulationTerminated()) {
      break;
    }

    const playerId = `${baseIdPrefix}-${seededAt.getTime()}-${Math.random()
      .toString(36)
      .slice(2, 8)}-${i}`;

    const strategy = pickStrategy(strategies, weights);

    playerRegistry.set(playerId, {
      id: playerId,
      strategy,
      initialDonation: initialDonationAmount,
      createdAt: new Date(),
      activeRunIds: [],
      totalRunsCreated: 0,
    });

    if (simulationTerminated()) {
      playerRegistry.delete(playerId);
      return;
    }

    void eventBus
      .emit(EVENT_TYPES.PLAYER_CREATED, {
        type: EVENT_TYPES.PLAYER_CREATED,
        timestamp: new Date(),
        playerId,
        initialDonationAmount,
        cashOutStrategy: strategy,
        isNewPlayer: isNew,
      } as PlayerCreatedEvent)
      .catch((error) =>
        console.error("[PlayerCreation] Failed to emit PLAYER_CREATED:", error)
      );

    const runsToCreate = isNew
      ? newPlayerStartingDollars
      : allowancePerDay[strategy] ?? 3;

    const indices = Array.from({ length: runsToCreate }, (_, idx) => idx).sort(
      () => Math.random() - 0.5
    );

    for (let j = 0; j < indices.length; j++) {
      const delay = j * 50 + Math.random() * 20;

      setTimeout(() => {
        if (simulationTerminated()) {
          return;
        }

        const newRun = createRun({
          playerId,
          cashOutStrategy: strategy,
          fundingSource: "DONATION",
        });

        if (!newRun) {
          console.warn(
            `[PlayerCreation] Failed to create run ${indices[j] + 1}/${runsToCreate} for ${playerId}`
          );
          return;
        }

        const runCount =
          playerRegistry.get(playerId)?.totalRunsCreated ?? 1;

        void eventBus
          .emit(EVENT_TYPES.NEW_RUN_CREATED, {
            type: EVENT_TYPES.NEW_RUN_CREATED,
            timestamp: new Date(),
            playerId,
            virtualDollarId: newRun.id,
            fundingSource: "DONATION",
            cashOutStrategy: strategy,
            runCount,
          } as NewRunCreatedEvent)
          .catch((error) =>
            console.error(
              "[PlayerCreation] Failed to emit NEW_RUN_CREATED:",
              error
            )
          );
      }, delay);
    }
  }
}

function pickStrategy(
  strategies: CashOutStrategy[],
  weights: number[]
): CashOutStrategy {
  if (strategies.length === 0) {
    return CashOutStrategy.BALANCED;
  }

  const random = Math.random();
  let cumulative = 0;

  for (let i = 0; i < strategies.length; i++) {
    cumulative += weights[i] ?? 0;
    if (random <= cumulative) {
      return strategies[i];
    }
  }

  return strategies[strategies.length - 1] ?? CashOutStrategy.BALANCED;
}
