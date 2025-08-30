// Player Balance Manager Implementation - Task 6.6, 6.8, 6.12
// Manages 3-part balance system with game fees, progression, and cash-outs
/**
 * Player Balance Manager - Implements 3-part balance system
 * Separates donation balance, winnings balance, and at-risk progression
 */
export class PlayerBalanceManager {
    players = new Map();
    transactionHistory = new Map();
    gameFee = 1.10; // $1.10 per game (includes $1 bet + 10c platform fee)
    /**
     * Create a new player with initial donation balance
     */
    createPlayer(id, initialDonation, strategy) {
        // Validate inputs
        if (!id || id.trim() === '') {
            throw new Error('Player ID is required');
        }
        if (initialDonation < 0) {
            throw new Error('Initial donation cannot be negative');
        }
        if (this.players.has(id)) {
            throw new Error(`Player with ID ${id} already exists`);
        }
        // Create new player
        const player = {
            id,
            donationBalance: initialDonation,
            winningsBalance: 0.00,
            currentProgression: 0.00,
            gamesPlayed: 0,
            virtualDollars: [],
            cashOutStrategy: strategy,
            isActive: initialDonation >= this.gameFee, // Can play if they can afford at least one game
            createdAt: new Date()
        };
        // Store player and initialize transaction history
        this.players.set(id, player);
        this.transactionHistory.set(id, []);
        return { ...player }; // Return copy
    }
    /**
     * Get player by ID
     */
    getPlayer(playerId) {
        const player = this.players.get(playerId);
        return player ? { ...player } : undefined; // Return copy to prevent external modification
    }
    /**
     * Get all players
     */
    getAllPlayers() {
        return Array.from(this.players.values()).map(player => ({ ...player }));
    }
    /**
     * Get active players only
     */
    getActivePlayers() {
        return this.getAllPlayers().filter(player => player.isActive);
    }
    /**
     * Check if player can afford to play a game
     */
    canPlayerPlay(playerId) {
        const player = this.players.get(playerId);
        if (!player) {
            return false;
        }
        return player.isActive && player.donationBalance >= this.gameFee;
    }
    /**
     * Calculate how many games a player can afford
     */
    getPlayerGameCredits(playerId) {
        const player = this.players.get(playerId);
        if (!player || !player.isActive) {
            return 0;
        }
        return Math.floor(player.donationBalance / this.gameFee);
    }
    /**
     * Process game fee deduction from donation balance
     */
    processGameFee(playerId) {
        const player = this.players.get(playerId);
        if (!player) {
            return false;
        }
        // Check if player can afford the game fee
        if (!this.canPlayerPlay(playerId)) {
            return false;
        }
        // Deduct fee from donation balance only
        player.donationBalance -= this.gameFee;
        player.gamesPlayed++;
        // Check if player should become inactive after this game
        if (player.donationBalance < this.gameFee) {
            player.isActive = false;
        }
        // Record transaction
        this.recordTransaction(playerId, {
            id: this.generateTransactionId(),
            playerId,
            type: 'GAME_FEE',
            amount: this.gameFee,
            timestamp: new Date(),
            balanceAfter: {
                donationBalance: player.donationBalance,
                winningsBalance: player.winningsBalance,
                currentProgression: player.currentProgression
            }
        });
        return true;
    }
    /**
     * Add winning amount to currentProgression balance
     */
    addWinProgression(playerId, amount) {
        const player = this.players.get(playerId);
        if (!player) {
            throw new Error(`Player ${playerId} not found`);
        }
        if (amount < 0) {
            throw new Error('Win amount cannot be negative');
        }
        // Add to current progression (at-risk balance)
        player.currentProgression += amount;
        // Record transaction
        this.recordTransaction(playerId, {
            id: this.generateTransactionId(),
            playerId,
            type: 'WIN',
            amount,
            timestamp: new Date(),
            balanceAfter: {
                donationBalance: player.donationBalance,
                winningsBalance: player.winningsBalance,
                currentProgression: player.currentProgression
            }
        });
    }
    /**
     * Clear progression on loss, return lost amount
     */
    loseProgression(playerId) {
        const player = this.players.get(playerId);
        if (!player) {
            throw new Error(`Player ${playerId} not found`);
        }
        const lostAmount = player.currentProgression;
        player.currentProgression = 0.00;
        // Record transaction if there was something to lose
        if (lostAmount > 0) {
            this.recordTransaction(playerId, {
                id: this.generateTransactionId(),
                playerId,
                type: 'LOSS',
                amount: lostAmount,
                timestamp: new Date(),
                balanceAfter: {
                    donationBalance: player.donationBalance,
                    winningsBalance: player.winningsBalance,
                    currentProgression: player.currentProgression
                }
            });
        }
        return lostAmount;
    }
    /**
     * Process cash-out with charity deduction
     */
    processCashOut(playerId, charityPercentage) {
        const player = this.players.get(playerId);
        if (!player) {
            throw new Error(`Player ${playerId} not found`);
        }
        // Validate charity percentage
        if (charityPercentage < 0.10 || charityPercentage > 1.00) {
            throw new Error('Charity percentage must be between 0.10 (10%) and 1.00 (100%)');
        }
        const totalProgression = player.currentProgression;
        if (totalProgression <= 0) {
            return { playerAmount: 0, charityAmount: 0 };
        }
        // Calculate charity deduction from currentProgression only
        const charityAmount = totalProgression * charityPercentage;
        const playerAmount = totalProgression - charityAmount;
        // Move (progression - charity) to winningsBalance
        player.winningsBalance += playerAmount;
        player.currentProgression = 0.00;
        // Record transaction
        this.recordTransaction(playerId, {
            id: this.generateTransactionId(),
            playerId,
            type: 'CASH_OUT',
            amount: totalProgression,
            timestamp: new Date(),
            balanceAfter: {
                donationBalance: player.donationBalance,
                winningsBalance: player.winningsBalance,
                currentProgression: player.currentProgression
            }
        });
        return {
            playerAmount: this.roundToTwoCents(playerAmount),
            charityAmount: this.roundToTwoCents(charityAmount)
        };
    }
    /**
     * Get transaction history for a player
     */
    getTransactionHistory(playerId) {
        return this.transactionHistory.get(playerId) || [];
    }
    /**
     * Get total donations across all players
     */
    getTotalDonations() {
        let total = 0;
        for (const player of this.players.values()) {
            // Include both remaining and spent donation balance
            total += player.donationBalance + (player.gamesPlayed * this.gameFee);
        }
        return this.roundToTwoCents(total);
    }
    /**
     * Get total winnings across all players (including progression)
     */
    getTotalWinnings() {
        let total = 0;
        for (const player of this.players.values()) {
            total += player.winningsBalance + player.currentProgression;
        }
        return this.roundToTwoCents(total);
    }
    /**
     * Get total charity contributions from all cash-outs
     */
    getTotalCharityContributions() {
        let total = 0;
        for (const transactions of this.transactionHistory.values()) {
            for (const transaction of transactions) {
                if (transaction.type === 'CASH_OUT') {
                    // Calculate charity from historical cash-outs
                    // This is an approximation since we don't store charity amount directly
                    const estimatedCharity = transaction.amount * 0.15; // Using default 15%
                    total += estimatedCharity;
                }
            }
        }
        return this.roundToTwoCents(total);
    }
    /**
     * Get player statistics
     */
    getPlayerStatistics(playerId) {
        const player = this.players.get(playerId);
        if (!player) {
            throw new Error(`Player ${playerId} not found`);
        }
        const transactions = this.getTransactionHistory(playerId);
        // Calculate initial deposit (reverse engineer from current state)
        const totalSpentOnFees = player.gamesPlayed * this.gameFee;
        const totalDeposited = player.donationBalance + totalSpentOnFees;
        let totalWon = 0;
        let totalCashedOut = 0;
        for (const transaction of transactions) {
            switch (transaction.type) {
                case 'WIN':
                    totalWon += transaction.amount;
                    break;
                case 'CASH_OUT':
                    totalCashedOut += transaction.amount;
                    break;
            }
        }
        const currentBalance = player.donationBalance + player.winningsBalance + player.currentProgression;
        return {
            totalDeposited: this.roundToTwoCents(totalDeposited),
            totalSpentOnFees: this.roundToTwoCents(totalSpentOnFees),
            totalWon: this.roundToTwoCents(totalWon),
            totalCashedOut: this.roundToTwoCents(totalCashedOut),
            currentBalance: this.roundToTwoCents(currentBalance),
            gamesPlayed: player.gamesPlayed,
            isActive: player.isActive
        };
    }
    /**
     * Validate player balance consistency
     */
    validatePlayerBalance(playerId) {
        const player = this.players.get(playerId);
        if (!player) {
            return {
                isValid: false,
                errors: [`Player ${playerId} not found`],
                warnings: []
            };
        }
        const errors = [];
        const warnings = [];
        // Validate non-negative balances
        if (player.donationBalance < 0) {
            errors.push('Donation balance cannot be negative');
        }
        if (player.winningsBalance < 0) {
            errors.push('Winnings balance cannot be negative');
        }
        if (player.currentProgression < 0) {
            errors.push('Current progression cannot be negative');
        }
        // Validate games played consistency
        if (player.gamesPlayed < 0) {
            errors.push('Games played cannot be negative');
        }
        // Validate activity status
        if (player.isActive && player.donationBalance < this.gameFee) {
            warnings.push('Active player cannot afford game fee - should be inactive');
        }
        if (!player.isActive && player.donationBalance >= this.gameFee) {
            warnings.push('Inactive player can afford game fee - could be reactivated');
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    /**
     * Update player's cash-out strategy
     */
    updatePlayerStrategy(playerId, newStrategy) {
        const player = this.players.get(playerId);
        if (!player) {
            return false;
        }
        player.cashOutStrategy = newStrategy;
        return true;
    }
    /**
     * Get game fee amount
     */
    getGameFee() {
        return this.gameFee;
    }
    /**
     * Set game fee (for testing or configuration changes)
     */
    setGameFee(newFee) {
        if (newFee <= 0) {
            return {
                isValid: false,
                errors: ['Game fee must be positive'],
                warnings: []
            };
        }
        if (newFee > 10) {
            return {
                isValid: true,
                errors: [],
                warnings: ['Game fee is unusually high']
            };
        }
        this.gameFee = newFee;
        // Update player activity status based on new fee
        for (const player of this.players.values()) {
            player.isActive = player.donationBalance >= this.gameFee;
            // Note: We don't record transactions for automatic activity status changes
        }
        return {
            isValid: true,
            errors: [],
            warnings: []
        };
    }
    /**
     * Record a transaction in the player's history
     */
    recordTransaction(playerId, transaction) {
        const history = this.transactionHistory.get(playerId) || [];
        history.push(transaction);
        this.transactionHistory.set(playerId, history);
    }
    /**
     * Generate unique transaction ID
     */
    generateTransactionId() {
        return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Round to nearest cent
     */
    roundToTwoCents(amount) {
        return Math.round(amount * 100) / 100;
    }
    /**
     * Reset all players and transactions (for testing)
     */
    reset() {
        this.players.clear();
        this.transactionHistory.clear();
    }
}
export default PlayerBalanceManager;
//# sourceMappingURL=player-balance-manager.js.map