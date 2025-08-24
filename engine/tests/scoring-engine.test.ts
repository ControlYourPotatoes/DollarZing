import { ScoringEngine } from '../src/types/scoring-engine';

describe('ScoringEngine', () => {
  let scoringEngine: ScoringEngine;

  beforeEach(() => {
    scoringEngine = new ScoringEngine();
  });

  describe('Deterministic Scoring with Serial Number + Daily Seed', () => {
    it('should generate consistent scores for same serial + daily seed combination', () => {
      const serialNumber = 'A12345678B';
      const dailySeed = '2025-08-21';

      const score1 = scoringEngine.calculateScore(serialNumber, dailySeed);
      const score2 = scoringEngine.calculateScore(serialNumber, dailySeed);
      const score3 = scoringEngine.calculateScore(serialNumber, dailySeed);

      expect(score1).toBe(score2);
      expect(score2).toBe(score3);
    });

    it('should generate different scores for different serial numbers with same seed', () => {
      const dailySeed = '2025-08-21';
      const serial1 = 'A12345678B';
      const serial2 = 'C98765432D';
      const serial3 = 'F55555555Z';

      const score1 = scoringEngine.calculateScore(serial1, dailySeed);
      const score2 = scoringEngine.calculateScore(serial2, dailySeed);
      const score3 = scoringEngine.calculateScore(serial3, dailySeed);

      expect(score1).not.toBe(score2);
      expect(score2).not.toBe(score3);
      expect(score1).not.toBe(score3);
    });

    it('should generate different scores for same serial with different daily seeds', () => {
      const serialNumber = 'A12345678B';
      const seed1 = '2025-08-21';
      const seed2 = '2025-08-22';
      const seed3 = '2025-08-23';

      const score1 = scoringEngine.calculateScore(serialNumber, seed1);
      const score2 = scoringEngine.calculateScore(serialNumber, seed2);
      const score3 = scoringEngine.calculateScore(serialNumber, seed3);

      expect(score1).not.toBe(score2);
      expect(score2).not.toBe(score3);
      expect(score1).not.toBe(score3);
    });

    it('should generate scores in the range 0-1', () => {
      const testCases = [
        { serial: 'A12345678B', seed: '2025-08-21' },
        { serial: 'Z99999999A', seed: '2025-12-31' },
        { serial: 'M50000000M', seed: '2024-01-01' },
        { serial: 'B11111111C', seed: '2025-06-15' }
      ];

      testCases.forEach(({ serial, seed }) => {
        const score = scoringEngine.calculateScore(serial, seed);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it('should handle edge case serial numbers correctly', () => {
      const testCases = [
        'A00000000A', // All zeros
        'Z99999999Z', // Maximum values
        'A11111111A', // Repeated digits
        'M55555555M'  // Middle values
      ];
      const dailySeed = '2025-08-21';

      testCases.forEach(serial => {
        const score = scoringEngine.calculateScore(serial, dailySeed);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
        expect(typeof score).toBe('number');
        expect(isNaN(score)).toBe(false);
      });
    });
  });

  describe('Score Consistency Across Multiple Calculations', () => {
    it('should maintain consistency over multiple calculation sessions', () => {
      const serialNumber = 'L88888888R';
      const dailySeed = '2025-08-21';

      // First session
      const scores1 = Array.from({ length: 10 }, () => 
        scoringEngine.calculateScore(serialNumber, dailySeed)
      );

      // Create new engine instance (second session)
      const newEngine = new ScoringEngine();
      const scores2 = Array.from({ length: 10 }, () =>
        newEngine.calculateScore(serialNumber, dailySeed)
      );

      // All scores should be identical
      scores1.forEach((score, index) => {
        expect(score).toBe(scores2[index]);
      });
    });

    it('should be deterministic across engine restarts', () => {
      const testCases = [
        { serial: 'A12345678B', seed: '2025-08-21' },
        { serial: 'C98765432D', seed: '2025-08-22' },
        { serial: 'F55555555Z', seed: '2025-08-23' }
      ];

      // Calculate with first engine
      const originalScores = testCases.map(({ serial, seed }) =>
        scoringEngine.calculateScore(serial, seed)
      );

      // Calculate with new engines for each test
      const newEngineScores = testCases.map(({ serial, seed }) => {
        const newEngine = new ScoringEngine();
        return newEngine.calculateScore(serial, seed);
      });

      // Scores should be identical
      originalScores.forEach((score, index) => {
        expect(score).toBe(newEngineScores[index]);
      });
    });

    it('should maintain precision over many calculations', () => {
      const serialNumber = 'T77777777P';
      const dailySeed = '2025-08-21';
      const iterations = 1000;

      const firstScore = scoringEngine.calculateScore(serialNumber, dailySeed);
      
      for (let i = 0; i < iterations; i++) {
        const score = scoringEngine.calculateScore(serialNumber, dailySeed);
        expect(score).toBe(firstScore);
      }
    });
  });

  describe('Score Caching and Memoization', () => {
    it('should cache scores for performance', () => {
      const serialNumber = 'K66666666Q';
      const dailySeed = '2025-08-21';

      // First calculation
      const start1 = performance.now();
      const score1 = scoringEngine.calculateScore(serialNumber, dailySeed);
      const time1 = performance.now() - start1;

      // Second calculation (should be cached)
      const start2 = performance.now();
      const score2 = scoringEngine.calculateScore(serialNumber, dailySeed);
      const time2 = performance.now() - start2;

      expect(score1).toBe(score2);
      expect(time2).toBeLessThan(time1); // Cached should be faster
    });

    it('should handle cache invalidation correctly', () => {
      const serialNumber = 'V44444444X';
      const seed1 = '2025-08-21';
      const seed2 = '2025-08-22';

      const score1 = scoringEngine.calculateScore(serialNumber, seed1);
      const score2 = scoringEngine.calculateScore(serialNumber, seed2);
      
      // Different seeds should produce different scores
      expect(score1).not.toBe(score2);

      // Re-calculating with original seed should give same result
      const score3 = scoringEngine.calculateScore(serialNumber, seed1);
      expect(score1).toBe(score3);
    });

    it('should manage cache memory efficiently', () => {
      const dailySeed = '2025-08-21';
      
      // Generate many different serials
      const serials = Array.from({ length: 1000 }, (_, i) => {
        const num = i.toString().padStart(8, '0');
        return `A${num}Z`;
      });

      // Calculate scores (should be cached)
      const scores = serials.map(serial => 
        scoringEngine.calculateScore(serial, dailySeed)
      );

      // Verify all scores are valid
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });

      // Verify cache is working by recalculating
      const cachedScores = serials.map(serial =>
        scoringEngine.calculateScore(serial, dailySeed)  
      );

      scores.forEach((originalScore, index) => {
        expect(originalScore).toBe(cachedScores[index]);
      });
    });
  });

  describe('Score Comparison Functionality', () => {
    it('should compare scores correctly for game resolution', () => {
      const serial1 = 'A11111111A';
      const serial2 = 'B22222222B';
      const dailySeed = '2025-08-21';

      const result = scoringEngine.compareScores(serial1, serial2, dailySeed);
      
      expect(result).toBeDefined();
      expect(result.winner).toBeDefined();
      expect(result.loser).toBeDefined();
      expect(result.winnerScore).toBeDefined();
      expect(result.loserScore).toBeDefined();
      
      expect([serial1, serial2]).toContain(result.winner);
      expect([serial1, serial2]).toContain(result.loser);
      expect(result.winner).not.toBe(result.loser);
      expect(result.winnerScore).toBeGreaterThan(result.loserScore);
    });

    it('should handle tie-breaking deterministically', () => {
      const serial1 = 'C33333333C';
      const serial2 = 'D44444444D';
      const dailySeed = '2025-08-21';

      // Run comparison multiple times
      const results = Array.from({ length: 10 }, () =>
        scoringEngine.compareScores(serial1, serial2, dailySeed)
      );

      // All results should be identical
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.winner).toBe(firstResult.winner);
        expect(result.loser).toBe(firstResult.loser);
        expect(result.winnerScore).toBe(firstResult.winnerScore);
        expect(result.loserScore).toBe(firstResult.loserScore);
      });
    });

    it('should provide score comparison with detailed results', () => {
      const serial1 = 'E55555555E';
      const serial2 = 'F66666666F';
      const dailySeed = '2025-08-21';

      const result = scoringEngine.compareScores(serial1, serial2, dailySeed);
      
      // Verify individual scores match calculateScore results
      const score1 = scoringEngine.calculateScore(serial1, dailySeed);
      const score2 = scoringEngine.calculateScore(serial2, dailySeed);

      expect([score1, score2]).toContain(result.winnerScore);
      expect([score1, score2]).toContain(result.loserScore);

      if (score1 > score2) {
        expect(result.winner).toBe(serial1);
        expect(result.loser).toBe(serial2);
        expect(result.winnerScore).toBe(score1);
        expect(result.loserScore).toBe(score2);
      } else {
        expect(result.winner).toBe(serial2);
        expect(result.loser).toBe(serial1);
        expect(result.winnerScore).toBe(score2);
        expect(result.loserScore).toBe(score1);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should validate serial number format', () => {
      const invalidSerials = [
        'invalid',           // Wrong format
        'A1234567B',         // Too few digits
        'A123456789B',       // Too many digits
        '112345678B',        // Number as first character
        'A12345678!',        // Invalid last character
        '',                  // Empty string
        'a12345678b'         // Lowercase letters
      ];
      
      const dailySeed = '2025-08-21';

      invalidSerials.forEach(serial => {
        expect(() => {
          scoringEngine.calculateScore(serial, dailySeed);
        }).toThrow();
      });
    });

    it('should validate daily seed format', () => {
      const serialNumber = 'A12345678B';
      const invalidSeeds = [
        '',                  // Empty string
        'invalid-date',      // Invalid format
        '2025-13-01',        // Invalid month
        '2025-01-32',        // Invalid day
        '25-08-21',          // Wrong year format
        '2025/08/21'         // Wrong separator
      ];

      invalidSeeds.forEach(seed => {
        expect(() => {
          scoringEngine.calculateScore(serialNumber, seed);
        }).toThrow();
      });
    });

    it('should handle null and undefined inputs gracefully', () => {
      expect(() => {
        scoringEngine.calculateScore(null as any, '2025-08-21');
      }).toThrow();

      expect(() => {
        scoringEngine.calculateScore(undefined as any, '2025-08-21');
      }).toThrow();

      expect(() => {
        scoringEngine.calculateScore('A12345678B', null as any);
      }).toThrow();

      expect(() => {
        scoringEngine.calculateScore('A12345678B', undefined as any);
      }).toThrow();
    });

    it('should handle extreme score edge cases', () => {
      const dailySeed = '2025-08-21';
      
      // Test with potential edge case serials
      const edgeCaseSerials = [
        'A00000000A',  // All zeros
        'Z99999999Z',  // All nines with max letters
        'A12345678Z',  // First/last letter combination
        'Z87654321A'   // Reverse pattern
      ];

      edgeCaseSerials.forEach(serial => {
        const score = scoringEngine.calculateScore(serial, dailySeed);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
        expect(typeof score).toBe('number');
        expect(isNaN(score)).toBe(false);
        expect(isFinite(score)).toBe(true);
      });
    });

    it('should handle comparison with identical scores gracefully', () => {
      // Mock scenario where scores might be very close or identical
      const serial1 = 'A12345678A';
      const serial2 = 'A12345678A'; // Same serial (edge case)
      const dailySeed = '2025-08-21';

      const result = scoringEngine.compareScores(serial1, serial2, dailySeed);
      
      // Should handle identical serials deterministically
      expect(result.winner).toBeDefined();
      expect(result.loser).toBeDefined();
      expect(result.winnerScore).toBe(result.loserScore);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should perform calculations within acceptable time limits', () => {
      const serialNumber = 'P77777777Q';
      const dailySeed = '2025-08-21';

      const start = performance.now();
      
      // Perform many calculations
      for (let i = 0; i < 1000; i++) {
        scoringEngine.calculateScore(serialNumber, dailySeed);
      }
      
      const end = performance.now();
      const totalTime = end - start;
      
      // Should complete 1000 calculations in reasonable time (adjust threshold as needed)
      expect(totalTime).toBeLessThan(100); // 100ms for 1000 calculations
    });

    it('should manage memory efficiently with large cache', () => {
      const dailySeed = '2025-08-21';
      
      // Create many unique serial numbers
      const serials = Array.from({ length: 5000 }, (_, i) => {
        const num = i.toString().padStart(8, '0');
        return `A${num}B`;
      });

      // Calculate scores for all serials (should cache them)
      serials.forEach(serial => {
        scoringEngine.calculateScore(serial, dailySeed);
      });

      // Verify cached results are consistent
      serials.forEach(serial => {
        const score1 = scoringEngine.calculateScore(serial, dailySeed);
        const score2 = scoringEngine.calculateScore(serial, dailySeed);
        expect(score1).toBe(score2);
      });
    });
  });
});