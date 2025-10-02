// Parameter validation
export function validateSimulationParameters(params) {
    const errors = [];
    const warnings = [];
    // Adoption rate validation
    if (params.adoptionRate < 0 || params.adoptionRate > 1) {
        errors.push('Adoption rate must be between 0 and 1');
    }
    else if (params.adoptionRate > 0.5) {
        warnings.push('Adoption rate above 50% may be unrealistic');
    }
    // Growth multiplier validation
    if (params.growthMultiplier < 0) {
        errors.push('Growth multiplier cannot be negative');
    }
    else if (params.growthMultiplier > 5) {
        warnings.push('Growth multiplier above 5x may lead to unrealistic projections');
    }
    // Cash out strategy validation
    const validStrategies = ['low', 'average', 'high'];
    if (!validStrategies.includes(params.cashOutStrategy)) {
        errors.push('Cash out strategy must be one of: low, average, high');
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}
// Dataset validation
export function validateSimulationDataset(dataset) {
    const errors = [];
    const warnings = [];
    // Basic required fields
    if (!dataset.id || dataset.id.trim().length === 0) {
        errors.push('Dataset ID is required');
    }
    if (!dataset.version || dataset.version.trim().length === 0) {
        errors.push('Dataset version is required');
    }
    // Date validation
    if (!dataset.createdAt || isNaN(dataset.createdAt.getTime())) {
        errors.push('Valid creation date is required');
    }
    if (!dataset.updatedAt || isNaN(dataset.updatedAt.getTime())) {
        errors.push('Valid update date is required');
    }
    if (dataset.createdAt && dataset.updatedAt && dataset.updatedAt < dataset.createdAt) {
        errors.push('Update date cannot be before creation date');
    }
    // Parameters validation
    const paramValidation = validateSimulationParameters(dataset.parameters);
    errors.push(...paramValidation.errors);
    warnings.push(...paramValidation.warnings);
    // Metadata validation
    if (dataset.metadata.dataPoints !== dataset.dailySnapshots.length) {
        errors.push('Metadata data points count does not match daily snapshots length');
    }
    if (dataset.metadata.generationDurationMs < 0) {
        errors.push('Generation duration cannot be negative');
    }
    if (dataset.metadata.memoryUsageMB < 0) {
        errors.push('Memory usage cannot be negative');
    }
    if (dataset.metadata.accuracy < 0 || dataset.metadata.accuracy > 1) {
        errors.push('Accuracy must be between 0 and 1');
    }
    // Performance warnings
    if (dataset.metadata.generationDurationMs > 10000) {
        warnings.push('Generation time exceeds 10 seconds - consider optimization');
    }
    if (dataset.metadata.memoryUsageMB > 200) {
        warnings.push('Memory usage exceeds 200MB - consider data compression');
    }
    // Daily snapshots validation
    for (let i = 0; i < dataset.dailySnapshots.length; i++) {
        const snapshot = dataset.dailySnapshots[i];
        const snapshotValidation = validateDailySnapshot(snapshot);
        errors.push(...snapshotValidation.errors.map(error => `Day ${snapshot.day}: ${error}`));
        warnings.push(...snapshotValidation.warnings.map(warning => `Day ${snapshot.day}: ${warning}`));
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}
// Daily snapshot validation
export function validateDailySnapshot(snapshot) {
    const errors = [];
    const warnings = [];
    // Day validation
    if (snapshot.day < 1 || snapshot.day > 365) {
        errors.push('Day must be between 1 and 365');
    }
    // Date validation
    if (!snapshot.date || isNaN(snapshot.date.getTime())) {
        errors.push('Valid date is required');
    }
    // Player metrics validation
    const playerValidation = validatePlayerMetrics(snapshot.playerMetrics);
    errors.push(...playerValidation.errors);
    warnings.push(...playerValidation.warnings);
    // Financial metrics validation
    const financialValidation = validateFinancialMetrics(snapshot.financialMetrics);
    errors.push(...financialValidation.errors);
    warnings.push(...financialValidation.warnings);
    // Level progression validation
    if (snapshot.levelProgression.length !== 10) {
        warnings.push('Expected 10 levels in progression data');
    }
    for (const level of snapshot.levelProgression) {
        if (level.level < 1 || level.level > 10) {
            errors.push(`Invalid level number: ${level.level}`);
        }
        if (level.gamesAtLevel < 0) {
            errors.push(`Negative games at level ${level.level}`);
        }
        if (level.successRate < 0 || level.successRate > 1) {
            errors.push(`Success rate for level ${level.level} must be between 0 and 1`);
        }
        if (level.avgTimeAtLevel < 0) {
            errors.push(`Average time at level ${level.level} cannot be negative`);
        }
        if (level.bottleneckScore < 0 || level.bottleneckScore > 1) {
            errors.push(`Bottleneck score for level ${level.level} must be between 0 and 1`);
        }
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}
// Player metrics validation
export function validatePlayerMetrics(metrics) {
    const errors = [];
    const warnings = [];
    // Non-negative values
    const fields = ['totalPlayers', 'activePlayers', 'newPlayers', 'churnedPlayers'];
    for (const field of fields) {
        if (metrics[field] < 0) {
            errors.push(`${field} cannot be negative`);
        }
    }
    // Logical consistency
    if (metrics.activePlayers > metrics.totalPlayers) {
        errors.push('Active players cannot exceed total players');
    }
    if (metrics.newPlayers > metrics.totalPlayers) {
        errors.push('New players cannot exceed total players');
    }
    if (metrics.churnedPlayers > metrics.totalPlayers) {
        errors.push('Churned players cannot exceed total players');
    }
    // Retention rate validation
    if (metrics.retentionRate < 0 || metrics.retentionRate > 1) {
        errors.push('Retention rate must be between 0 and 1');
    }
    // Performance warnings
    if (metrics.retentionRate < 0.5) {
        warnings.push('Low retention rate detected - may indicate system issues');
    }
    if (metrics.activePlayers / metrics.totalPlayers < 0.1) {
        warnings.push('Very low activity rate - may indicate engagement issues');
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}
// Financial metrics validation
export function validateFinancialMetrics(metrics) {
    const errors = [];
    const warnings = [];
    // Non-negative values
    const fields = ['totalRevenue', 'platformEarnings', 'charityContributions', 'governmentEarnings', 'playerWinnings', 'gamesPlayed'];
    for (const field of fields) {
        if (metrics[field] < 0) {
            errors.push(`${field} cannot be negative`);
        }
    }
    // Revenue distribution consistency (20% platform, 20% charity, 40% government, 40% players)
    const calculatedTotal = metrics.platformEarnings + metrics.charityContributions + metrics.governmentEarnings + metrics.playerWinnings;
    const tolerance = metrics.totalRevenue * 0.01; // 1% tolerance for rounding
    if (Math.abs(calculatedTotal - metrics.totalRevenue) > tolerance) {
        errors.push(`Revenue breakdown (${calculatedTotal}) does not match total revenue (${metrics.totalRevenue})`);
    }
    // Revenue distribution percentages (with tolerance)
    if (metrics.totalRevenue > 0) {
        const platformPerc = metrics.platformEarnings / metrics.totalRevenue;
        const charityPerc = metrics.charityContributions / metrics.totalRevenue;
        const governmentPerc = metrics.governmentEarnings / metrics.totalRevenue;
        const playerPerc = metrics.playerWinnings / metrics.totalRevenue;
        if (Math.abs(platformPerc - 0.2) > 0.01) {
            warnings.push(`Platform earnings percentage (${(platformPerc * 100).toFixed(1)}%) differs from expected 20%`);
        }
        if (Math.abs(charityPerc - 0.2) > 0.01) {
            warnings.push(`Charity contributions percentage (${(charityPerc * 100).toFixed(1)}%) differs from expected 20%`);
        }
        if (Math.abs(governmentPerc - 0.4) > 0.01) {
            warnings.push(`Government earnings percentage (${(governmentPerc * 100).toFixed(1)}%) differs from expected 40%`);
        }
        if (Math.abs(playerPerc - 0.4) > 0.01) {
            warnings.push(`Player winnings percentage (${(playerPerc * 100).toFixed(1)}%) differs from expected 40%`);
        }
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}
// Revenue breakdown validation
export function validateRevenueBreakdown(breakdown) {
    const errors = [];
    const warnings = [];
    // Non-negative amounts
    const categories = ['platform', 'charity', 'government', 'players'];
    for (const category of categories) {
        if (breakdown[category].amount < 0) {
            errors.push(`${category} amount cannot be negative`);
        }
        if (breakdown[category].percentage < 0 || breakdown[category].percentage > 1) {
            errors.push(`${category} percentage must be between 0 and 1`);
        }
    }
    // Total percentage should equal 1
    const totalPercentage = categories.reduce((sum, cat) => sum + breakdown[cat].percentage, 0);
    if (Math.abs(totalPercentage - 1) > 0.01) {
        errors.push(`Total percentage (${totalPercentage.toFixed(3)}) does not equal 1.0`);
    }
    // Amount consistency with percentages
    const totalAmount = categories.reduce((sum, cat) => sum + breakdown[cat].amount, 0);
    if (totalAmount > 0) {
        for (const category of categories) {
            const expectedAmount = totalAmount * breakdown[category].percentage;
            const actualAmount = breakdown[category].amount;
            const tolerance = totalAmount * 0.01; // 1% tolerance
            if (Math.abs(expectedAmount - actualAmount) > tolerance) {
                warnings.push(`${category} amount (${actualAmount}) doesn't match expected percentage (${expectedAmount.toFixed(2)})`);
            }
        }
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}
//# sourceMappingURL=validation.js.map