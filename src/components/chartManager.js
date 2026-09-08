/**
 * Chart.js visualization manager for SuperTracker.
 * Creates and updates responsive dark-themed charts with Superbet colors.
 */

export class ChartManager {
  constructor() {
    this.charts = {};
  }

  /**
   * Initialize or update all dashboard charts
   */
  updateDashboardCharts(growthData, winrateStats, dailyPLData, marketData) {
    this.renderBankrollGrowth(growthData);
    this.renderWinRateDoughnut(winrateStats);
    this.renderDailyPL(dailyPLData);
    this.renderMarketBreakdown(marketData);
  }

  /**
   * 1. Bankroll Growth Line Chart
   */
  renderBankrollGrowth({ labels, bankrollData, profitData }) {
    const ctx = document.getElementById('chart-bankroll-growth');
    if (!ctx) return;

    if (this.charts.bankroll) {
      this.charts.bankroll.destroy();
    }

    const context = ctx.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(0, 214, 101, 0.35)');
    gradient.addColorStop(1, 'rgba(0, 214, 101, 0.0)');

    this.charts.bankroll = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Banca (R$)',
            data: bankrollData,
            borderColor: '#00d665',
            backgroundColor: gradient,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#00d665',
            pointBorderColor: '#14161f',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1b1e2a',
            titleColor: '#fff',
            bodyColor: '#00d665',
            borderColor: '#2b3044',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context) => `Banca: R$ ${context.parsed.y.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#8b92a5', font: { size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#8b92a5',
              font: { size: 10 },
              callback: (v) => `R$ ${v}`
            }
          }
        }
      }
    });
  }

  /**
   * 2. Win Rate Doughnut Chart
   */
  renderWinRateDoughnut({ greens, reds, open, cashout }) {
    const ctx = document.getElementById('chart-winrate-doughnut');
    if (!ctx) return;

    if (this.charts.winrate) {
      this.charts.winrate.destroy();
    }

    const total = greens + reds + open + cashout;
    const data = total === 0 ? [1] : [greens, reds, open, cashout];
    const bgColors = total === 0 
      ? ['#262a39'] 
      : ['#00d665', '#ff385c', '#3a86ff', '#ffb703'];

    this.charts.winrate = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: total === 0 ? ['Sem dados'] : ['Greens', 'Reds', 'Abertas', 'Cashout'],
        datasets: [{
          data: data,
          backgroundColor: bgColors,
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1b1e2a',
            borderColor: '#2b3044',
            borderWidth: 1
          }
        }
      }
    });
  }

  /**
   * 3. Daily P&L Bar Chart
   */
  renderDailyPL({ labels, data, colors }) {
    const ctx = document.getElementById('chart-daily-pl');
    if (!ctx) return;

    if (this.charts.dailyPL) {
      this.charts.dailyPL.destroy();
    }

    this.charts.dailyPL = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['Sem dados'],
        datasets: [{
          label: 'Lucro / Prejuízo (R$)',
          data: data.length > 0 ? data : [0],
          backgroundColor: colors.length > 0 ? colors : ['#3b4257'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1b1e2a',
            borderColor: '#2b3044',
            borderWidth: 1,
            callbacks: {
              label: (ctx) => `${ctx.parsed.y >= 0 ? '+' : ''}R$ ${ctx.parsed.y.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#8b92a5', font: { size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#8b92a5',
              font: { size: 10 },
              callback: (v) => `R$ ${v}`
            }
          }
        }
      }
    });
  }

  /**
   * 4. Market Breakdown Chart
   */
  renderMarketBreakdown({ labels, data }) {
    const ctx = document.getElementById('chart-market-breakdown');
    if (!ctx) return;

    if (this.charts.markets) {
      this.charts.markets.destroy();
    }

    this.charts.markets = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['Gols', 'Chutes', 'Ambas'],
        datasets: [{
          label: 'Apostas',
          data: data.length > 0 ? data : [0, 0, 0],
          backgroundColor: '#3a86ff',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#8b92a5', font: { size: 10 } }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#f1f3f9', font: { size: 11 } }
          }
        }
      }
    });
  }

  /**
   * 5. Odds Range Analysis Chart
   */
  renderOddsRanges({ labels, profitData, winRateData }) {
    const ctx = document.getElementById('chart-odds-ranges');
    if (!ctx) return;

    if (this.charts.oddsRanges) {
      this.charts.oddsRanges.destroy();
    }

    this.charts.oddsRanges = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Lucro Líquido (R$)',
            data: profitData,
            backgroundColor: profitData.map(v => v >= 0 ? '#00d665' : '#ff385c'),
            borderRadius: 6,
            yAxisID: 'y'
          },
          {
            label: 'Taxa de Acerto (%)',
            data: winRateData,
            type: 'line',
            borderColor: '#ffb703',
            borderWidth: 2,
            pointBackgroundColor: '#ffb703',
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#8b92a5', font: { size: 11 } }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#8b92a5', font: { size: 11 } }
          },
          y: {
            type: 'linear',
            position: 'left',
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#8b92a5',
              callback: (v) => `R$ ${v}`
            }
          },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { display: false },
            ticks: {
              color: '#ffb703',
              callback: (v) => `${v}%`
            },
            min: 0,
            max: 100
          }
        }
      }
    });
  }
}
