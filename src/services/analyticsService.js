/**
 * Analytics & Metrics calculation engine.
 * Computes KPIs, ROI, Yield, Win Rate, Streaks, Bankroll Curves, and breakdowns.
 */

export class AnalyticsService {
  /**
   * Filter bets and transactions by time period ('all', 'month', 'week', 'today')
   */
  static filterByPeriod(items, period = 'all') {
    if (period === 'all') return items;
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Start of week (Sunday or Monday)
    const dayOfWeek = now.getDay();
    const weekStart = new Date(todayStart - dayOfWeek * 24 * 60 * 60 * 1000).getTime();
    
    // Start of month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return items.filter(item => {
      const itemTime = new Date(item.date).getTime();
      if (period === 'today') return itemTime >= todayStart;
      if (period === 'week') return itemTime >= weekStart;
      if (period === 'month') return itemTime >= monthStart;
      return true;
    });
  }

  /**
   * Computes main dashboard KPIs
   */
  static calculateKPIs(bets, transactions, settings) {
    const initialBank = settings.initialBankroll || 100;
    
    // Filter out void / cancelled
    const settledBets = bets.filter(b => b.status === 'WON' || b.status === 'LOST' || b.status === 'CASHOUT');
    const openBets = bets.filter(b => b.status === 'OPEN');
    
    const greens = settledBets.filter(b => b.status === 'WON');
    const reds = settledBets.filter(b => b.status === 'LOST');
    const cashouts = settledBets.filter(b => b.status === 'CASHOUT');

    let totalStaked = 0;
    let totalReturned = 0;
    let totalProfit = 0;

    settledBets.forEach(b => {
      totalStaked += b.stake;
      if (b.status === 'WON') {
        const p = b.payout || (b.stake * b.odd);
        totalReturned += p;
        totalProfit += (p - b.stake);
      } else if (b.status === 'LOST') {
        totalProfit -= b.stake;
      } else if (b.status === 'CASHOUT') {
        const cVal = b.payout || b.cashoutValue || b.stake;
        totalReturned += cVal;
        totalProfit += (cVal - b.stake);
      }
    });

    // Cashflow totals
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    transactions.forEach(t => {
      if (t.type === 'DEPOSIT') totalDeposits += t.amount;
      if (t.type === 'WITHDRAWAL') totalWithdrawals += t.amount;
    });

    const netCashBalance = totalDeposits - totalWithdrawals;
    // Banca Atual = lucro/prejuízo acumulado das apostas (começa em 0)
    const currentEstimatedBankroll = totalProfit;

    const yieldPct = totalStaked > 0 ? ((totalProfit / totalStaked) * 100) : 0;
    const winRate = settledBets.length > 0 ? ((greens.length / settledBets.length) * 100) : 0;
    const avgOdd = bets.length > 0 ? (bets.reduce((acc, b) => acc + (b.odd || 0), 0) / bets.length) : 0;
    const avgStake = bets.length > 0 ? (bets.reduce((acc, b) => acc + (b.stake || 0), 0) / bets.length) : 0;

    // Current Streak
    const streak = this.calculateStreak(bets);

    return {
      initialBank,
      currentBankroll: Math.max(0, currentEstimatedBankroll),
      totalProfit,
      yieldPct,
      roi: yieldPct,
      winRate,
      totalBets: bets.length,
      settledCount: settledBets.length,
      openCount: openBets.length,
      greensCount: greens.length,
      redsCount: reds.length,
      cashoutCount: cashouts.length,
      avgOdd,
      avgStake,
      totalStaked,
      totalReturned,
      totalDeposits,
      totalWithdrawals,
      netCashBalance,
      streak
    };
  }

  /**
   * Calculates recent winning or losing streak
   */
  static calculateStreak(bets) {
    const sorted = [...bets]
      .filter(b => b.status === 'WON' || b.status === 'LOST')
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sorted.length === 0) return { type: 'NONE', count: 0 };

    const firstStatus = sorted[0].status;
    let count = 0;
    for (const b of sorted) {
      if (b.status === firstStatus) {
        count++;
      } else {
        break;
      }
    }

    return {
      type: firstStatus === 'WON' ? 'GREEN' : 'RED',
      count
    };
  }

  /**
   * Computes bankroll evolution curve chronologically
   */
  static getBankrollGrowthData(bets, initialBank = 100) {
    const sorted = [...bets]
      .filter(b => b.status === 'WON' || b.status === 'LOST' || b.status === 'CASHOUT')
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const labels = ['Início'];
    const bankrollData = [initialBank];
    const profitData = [0];

    let currentBank = initialBank;
    let cumulativeProfit = 0;

    sorted.forEach((b, index) => {
      let betProfit = 0;
      if (b.status === 'WON') {
        const p = b.payout || (b.stake * b.odd);
        betProfit = p - b.stake;
      } else if (b.status === 'LOST') {
        betProfit = -b.stake;
      } else if (b.status === 'CASHOUT') {
        const cVal = b.payout || b.cashoutValue || b.stake;
        betProfit = cVal - b.stake;
      }

      cumulativeProfit += betProfit;
      currentBank += betProfit;

      const dateStr = new Date(b.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      labels.push(`#${index + 1} (${dateStr})`);
      bankrollData.push(Number(currentBank.toFixed(2)));
      profitData.push(Number(cumulativeProfit.toFixed(2)));
    });

    return { labels, bankrollData, profitData };
  }

  /**
   * Computes daily P&L for bar chart
   */
  static getDailyPLData(bets) {
    const dailyMap = {};

    bets.filter(b => b.status === 'WON' || b.status === 'LOST' || b.status === 'CASHOUT')
      .forEach(b => {
        const d = new Date(b.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        let profit = 0;
        if (b.status === 'WON') {
          profit = (b.payout || (b.stake * b.odd)) - b.stake;
        } else if (b.status === 'LOST') {
          profit = -b.stake;
        } else if (b.status === 'CASHOUT') {
          profit = (b.payout || b.cashoutValue || b.stake) - b.stake;
        }

        dailyMap[d] = (dailyMap[d] || 0) + profit;
      });

    const labels = Object.keys(dailyMap);
    const data = labels.map(l => Number(dailyMap[l].toFixed(2)));
    const colors = data.map(v => v >= 0 ? '#00d665' : '#ff385c');

    return { labels, data, colors };
  }

  /**
   * Computes market breakdown
   */
  static getMarketBreakdownData(bets) {
    const map = {};
    bets.forEach(b => {
      let market = 'Outros';
      const mText = (b.market || '').toLowerCase();
      if (mText.includes('gol') || mText.includes('over') || mText.includes('under')) market = 'Gols (Over/Under)';
      else if (mText.includes('chute') || mText.includes('jogador')) market = 'Chutes no Gol';
      else if (mText.includes('ambas') || mText.includes('btts')) market = 'Ambas Marcam';
      else if (mText.includes('canto') || mText.includes('escanteio')) market = 'Escanteios';
      else if (mText.includes('resultado') || mText.includes('1x2') || mText.includes('vencedor')) market = 'Resultado / 1X2';
      else if (mText.includes('tempo')) market = '1º/2º Tempo';

      map[market] = (map[market] || 0) + 1;
    });

    const labels = Object.keys(map);
    const data = Object.values(map);
    return { labels, data };
  }

  /**
   * Computes odds range performance
   */
  static getOddsRangeData(bets) {
    const ranges = {
      '1.01 - 1.50': { count: 0, won: 0, profit: 0 },
      '1.51 - 2.00': { count: 0, won: 0, profit: 0 },
      '2.01 - 3.00': { count: 0, won: 0, profit: 0 },
      '3.01+': { count: 0, won: 0, profit: 0 }
    };

    bets.filter(b => b.status === 'WON' || b.status === 'LOST').forEach(b => {
      let key = '3.01+';
      if (b.odd <= 1.50) key = '1.01 - 1.50';
      else if (b.odd <= 2.00) key = '1.51 - 2.00';
      else if (b.odd <= 3.00) key = '2.01 - 3.00';

      ranges[key].count++;
      if (b.status === 'WON') {
        ranges[key].won++;
        ranges[key].profit += ((b.payout || (b.stake * b.odd)) - b.stake);
      } else {
        ranges[key].profit -= b.stake;
      }
    });

    const labels = Object.keys(ranges);
    const profitData = labels.map(k => Number(ranges[k].profit.toFixed(2)));
    const winRateData = labels.map(k => ranges[k].count > 0 ? Number(((ranges[k].won / ranges[k].count) * 100).toFixed(1)) : 0);

    return { labels, profitData, winRateData };
  }

  /**
   * Computes monthly consolidated table data
   */
  static getMonthlyAnalytics(bets) {
    const monthlyMap = {};

    bets.forEach(b => {
      const d = new Date(b.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      if (!monthlyMap[key]) {
        monthlyMap[key] = { label: monthLabel, betsCount: 0, wonCount: 0, totalStaked: 0, profit: 0 };
      }

      monthlyMap[key].betsCount++;
      monthlyMap[key].totalStaked += b.stake;

      if (b.status === 'WON') {
        monthlyMap[key].wonCount++;
        monthlyMap[key].profit += ((b.payout || (b.stake * b.odd)) - b.stake);
      } else if (b.status === 'LOST') {
        monthlyMap[key].profit -= b.stake;
      }
    });

    return Object.values(monthlyMap).map(m => {
      const winRate = m.betsCount > 0 ? ((m.wonCount / m.betsCount) * 100) : 0;
      const roi = m.totalStaked > 0 ? ((m.profit / m.totalStaked) * 100) : 0;
      return {
        ...m,
        winRate: winRate.toFixed(1) + '%',
        roi: (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%',
        profitFormatted: (m.profit >= 0 ? '+R$ ' : '-R$ ') + Math.abs(m.profit).toFixed(2),
        isPositive: m.profit >= 0
      };
    });
  }
}
