// ScoringEngine Implementation
// Handles deterministic scoring based on serial numbers + daily seeds
// Provides score comparison functionality for game resolution
/**
 * ScoringEngine - Deterministic scoring system for virtual dollars
 * Uses serial number + daily seed for consistent, repeatable score generation
 */
export class ScoringEngine {
    scoreCache = new Map();
    /**
     * Simple deterministic hash function for consistent scoring
     * Uses a combination of string hashing and mathematical operations
     */
    hashString(str) {
        let hash = 0;
        if (str.length === 0)
            return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
    /**
     * Generate a normalized score (0-1) from hash value
     */
    normalizeScore(hash) {
        // Use multiple hash operations for better distribution
        const hash1 = this.hashString(hash.toString());
        const hash2 = this.hashString((hash * 31).toString());
        const hash3 = this.hashString((hash1 * hash2).toString());
        // Combine hashes for better distribution
        const combined = (hash1 + hash2 + hash3) % 1000000;
        // Normalize to 0-1 range
        return combined / 1000000;
    }
    /**
     * Validate serial number format (letter + 8 digits + letter)
     */
    validateSerialNumber(serialNumber) {
        const errors = [];
        if (!serialNumber) {
            errors.push('Serial number cannot be null or empty');
            return { isValid: false, errors, warnings: [] };
        }
        if (typeof serialNumber !== 'string') {
            errors.push('Serial number must be a string');
            return { isValid: false, errors, warnings: [] };
        }
        const serialPattern = /^[A-Z]\d{8}[A-Z]$/;
        if (!serialPattern.test(serialNumber)) {
            errors.push('Serial number must follow format: letter + 8 digits + letter (e.g., A12345678B)');
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings: []
        };
    }
    /**
     * Validate daily seed format (YYYY-MM-DD)
     */
    validateDailySeed(dailySeed) {
        const errors = [];
        if (!dailySeed) {
            errors.push('Daily seed cannot be null or empty');
            return { isValid: false, errors, warnings: [] };
        }
        if (typeof dailySeed !== 'string') {
            errors.push('Daily seed must be a string');
            return { isValid: false, errors, warnings: [] };
        }
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (!datePattern.test(dailySeed)) {
            errors.push('Daily seed must follow format: YYYY-MM-DD');
            return { isValid: false, errors, warnings: [] };
        }
        // Validate actual date
        const [year, month, day] = dailySeed.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day) {
            errors.push('Daily seed must be a valid date');
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings: []
        };
    }
    /**
     * Generate cache key for memoization
     */
    getCacheKey(serialNumber, dailySeed) {
        return `${serialNumber}:${dailySeed}`;
    }
    /**
     * Calculate deterministic score for a serial number + daily seed combination
     * Returns a normalized score between 0 and 1
     */
    calculateScore(serialNumber, dailySeed) {
        // Validate inputs
        const serialValidation = this.validateSerialNumber(serialNumber);
        if (!serialValidation.isValid) {
            throw new Error(`Invalid serial number: ${serialValidation.errors.join(', ')}`);
        }
        const seedValidation = this.validateDailySeed(dailySeed);
        if (!seedValidation.isValid) {
            throw new Error(`Invalid daily seed: ${seedValidation.errors.join(', ')}`);
        }
        // Check cache first
        const cacheKey = this.getCacheKey(serialNumber, dailySeed);
        if (this.scoreCache.has(cacheKey)) {
            return this.scoreCache.get(cacheKey);
        }
        // Extract components from serial number
        const firstLetter = serialNumber.charAt(0);
        const digits = serialNumber.substring(1, 9);
        const lastLetter = serialNumber.charAt(9);
        // Create deterministic seed from inputs
        const combinedString = `${firstLetter}${digits}${lastLetter}${dailySeed}`;
        // Generate base hash
        const baseHash = this.hashString(combinedString);
        // Add additional entropy from different combinations
        const letterHash = this.hashString(`${firstLetter}${lastLetter}${dailySeed}`);
        const digitHash = this.hashString(`${digits}${dailySeed}`);
        // Combine all hash values
        const finalHash = (baseHash + letterHash + digitHash) % 1000000007; // Large prime for distribution
        // Normalize to 0-1 range
        const score = this.normalizeScore(Math.abs(finalHash));
        // Cache the result
        this.scoreCache.set(cacheKey, score);
        return score;
    }
    /**
     * Compare two serial numbers and determine winner/loser for game resolution
     */
    compareScores(serial1, serial2, dailySeed) {
        const score1 = this.calculateScore(serial1, dailySeed);
        const score2 = this.calculateScore(serial2, dailySeed);
        // Handle identical scores deterministically
        if (score1 === score2) {
            // Use lexicographic comparison of serials as tiebreaker
            const winner = serial1.localeCompare(serial2) > 0 ? serial1 : serial2;
            const loser = winner === serial1 ? serial2 : serial1;
            return {
                winner,
                loser,
                winnerScore: score1,
                loserScore: score2
            };
        }
        // Standard comparison
        if (score1 > score2) {
            return {
                winner: serial1,
                loser: serial2,
                winnerScore: score1,
                loserScore: score2
            };
        }
        else {
            return {
                winner: serial2,
                loser: serial1,
                winnerScore: score2,
                loserScore: score1
            };
        }
    }
    /**
     * Get cache statistics for monitoring
     */
    getCacheStats() {
        return {
            size: this.scoreCache.size
        };
    }
    /**
     * Clear the score cache (useful for testing or memory management)
     */
    clearCache() {
        this.scoreCache.clear();
    }
    /**
     * Batch calculate scores for multiple serial numbers (performance optimization)
     */
    calculateBatchScores(serialNumbers, dailySeed) {
        const results = new Map();
        for (const serial of serialNumbers) {
            try {
                const score = this.calculateScore(serial, dailySeed);
                results.set(serial, score);
            }
            catch (error) {
                // Skip invalid serials but don't fail the entire batch
                console.warn(`Skipping invalid serial ${serial}:`, error);
            }
        }
        return results;
    }
}
//# sourceMappingURL=scoring-engine.js.map