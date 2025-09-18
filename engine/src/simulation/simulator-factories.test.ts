import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDevelopmentSimulator,
  createProductionSimulator,
} from "./simulator-factories";
import { PooledVirtualDollarFactory } from "../factories";
import { UnifiedVirtualDollarFactory } from "../test-utils";
import { EventBus } from "../events/event-bus";

describe("Simulator factory helpers", () => {
  let originalPoolingEnv: string | undefined;

  beforeEach(() => {
    originalPoolingEnv = process.env.ENABLE_POOLING;
  });

  afterEach(() => {
    if (originalPoolingEnv === undefined) {
      delete process.env.ENABLE_POOLING;
    } else {
      process.env.ENABLE_POOLING = originalPoolingEnv;
    }
  });

  it("should create a development simulator with pooling enabled by default", () => {
    const assembly = createDevelopmentSimulator();

    expect(assembly.poolingEnabled).toBe(true);
    expect(process.env.ENABLE_POOLING).toBe("true");
    expect(assembly.components.virtualDollarFactory).toBeInstanceOf(
      PooledVirtualDollarFactory
    );
    expect(assembly.profile.runtime.enablePooling).toBe(true);
    expect(assembly.profile.runtime.attachDebugger).toBe(true);
    expect(assembly.profile.runtime.enableSanityMetrics).toBe(true);
  });

  it("should allow opting out of pooling in development", () => {
    const assembly = createDevelopmentSimulator({ disablePooling: true });

    expect(assembly.poolingEnabled).toBe(false);
    expect(process.env.ENABLE_POOLING).toBe("false");
    expect(assembly.components.virtualDollarFactory).toBeInstanceOf(
      UnifiedVirtualDollarFactory
    );
    expect(assembly.profile.runtime.enablePooling).toBe(false);
  });

  it("should reuse provided event bus when creating simulators", () => {
    const existingBus = new EventBus();
    const assembly = createDevelopmentSimulator({ eventBus: existingBus });

    expect(assembly.eventBus).toBe(existingBus);
  });

  it("should create a production simulator with debugger disabled", () => {
    const assembly = createProductionSimulator();

    expect(assembly.poolingEnabled).toBe(true);
    expect(process.env.ENABLE_POOLING).toBe("true");
    expect(assembly.components.virtualDollarFactory).toBeInstanceOf(
      PooledVirtualDollarFactory
    );
    expect(assembly.profile.runtime.attachDebugger).toBe(false);
    expect(assembly.profile.runtime.enablePooling).toBe(true);
  });

  it("should merge runtime overrides for production simulator", () => {
    const assembly = createProductionSimulator({
      profileOverrides: {
        runtime: {
          virtualDollarsPerPlayer: 3,
          attachDebugger: true,
        },
      },
    });

    expect(assembly.profile.runtime.virtualDollarsPerPlayer).toBe(3);
    expect(assembly.profile.runtime.attachDebugger).toBe(true);
    expect(assembly.profile.runtime.enablePooling).toBe(true);
  });
});
