import { create } from 'zustand';
import { GameState, ChartDataPoint, CashOutStrategy, SimulationProps, WeeklyStats  } from '@/types/types';

// Constants
const LEVELS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
const PLATFORM_FEE = 0.20;
const GOVERNMENT_SHARE = 0.40;
const CHARITY_SHARE = 0.20;
const PLAYER_SHARE = 0.40;
const OUTREACH_POT_PER_GAME = 0.01;
const PANAMA_LOTTERY_USERS = 1000000; // Assuming 1 million users

// Seeded random number generator for consistent results
class SeededRandom {
    private seed: number;
  
    constructor(seed: number) {
      this.seed = seed;
    }
  
    next(): number {
      this.seed = (this.seed * 9301 + 49297) % 233280;
      return this.seed / 233280;
    }
  }

// Define the initial game state
const initialGameState: GameState = {
  day: 0,
  totalCharity: 0,
  chartData: [],
  jackpotWinners: 0,
  totalGamesPlayed: 0,
  platformEarnings: 0,
  totalWinnings: 0,
  totalPlayers: 1000,
  activePlayers: 1000,
  outreachPot: 0,
  governmentEarnings: 0,
  weeklyStats: []
};

interface SimulationStore {
  gameState1: GameState;
  gameState2: GameState;
  isRunning: boolean;
  cashOutStrategy1: CashOutStrategy;
  cashOutStrategy2: CashOutStrategy;
  adoptionRate2: number;
  setGameState1: (state: GameState) => void;
  setGameState2: (state: GameState) => void;
  setIsRunning: (isRunning: boolean) => void;
  setCashOutStrategy1: (strategy: CashOutStrategy) => void;
  setCashOutStrategy2: (strategy: CashOutStrategy) => void;
  setAdoptionRate2: (rate: number) => void;
  updateTotalPlayers: (newCount: number) => void;
  resetSimulation: () => void;
  simulateDay: (prevState: GameState, props: SimulationProps) => GameState;
  weeklyStats: WeeklyStats[];
  calculateWeeklyStats: (chartData: ChartDataPoint[]) => WeeklyStats[];
}

const useSimulationStore = create<SimulationStore>()((set, get) => ({
  gameState1: initialGameState,
  gameState2: initialGameState,
  isRunning: false,
  cashOutStrategy1: 'average',
  cashOutStrategy2: 'average',
  adoptionRate2: 0.001,
  weeklyStats: [],
  setGameState1: (state: GameState) => set({ gameState1: state }),
  setGameState2: (state: GameState) => set({ gameState2: state }),
  setIsRunning: (isRunning: boolean) => set({ isRunning }),
  setCashOutStrategy1: (strategy: CashOutStrategy) => set({ cashOutStrategy1: strategy }),
  setCashOutStrategy2: (strategy: CashOutStrategy) => set({ cashOutStrategy2: strategy }),
  setAdoptionRate2: (rate: number) => set({ adoptionRate2: rate }),
  
  updateTotalPlayers: (newCount: number) => {
    set((state) => ({
      gameState1: { ...state.gameState1, totalPlayers: newCount, activePlayers: newCount },
      gameState2: { ...state.gameState2, totalPlayers: newCount, activePlayers: newCount }
    }));
  },
  
  resetSimulation: () => set({
    gameState1: initialGameState,
    gameState2: initialGameState,
    isRunning: false,
    cashOutStrategy1: 'average',
    cashOutStrategy2: 'average',
    adoptionRate2: 0.001,
    weeklyStats: [],
  }),


  calculateWeeklyStats: (chartData: ChartDataPoint[]): WeeklyStats[] => {
    const weeklyStats: WeeklyStats[] = [];
    for (let i = 0; i < chartData.length; i += 7) {
      const weekData = chartData.slice(i, i + 7);
      const lastDayOfWeek = weekData[weekData.length - 1];
      const firstDayOfWeek = weekData[0];
      
      const weekStat: WeeklyStats = {
        week: Math.floor(i / 7) + 1,
        totalCharity: weekData.reduce((sum, day) => sum + day.charityContributions, 0),
        totalPlatformEarnings: weekData.reduce((sum, day) => sum + day.platformEarnings, 0),
        totalJackpotWinners: weekData.reduce((sum, day) => sum + day.jackpotWinners, 0),
        totalGamesPlayed: weekData.reduce((sum, day) => sum + day.gamesPlayed, 0),
        activePlayersGrowth: (lastDayOfWeek.activePlayers - firstDayOfWeek.activePlayers) / firstDayOfWeek.activePlayers * 100,
        averageDailyGames: weekData.reduce((sum, day) => sum + day.gamesPlayed, 0) / weekData.length,
      };
      weeklyStats.push(weekStat);
    }
    return weeklyStats;
  },

  
  simulateDay: (prevState: GameState, { cashOutStrategy, adoptionRate }: SimulationProps): GameState => {
    const newDay = prevState.day + 1;
    const rng = new SeededRandom(newDay); // Use seeded RNG for consistency

    // Memoized helper functions
    const getBillsPerDay = (strategy: CashOutStrategy): number => {
      const getRandomInt = (min: number, max: number): number => {
        return Math.floor(rng.next() * (max - min + 1)) + min;
      };
      switch (strategy) {
        case 'low': return getRandomInt(1, 4);
        case 'average': return getRandomInt(5, 7);
        case 'high': return getRandomInt(8, 12);
        default: return getRandomInt(5, 7);
      }
    };
  

    const getCashOutProbability = (level: number, strategy: CashOutStrategy): number => {
      switch (strategy) {
        case 'low':
          return Math.max(0.9 - (level / 100), 0.1);
        case 'average':
          return 0.5;
        case 'high':
          return Math.min(0.1 + (level / 100), 0.9);
      }
    };
    // Calculate new active players
    let newActivePlayers;
    if (adoptionRate === 0) {
      const baseGrowthRate = 0.01;
      const randomFactor = (rng.next() + 0.5) * 0.05;
      const timeFactor = Math.log(newDay + 1) / 10;
      const effectiveGrowthRate = (baseGrowthRate + randomFactor) * (1 + timeFactor);
      newActivePlayers = Math.floor(prevState.activePlayers * (1 + effectiveGrowthRate));
    } else {
      const baseAdoptedUsers = Math.floor(PANAMA_LOTTERY_USERS * adoptionRate);
      const randomFactor = Math.floor(rng.next() * baseAdoptedUsers * 0.2) - Math.floor(baseAdoptedUsers * 0.1);
      const adoptedPanamaUsers = baseAdoptedUsers + randomFactor;
      newActivePlayers = Math.min(PANAMA_LOTTERY_USERS, prevState.activePlayers + adoptedPanamaUsers);
    }

    // Calculate daily games played old
    // const billsPerDay = getBillsPerDay(cashOutStrategy);
    // const averageBet = billsPerDay;
    // const totalBet = newActivePlayers * averageBet;

    // Calculate initial total bet (without fees)
    let totalBet = 0;
    for (let i = 0; i < newActivePlayers; i++) {
      totalBet += getBillsPerDay(cashOutStrategy);
    }


    let dailyCharity = 0;
    let dailyPlatformEarnings = 0;
    let dailyGovernmentEarnings = 0;
    let dailyOutreachPot = 0;
    let dailyPlayerWinnings = 0;
    let dailyJackpotWinners = 0;
    let totalDailyGames = 0;
    const levelData: Record<string, number> = {};
    let remainingBets = totalBet;
    let playersAtLevel = newActivePlayers;


    LEVELS.forEach((level) => {
      const gamesAtLevel = playersAtLevel;
      totalDailyGames += gamesAtLevel;
      
      const cashOutProbability = getCashOutProbability(level, cashOutStrategy);
      const cashOutPlayers = Math.floor(playersAtLevel * cashOutProbability);
      const losingPlayers = Math.floor((playersAtLevel - cashOutPlayers) / 2);
      
      // Platform earnings for all games at this level
      const platformEarningsAtLevel = gamesAtLevel * PLATFORM_FEE;
      dailyPlatformEarnings += platformEarningsAtLevel;
      dailyOutreachPot += gamesAtLevel * OUTREACH_POT_PER_GAME;
  
      // Winnings distribution for players who cash out
      const winningsToDistribute = cashOutPlayers * level * 2;
      const charityAtLevel = winningsToDistribute * CHARITY_SHARE;
      const governmentAtLevel = winningsToDistribute * GOVERNMENT_SHARE;
      const playerWinningsAtLevel = winningsToDistribute * PLAYER_SHARE;
  
      dailyCharity += charityAtLevel;
      dailyGovernmentEarnings += governmentAtLevel;
      dailyPlayerWinnings += playerWinningsAtLevel;
  
      if (level === 512) {
        dailyJackpotWinners += cashOutPlayers;
      }
  
      levelData[`$${level}`] = gamesAtLevel;
  
      console.log(`Level $${level}:`, {
        playersAtLevel,
        gamesAtLevel,
        cashOutProbability,
        cashOutPlayers,
        losingPlayers,
        platformEarnings: platformEarningsAtLevel,
        charityContribution: charityAtLevel,
        governmentEarnings: governmentAtLevel,
        playerWinnings: playerWinningsAtLevel,
      });
  
      // Players progressing to the next level
      playersAtLevel = playersAtLevel - cashOutPlayers - losingPlayers;
    });

    const totalMoneyInSystem = totalBet + dailyPlatformEarnings;
    const totalDistributed = dailyCharity + dailyGovernmentEarnings + dailyPlayerWinnings;

    

    const newChartDataPoint: ChartDataPoint = {
      day: newDay,
      charityContributions: dailyCharity,
      platformEarnings: dailyPlatformEarnings,
      jackpotWinners: dailyJackpotWinners,
      gamesPlayed: totalDailyGames,
      totalPlayers: prevState.totalPlayers,
      activePlayers: newActivePlayers,
      governmentEarnings: dailyGovernmentEarnings,
      outreachPot: dailyOutreachPot,
      playerWinnings: dailyPlayerWinnings,
      ...levelData
    };

    console.log(`Day ${newDay} Simulation Results:`, {
      activePlayers: newActivePlayers,
      totalGames: totalDailyGames,
      totalBet,
      totalMoneyInSystem,
      platformEarnings: dailyPlatformEarnings,
      charity: dailyCharity,
      governmentEarnings: dailyGovernmentEarnings,
      playerWinnings: dailyPlayerWinnings,
      jackpotWinners: dailyJackpotWinners,
      remainingInPot: remainingBets,
      totalDistributed,
      outreachPot: dailyOutreachPot,
    });

    const newChartData = [...prevState.chartData, newChartDataPoint];
    const newWeeklyStats = get().calculateWeeklyStats(newChartData);

    return {
      ...prevState,
      day: newDay,
      totalCharity: prevState.totalCharity + dailyCharity,
      chartData: newChartData,
      jackpotWinners: prevState.jackpotWinners + dailyJackpotWinners,
      totalGamesPlayed: prevState.totalGamesPlayed + totalDailyGames,
      platformEarnings: prevState.platformEarnings + dailyPlatformEarnings,
      governmentEarnings: prevState.governmentEarnings + dailyGovernmentEarnings,
      outreachPot: prevState.outreachPot + dailyOutreachPot,
      totalWinnings: prevState.totalWinnings + totalDistributed, // Changed to total distributed
      activePlayers: newActivePlayers,
      weeklyStats: newWeeklyStats,
    };
  },
}));

export default useSimulationStore;