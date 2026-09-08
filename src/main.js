/**
 * Main application orchestrator for SuperTracker.
 */

import { StorageService } from './services/storageService.js';
import { AnalyticsService } from './services/analyticsService.js';
import { OCRService } from './services/ocrService.js';
import { ChartManager } from './components/chartManager.js';

class SuperTrackerApp {
  constructor() {
    this.currentTab = 'dashboard';
    this.currentPeriod = 'all';
    this.currentBetStatusFilter = 'ALL';
    this.currentSearchQuery = '';
    this.chartManager = new ChartManager();
    this.scannedData = null;

    this.init();
  }

  init() {
    // 1. Initialize Storage
    StorageService.init();

    // 2. Setup Event Listeners
    this.setupNavigation();
    this.setupFilters();
    this.setupOCRScanner();
    this.setupManualModals();
    this.setupSettingsAndBackups();
    this.setupGlobalPaste();

    // 3. Render initial view
    this.render();
  }

  /**
   * Main render loop
   */
  render() {
    const allBets = StorageService.getBets();
    const allTransactions = StorageService.getTransactions();
    const settings = StorageService.getSettings();

    // Filter by period for analytics
    const filteredBets = AnalyticsService.filterByPeriod(allBets, this.currentPeriod);
    const filteredTransactions = AnalyticsService.filterByPeriod(allTransactions, this.currentPeriod);

    // 1. Update KPIs
    const kpis = AnalyticsService.calculateKPIs(filteredBets, filteredTransactions, settings);
    this.updateKPIDisplay(kpis);

    // 2. Update Charts
    const growthData = AnalyticsService.getBankrollGrowthData(allBets, settings.initialBankroll);
    const dailyPLData = AnalyticsService.getDailyPLData(filteredBets);
    const marketData = AnalyticsService.getMarketBreakdownData(filteredBets);
    const winrateStats = {
      greens: kpis.greensCount,
      reds: kpis.redsCount,
      open: kpis.openCount,
      cashout: kpis.cashoutCount
    };

    this.chartManager.updateDashboardCharts(growthData, winrateStats, dailyPLData, marketData);

    if (this.currentTab === 'analytics') {
      const oddsData = AnalyticsService.getOddsRangeData(filteredBets);
      this.chartManager.renderOddsRanges(oddsData);
      this.renderMonthlyTable(allBets);
    }

    // 3. Update Lists
    this.renderBetsList(allBets);
    this.renderRecentBets(allBets);
    this.renderTransactionsList(allTransactions);

    // 4. Update Settings form values
    this.loadSettingsForm(settings);

    // 5. Reinitialize icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  /**
   * Update KPI Numbers on UI
   */
  updateKPIDisplay(kpis = {}) {
    const bankroll = kpis.currentBankroll || 0;
    const profit = kpis.totalProfit || 0;
    const roi = kpis.roi !== undefined ? kpis.roi : (kpis.yieldPct || 0);
    const winRate = kpis.winRate || 0;
    const avgOdd = kpis.avgOdd || 0;
    const avgStake = kpis.avgStake || 0;
    const netCash = kpis.netCashBalance || 0;
    const deposits = kpis.totalDeposits || 0;
    const withdrawals = kpis.totalWithdrawals || 0;

    const profitSign = bankroll >= 0 ? '+' : '';
    const bankrollEl = document.getElementById('kpi-bankroll');
    if (bankrollEl) bankrollEl.textContent = `${profitSign}R$ ${bankroll.toFixed(2)}`;

    // Profit
    const profitEl = document.getElementById('kpi-profit');
    const profitPctEl = document.getElementById('kpi-profit-pct');
    const plLine = document.getElementById('kpi-pl-line');
    const plIcon = document.getElementById('kpi-pl-icon');

    const isPositive = profit >= 0;
    if (profitEl) {
      profitEl.textContent = `${isPositive ? '+R$ ' : '-R$ '}${Math.abs(profit).toFixed(2)}`;
      profitEl.className = `text-lg lg:text-xl font-extrabold font-mono ${isPositive ? 'text-super-green' : 'text-super-red'}`;
    }
    
    if (profitPctEl) {
      profitPctEl.textContent = `${isPositive ? '+' : ''}${roi.toFixed(1)}%`;
      profitPctEl.className = `text-[11px] mt-1 flex items-center gap-1 font-mono ${isPositive ? 'text-super-green' : 'text-super-red'}`;
    }

    if (plLine) plLine.className = `card-accent-line ${isPositive ? 'bg-super-green' : 'bg-super-red'}`;
    if (plIcon) {
      plIcon.className = `w-7 h-7 rounded-lg flex items-center justify-center ${isPositive ? 'bg-super-green/10 text-super-green' : 'bg-super-red/10 text-super-red'}`;
      plIcon.innerHTML = `<i data-lucide="${isPositive ? 'trending-up' : 'trending-down'}" class="w-4 h-4"></i>`;
    }

    // Win Rate
    const winRateEl = document.getElementById('kpi-winrate');
    if (winRateEl) winRateEl.textContent = `${winRate.toFixed(1)}%`;
    const greensEl = document.getElementById('kpi-greens-count');
    if (greensEl) greensEl.textContent = `${kpis.greensCount || 0}G`;
    const redsEl = document.getElementById('kpi-reds-count');
    if (redsEl) redsEl.textContent = `${kpis.redsCount || 0}R`;

    // Odds & Stake
    const avgOddEl = document.getElementById('kpi-avg-odd');
    if (avgOddEl) avgOddEl.textContent = `@ ${avgOdd.toFixed(2)}`;
    const avgStakeEl = document.getElementById('kpi-avg-stake');
    if (avgStakeEl) avgStakeEl.textContent = `R$ ${avgStake.toFixed(2)}`;

    // Cashflow
    const cashEl = document.getElementById('kpi-cash-balance');
    if (cashEl) {
      cashEl.textContent = `${netCash >= 0 ? '+R$ ' : '-R$ '}${Math.abs(netCash).toFixed(2)}`;
      cashEl.className = `text-lg lg:text-xl font-extrabold font-mono ${netCash >= 0 ? 'text-super-green' : 'text-super-red'}`;
    }

    const depEl = document.getElementById('kpi-total-deposits');
    if (depEl) depEl.textContent = `+R$ ${deposits.toFixed(0)}`;
    const withEl = document.getElementById('kpi-total-withdrawals');
    if (withEl) withEl.textContent = `-R$ ${withdrawals.toFixed(0)}`;

    // Doughnut sub-stats
    const statGreens = document.getElementById('stat-greens');
    if (statGreens) statGreens.textContent = kpis.greensCount || 0;
    const statReds = document.getElementById('stat-reds');
    if (statReds) statReds.textContent = kpis.redsCount || 0;
    const statOpen = document.getElementById('stat-open');
    if (statOpen) statOpen.textContent = kpis.openCount || 0;

    // Streak badge
    const streakBadge = document.getElementById('streak-badge');
    if (streakBadge && kpis.streak) {
      if (kpis.streak.type === 'GREEN' && kpis.streak.count > 0) {
        streakBadge.className = 'px-2 py-0.5 text-[10px] font-bold rounded-md bg-super-green/20 text-super-green border border-super-green/30';
        streakBadge.textContent = `🔥 ${kpis.streak.count} Greens Seguidos`;
      } else if (kpis.streak.type === 'RED' && kpis.streak.count > 0) {
        streakBadge.className = 'px-2 py-0.5 text-[10px] font-bold rounded-md bg-super-red/20 text-super-red border border-super-red/30';
        streakBadge.textContent = `⚠️ ${kpis.streak.count} Reds Seguidos`;
      } else {
        streakBadge.className = 'px-2 py-0.5 text-[10px] font-bold rounded-md bg-dark-bg text-gray-400 border border-dark-border';
        streakBadge.textContent = 'Streak: 0';
      }
    }

    // Cashflow tab summary cards
    const txDepEl = document.getElementById('tx-total-deposits');
    if (txDepEl) txDepEl.textContent = `+ R$ ${deposits.toFixed(2)}`;
    const txWithEl = document.getElementById('tx-total-withdrawals');
    if (txWithEl) txWithEl.textContent = `- R$ ${withdrawals.toFixed(2)}`;
    const txNetEl = document.getElementById('tx-net-balance');
    if (txNetEl) {
      txNetEl.textContent = `${netCash >= 0 ? '+ R$ ' : '- R$ '}${Math.abs(netCash).toFixed(2)}`;
      txNetEl.className = `text-xl font-extrabold font-mono mt-1 ${netCash >= 0 ? 'text-super-green' : 'text-super-red'}`;
    }
  }

  /**
   * Render Recent Bets on Dashboard
   */
  renderRecentBets(bets) {
    const container = document.getElementById('recent-bets-grid');
    if (!container) return;

    const recent = bets.slice(0, 3);
    if (recent.length === 0) {
      container.innerHTML = `<p class="text-xs text-gray-400 col-span-3 text-center py-4">Nenhum bilhete recente.</p>`;
      return;
    }

    container.innerHTML = recent.map(b => this.createBetCardHTML(b)).join('');
  }

  /**
   * Render Full Bets List with filters and search
   */
  renderBetsList(bets) {
    const container = document.getElementById('all-bets-container');
    const emptyState = document.getElementById('bets-empty-state');
    const navCount = document.getElementById('nav-bets-count');

    if (navCount) navCount.textContent = bets.length;

    // Filter counts
    const wonCount = bets.filter(b => b.status === 'WON').length;
    const lostCount = bets.filter(b => b.status === 'LOST').length;
    const openCount = bets.filter(b => b.status === 'OPEN').length;
    const cashoutCount = bets.filter(b => b.status === 'CASHOUT').length;

    document.getElementById('count-all').textContent = bets.length;
    document.getElementById('count-won').textContent = wonCount;
    document.getElementById('count-lost').textContent = lostCount;
    document.getElementById('count-open').textContent = openCount;
    document.getElementById('count-cashout').textContent = cashoutCount;

    // Apply active filter & search
    let filtered = bets;
    if (this.currentBetStatusFilter !== 'ALL') {
      filtered = filtered.filter(b => b.status === this.currentBetStatusFilter);
    }

    if (this.currentSearchQuery) {
      const q = this.currentSearchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        (b.event && b.event.toLowerCase().includes(q)) ||
        (b.market && b.market.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = '';
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      container.innerHTML = filtered.map(b => this.createBetCardHTML(b)).join('');
    }
  }

  /**
   * Creates the visual HTML card for a Superbet slip
   */
  createBetCardHTML(bet) {
    const isWon = bet.status === 'WON';
    const isLost = bet.status === 'LOST';
    const isOpen = bet.status === 'OPEN';
    const isCashout = bet.status === 'CASHOUT';

    let cardClass = 'open';
    let statusBadge = '';
    let returnRow = '';

    if (isWon) {
      cardClass = 'won';
      statusBadge = `
        <span class="w-5 h-5 rounded-full bg-super-green/20 text-super-green flex items-center justify-center font-bold text-xs">
          <i data-lucide="check" class="w-3 h-3"></i>
        </span>`;
      returnRow = `
        <div class="mt-3 pt-2.5 border-t border-dark-border/60 flex items-center justify-between">
          <span class="text-xs font-bold text-white uppercase tracking-wider">PRÊMIO</span>
          <span class="text-base font-extrabold text-super-green font-mono">R$ ${(bet.payout || (bet.stake * bet.odd)).toFixed(2)}</span>
        </div>`;
    } else if (isLost) {
      cardClass = 'lost';
      statusBadge = `
        <span class="w-5 h-5 rounded-full bg-super-red/20 text-super-red flex items-center justify-center font-bold text-xs">
          <i data-lucide="x" class="w-3 h-3"></i>
        </span>`;
      returnRow = `
        <div class="mt-3 pt-2.5 border-t border-dark-border/60 flex items-center justify-between text-xs text-super-red font-semibold">
          <span>STATUS</span>
          <span>PERDIDA (RED)</span>
        </div>`;
    } else if (isOpen) {
      cardClass = 'open';
      statusBadge = `
        <span class="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
          <i data-lucide="clock" class="w-3 h-3"></i>
        </span>`;
      returnRow = `
        <div class="mt-3 pt-2.5 border-t border-dark-border/60 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-gray-300 uppercase">GANHO POTENCIAL</span>
            <span class="text-sm font-extrabold text-white font-mono">R$ ${(bet.payout || (bet.stake * bet.odd)).toFixed(2)}</span>
          </div>
          <button onclick="window.app.quickCashout('${bet.id}')" class="w-full py-1.5 rounded-lg bg-super-green text-black font-bold text-xs flex items-center justify-center gap-1 hover:brightness-110 transition-all cursor-pointer">
            Cashout R$ ${(bet.cashoutValue || bet.stake).toFixed(2)}
          </button>
        </div>`;
    } else if (isCashout) {
      cardClass = 'cashout';
      statusBadge = `
        <span class="w-5 h-5 rounded-full bg-super-gold/20 text-super-gold flex items-center justify-center font-bold text-xs">
          <i data-lucide="zap" class="w-3 h-3"></i>
        </span>`;
      returnRow = `
        <div class="mt-3 pt-2.5 border-t border-dark-border/60 flex items-center justify-between">
          <span class="text-xs font-bold text-super-gold uppercase">CASHOUT RECEBIDO</span>
          <span class="text-sm font-extrabold text-white font-mono">R$ ${(bet.payout || bet.cashoutValue || bet.stake).toFixed(2)}</span>
        </div>`;
    }

    let formattedDate = 'Data n/a';
    try {
      const d = new Date(bet.date);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (e) {
      formattedDate = 'Data n/a';
    }

    const hasBoost = bet.originalOdd && bet.originalOdd !== bet.odd;

    return `
      <div class="superbet-card ${cardClass} p-4.5 pl-5 relative flex flex-col justify-between group shadow-lg">
        <!-- Top Slip Bar -->
        <div>
          <div class="flex items-center justify-between text-gray-400 text-[11px] mb-2">
            <div class="flex items-center gap-1.5">
              <i data-lucide="file-text" class="w-3.5 h-3.5 text-gray-400"></i>
              <span class="font-mono text-gray-300">${formattedDate}</span>
            </div>
            <div class="flex items-center gap-2">
              ${statusBadge}
              <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <button onclick="window.app.editBet('${bet.id}')" class="p-1 text-gray-400 hover:text-white" title="Editar">
                  <i data-lucide="edit-2" class="w-3 h-3"></i>
                </button>
                <button onclick="window.app.deleteBet('${bet.id}')" class="p-1 text-gray-400 hover:text-red-400" title="Excluir">
                  <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Event Title -->
          <h4 class="text-sm font-bold text-white mb-1.5 leading-snug">
            ${bet.event}
          </h4>

          <!-- Selections / Market -->
          <div class="text-xs text-gray-300 flex items-start gap-1.5 mb-3 bg-dark-bg/60 p-2 rounded-lg border border-dark-border/40">
            <span class="${isWon ? 'text-super-green' : (isLost ? 'text-super-red' : 'text-gray-400')} font-bold">
              ${isWon ? '✅' : (isLost ? '❌' : '•')}
            </span>
            <div class="flex-1 font-medium leading-tight">
              ${bet.market}
              ${hasBoost ? `<span class="text-super-gold text-[10px] ml-1 font-mono font-bold">⚡ SuperOdds</span>` : ''}
            </div>
          </div>

          <!-- Odds & Stake Row -->
          <div class="grid grid-cols-2 gap-2 text-xs pt-1">
            <div>
              <span class="text-[10px] text-gray-400 uppercase tracking-wider block">APOSTA</span>
              <span class="text-sm font-extrabold text-white font-mono">R$ ${(parseFloat(bet.stake) || 0).toFixed(2)}</span>
            </div>
            <div class="text-right">
              <span class="text-[10px] text-gray-400 uppercase tracking-wider block">ODDS TOTAIS</span>
              <span class="text-sm font-extrabold text-white font-mono">
                ${hasBoost && bet.originalOdd ? `<span class="line-through text-gray-500 text-xs mr-1">${(parseFloat(bet.originalOdd) || 0).toFixed(2)}</span>` : ''}
                <span class="${hasBoost ? 'text-super-gold' : 'text-white'}">${(parseFloat(bet.odd) || 0).toFixed(2)}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Dynamic Bottom Return Row -->
        <div>
          ${returnRow}
          
          <!-- Quick Status Actions for Open Bets -->
          ${isOpen ? `
            <div class="flex items-center gap-1.5 mt-2 pt-2 border-t border-dark-border/40">
              <button onclick="window.app.setBetStatus('${bet.id}', 'WON')" class="flex-1 py-1 rounded bg-super-green/15 text-super-green hover:bg-super-green/25 font-semibold text-[10px] flex items-center justify-center gap-1">
                <i data-lucide="check" class="w-3 h-3"></i> Green
              </button>
              <button onclick="window.app.setBetStatus('${bet.id}', 'LOST')" class="flex-1 py-1 rounded bg-super-red/15 text-super-red hover:bg-super-red/25 font-semibold text-[10px] flex items-center justify-center gap-1">
                <i data-lucide="x" class="w-3 h-3"></i> Red
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render Transactions Table (Caixa)
   */
  renderTransactionsList(transactions) {
    const tbody = document.getElementById('transactions-tbody');
    const countEl = document.getElementById('tx-table-count');
    const depositsCountEl = document.getElementById('tx-count-deposits');
    const withdrawalsCountEl = document.getElementById('tx-count-withdrawals');

    if (!tbody) return;

    const depCount = transactions.filter(t => t.type === 'DEPOSIT').length;
    const withCount = transactions.filter(t => t.type === 'WITHDRAWAL').length;

    if (countEl) countEl.textContent = `${transactions.length} registros`;
    if (depositsCountEl) depositsCountEl.textContent = `${depCount} depósitos aprovados`;
    if (withdrawalsCountEl) withdrawalsCountEl.textContent = `${withCount} retiradas pagas`;

    if (transactions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-400">Nenhuma transação registrada.</td></tr>`;
      return;
    }

    tbody.innerHTML = transactions.map(t => {
      const isDeposit = t.type === 'DEPOSIT';
      const formattedDate = new Date(t.date).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <tr class="hover:bg-dark-card-hover/40 transition-colors">
          <td class="py-3 px-4 flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg ${isDeposit ? 'bg-super-green/10 text-super-green' : 'bg-super-red/10 text-super-red'} flex items-center justify-center">
              <i data-lucide="${isDeposit ? 'arrow-down-left' : 'arrow-up-right'}" class="w-4 h-4"></i>
            </div>
            <span class="font-semibold text-white">${isDeposit ? 'Depósito' : 'Retirada'}</span>
          </td>
          <td class="py-3 px-4 text-gray-400 font-mono">${formattedDate}</td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 text-[10px] font-semibold rounded-full ${isDeposit ? 'bg-super-green/10 text-super-green border border-super-green/20' : 'bg-gray-500/10 text-gray-300 border border-gray-500/20'}">
              ${isDeposit ? 'Aprovado' : 'Pago'}
            </span>
          </td>
          <td class="py-3 px-4 text-right font-mono font-bold ${isDeposit ? 'text-super-green' : 'text-super-red'}">
            ${isDeposit ? '+ R$ ' : '- R$ '}${t.amount.toFixed(2)}
          </td>
          <td class="py-3 px-4 text-center">
            <button onclick="window.app.deleteTransaction('${t.id}')" class="p-1 text-gray-400 hover:text-red-400 transition-colors cursor-pointer" title="Excluir">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Render Monthly Analytics Table
   */
  renderMonthlyTable(bets) {
    const tbody = document.getElementById('monthly-analytics-tbody');
    if (!tbody) return;

    const monthlyData = AnalyticsService.getMonthlyAnalytics(bets);
    if (monthlyData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-400">Sem dados mensais.</td></tr>`;
      return;
    }

    tbody.innerHTML = monthlyData.map(m => `
      <tr class="hover:bg-dark-card-hover/40">
        <td class="py-2.5 px-3 font-semibold text-white capitalize">${m.label}</td>
        <td class="py-2.5 px-3 font-mono">${m.betsCount}</td>
        <td class="py-2.5 px-3 font-mono text-super-green">${m.winRate}</td>
        <td class="py-2.5 px-3 font-mono ${m.isPositive ? 'text-super-green' : 'text-super-red'}">${m.roi}</td>
        <td class="py-2.5 px-3 text-right font-mono font-bold ${m.isPositive ? 'text-super-green' : 'text-super-red'}">
          ${m.profitFormatted}
        </td>
      </tr>
    `).join('');
  }

  /**
   * Navigation
   */
  switchTab(tab) {
    if (!tab) return;
    this.currentTab = tab;

    // Update nav buttons
    document.querySelectorAll('[data-tab]').forEach(b => {
      if (b.getAttribute('data-tab') === tab && b.classList.contains('nav-btn')) {
        b.classList.add('active');
      } else if (b.classList.contains('nav-btn')) {
        b.classList.remove('active');
      }
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
      if (pane.id === `tab-${tab}`) {
        pane.classList.remove('hidden');
      } else {
        pane.classList.add('hidden');
      }
    });

    // Scroll to top when switching tab
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.render();
  }

  setupNavigation() {
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Dropdown add menu
    const addMenuBtn = document.getElementById('add-manual-menu-btn');
    const addMenuDropdown = document.getElementById('add-menu-dropdown');
    if (addMenuBtn && addMenuDropdown) {
      addMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addMenuDropdown.classList.toggle('hidden');
      });
      document.addEventListener('click', () => {
        addMenuDropdown.classList.add('hidden');
      });
    }
  }

  /**
   * Period & Bet Filter Handlers
   */
  setupFilters() {
    // Period filter
    document.querySelectorAll('.filter-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentPeriod = btn.getAttribute('data-period');
        this.render();
      });
    });

    // Status filter
    document.querySelectorAll('.bet-status-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bet-status-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentBetStatusFilter = btn.getAttribute('data-status');
        this.render();
      });
    });

    // Search input
    const searchInput = document.getElementById('bets-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.currentSearchQuery = e.target.value;
        this.renderBetsList(StorageService.getBets());
        if (typeof lucide !== 'undefined') lucide.createIcons();
      });
    }
  }

  /**
   * OCR Scanner Modal & Drag-Drop Handling
   */
  setupOCRScanner() {
    const scannerModal = document.getElementById('scanner-modal');
    const openBtns = [
      document.getElementById('open-scanner-btn'),
      document.getElementById('open-scanner-btn-2'),
      document.getElementById('open-scanner-tx-btn'),
      document.getElementById('empty-state-scanner-btn')
    ];
    const closeBtn = document.getElementById('btn-close-scanner');
    const cancelBtn = document.getElementById('btn-cancel-scan');
    const confirmBtn = document.getElementById('btn-confirm-scan');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('scanner-file-input');

    const openModal = () => {
      this.resetScannerUI();
      scannerModal.classList.remove('hidden');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    const closeModal = () => {
      scannerModal.classList.add('hidden');
    };

    openBtns.forEach(btn => {
      if (btn) btn.addEventListener('click', openModal);
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Dropzone interactions
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());
      
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-super-green', 'bg-super-green/10');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-super-green', 'bg-super-green/10');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-super-green', 'bg-super-green/10');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleImageFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleImageFile(e.target.files[0]);
        }
      });
    }

    // Confirm scan & Save
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        this.saveScannedResults();
        closeModal();
      });
    }
  }

  /**
   * Global Ctrl+V paste listener anywhere on window
   */
  setupGlobalPaste() {
    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          const scannerModal = document.getElementById('scanner-modal');
          scannerModal.classList.remove('hidden');
          this.resetScannerUI();
          this.handleImageFile(file);
          break;
        }
      }
    });
  }

  /**
   * Process uploaded/pasted image with OCR Service
   */
  async handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;
      
      const loadingEl = document.getElementById('scanner-loading');
      const statusText = document.getElementById('scanner-status-text');
      const progressBar = document.getElementById('scanner-progress-bar');
      const resultContainer = document.getElementById('scan-result-container');
      const dropZone = document.getElementById('drop-zone');

      dropZone.classList.add('hidden');
      loadingEl.classList.remove('hidden');
      resultContainer.classList.add('hidden');

      try {
        const result = await OCRService.scanImage(base64, (pct, msg) => {
          if (progressBar) progressBar.style.width = `${pct}%`;
          if (statusText) statusText.textContent = msg;
        });

        this.scannedData = result;
        loadingEl.classList.add('hidden');
        resultContainer.classList.remove('hidden');
        document.getElementById('btn-confirm-scan').removeAttribute('disabled');

        this.populateScannerPreview(result);
        if (typeof lucide !== 'undefined') lucide.createIcons();

      } catch (err) {
        console.error('Scan failed:', err);
        loadingEl.classList.add('hidden');
        dropZone.classList.remove('hidden');
        this.showToast('Erro ao processar imagem. Tente novamente.', 'error');
      }
    };
    reader.readAsDataURL(file);
  }

  /**
   * Populates scanner extraction form for user confirmation
   */
  populateScannerPreview(data) {
    const badge = document.getElementById('detected-type-badge');
    const fieldsContainer = document.getElementById('scan-extracted-fields');

    if (data.type === 'PAYMENT_HISTORY') {
      badge.textContent = `Extrato de Transações (${data.transactions.length} detectadas)`;
      badge.className = 'px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/20 text-purple-400 border border-purple-500/30';

      fieldsContainer.innerHTML = `
        <div class="bg-dark-bg/80 border border-dark-border rounded-xl p-3 max-h-56 overflow-y-auto divide-y divide-dark-border text-xs">
          ${data.transactions.map((t, idx) => `
            <div class="py-2 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${t.type === 'DEPOSIT' ? 'bg-super-green' : 'bg-super-red'}"></span>
                <span class="font-bold text-white">${t.type === 'DEPOSIT' ? 'Depósito' : 'Retirada'}</span>
                <span class="text-gray-400 font-mono text-[11px]">${new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <span class="font-mono font-bold ${t.type === 'DEPOSIT' ? 'text-super-green' : 'text-super-red'}">
                ${t.type === 'DEPOSIT' ? '+ ' : '- '}R$ ${t.amount.toFixed(2)}
              </span>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      // Bet Slip
      const statusLabels = {
        'WON': 'Ganha (Green 💚)',
        'LOST': 'Perdida (Red ❌)',
        'OPEN': 'Aberta / Cashout ⚡',
        'CASHOUT': 'Cashout Realizado'
      };

      badge.textContent = `Bilhete: ${statusLabels[data.status] || data.status}`;
      badge.className = `px-2 py-0.5 text-[10px] font-bold rounded ${data.status === 'WON' ? 'bg-super-green/20 text-super-green border-super-green/30' : (data.status === 'LOST' ? 'bg-super-red/20 text-super-red border-super-red/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30')}`;

      fieldsContainer.innerHTML = `
        <div class="grid grid-cols-2 gap-3 bg-dark-bg/60 p-4 rounded-xl border border-dark-border text-xs">
          <div class="col-span-2">
            <label class="block text-gray-400 mb-1">Evento / Times</label>
            <input type="text" id="scan-event" value="${data.event}" class="input-field w-full px-3 py-1.5 rounded-lg font-semibold" />
          </div>
          <div class="col-span-2">
            <label class="block text-gray-400 mb-1">Mercado / Seleções</label>
            <input type="text" id="scan-market" value="${data.market}" class="input-field w-full px-3 py-1.5 rounded-lg" />
          </div>
          <div>
            <label class="block text-gray-400 mb-1">Valor Apostado (R$)</label>
            <input type="number" step="0.01" id="scan-stake" value="${data.stake}" class="input-field w-full px-3 py-1.5 rounded-lg font-mono font-bold" />
          </div>
          <div>
            <label class="block text-gray-400 mb-1">Odd Total</label>
            <input type="number" step="0.01" id="scan-odd" value="${data.odd}" class="input-field w-full px-3 py-1.5 rounded-lg font-mono font-bold text-super-gold" />
          </div>
          <div>
            <label class="block text-gray-400 mb-1">Status</label>
            <select id="scan-status" class="input-field w-full px-3 py-1.5 rounded-lg">
              <option value="WON" ${data.status === 'WON' ? 'selected' : ''}>Ganha (Green)</option>
              <option value="LOST" ${data.status === 'LOST' ? 'selected' : ''}>Perdida (Red)</option>
              <option value="OPEN" ${data.status === 'OPEN' ? 'selected' : ''}>Aberta</option>
              <option value="CASHOUT" ${data.status === 'CASHOUT' ? 'selected' : ''}>Cashout</option>
            </select>
          </div>
          <div>
            <label class="block text-gray-400 mb-1">Retorno / Prêmio (R$)</label>
            <input type="number" step="0.01" id="scan-payout" value="${data.payout || (data.stake * data.odd).toFixed(2)}" class="input-field w-full px-3 py-1.5 rounded-lg font-mono font-bold text-super-green" />
          </div>
        </div>
      `;
    }
  }

  /**
   * Save extracted scan result to database
   */
  saveScannedResults() {
    if (!this.scannedData) return;

    if (this.scannedData.type === 'PAYMENT_HISTORY') {
      StorageService.addTransactionsBatch(this.scannedData.transactions);
      this.showToast(`Sucesso! ${this.scannedData.transactions.length} transações importadas.`, 'success');
    } else {
      const event = document.getElementById('scan-event').value;
      const market = document.getElementById('scan-market').value;
      const stake = parseFloat(document.getElementById('scan-stake').value) || 0;
      const odd = parseFloat(document.getElementById('scan-odd').value) || 1.80;
      const status = document.getElementById('scan-status').value;
      const payout = parseFloat(document.getElementById('scan-payout').value) || 0;

      const newBet = StorageService.addBet({
        event,
        market,
        stake,
        odd,
        status,
        payout: status === 'WON' ? payout : (status === 'CASHOUT' ? payout : 0),
        cashoutValue: status === 'OPEN' ? stake : 0,
        date: this.scannedData.date || new Date().toISOString()
      });

      if (status === 'WON' && typeof confetti === 'function') {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      }

      this.showToast('Bilhete importado com sucesso!', 'success');
    }

    this.render();
  }

  resetScannerUI() {
    this.scannedData = null;
    document.getElementById('drop-zone').classList.remove('hidden');
    document.getElementById('scanner-loading').classList.add('hidden');
    document.getElementById('scan-result-container').classList.add('hidden');
    document.getElementById('btn-confirm-scan').setAttribute('disabled', 'true');
    const fileInput = document.getElementById('scanner-file-input');
    if (fileInput) fileInput.value = '';
  }

  /**
   * Setup Manual Modals (Bet & Transaction)
   */
  setupManualModals() {
    // Bet Modal
    const betModal = document.getElementById('bet-modal');
    const btnAddBet = document.getElementById('btn-add-bet-manual');
    const btnCloseBet = document.getElementById('btn-close-bet-modal');
    const btnCancelBet = document.getElementById('btn-cancel-bet');
    const betForm = document.getElementById('bet-form');

    const openBetModal = (bet = null) => {
      betForm.reset();
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      document.getElementById('bet-date').value = now.toISOString().slice(0, 16);

      if (bet) {
        document.getElementById('bet-modal-title').textContent = 'Editar Bilhete';
        document.getElementById('bet-id').value = bet.id;
        document.getElementById('bet-event').value = bet.event;
        document.getElementById('bet-market').value = bet.market;
        document.getElementById('bet-stake').value = bet.stake;
        document.getElementById('bet-odd').value = bet.odd;
        document.getElementById('bet-status').value = bet.status;
        document.getElementById('bet-payout').value = bet.payout || '';
        document.getElementById('bet-date').value = bet.date.slice(0, 16);
      } else {
        document.getElementById('bet-modal-title').textContent = 'Novo Bilhete de Aposta';
        document.getElementById('bet-id').value = '';
      }
      betModal.classList.remove('hidden');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    if (btnAddBet) btnAddBet.addEventListener('click', () => openBetModal());
    if (btnCloseBet) btnCloseBet.addEventListener('click', () => betModal.classList.add('hidden'));
    if (btnCancelBet) btnCancelBet.addEventListener('click', () => betModal.classList.add('hidden'));

    if (betForm) {
      betForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('bet-id').value;
        const event = document.getElementById('bet-event').value;
        const market = document.getElementById('bet-market').value;
        const stake = parseFloat(document.getElementById('bet-stake').value) || 0;
        const odd = parseFloat(document.getElementById('bet-odd').value) || 1.80;
        const status = document.getElementById('bet-status').value;
        const payout = parseFloat(document.getElementById('bet-payout').value) || (status === 'WON' ? stake * odd : 0);
        const date = new Date(document.getElementById('bet-date').value).toISOString();

        if (id) {
          StorageService.updateBet(id, { event, market, stake, odd, status, payout, date });
          this.showToast('Bilhete atualizado com sucesso!', 'success');
        } else {
          StorageService.addBet({ event, market, stake, odd, status, payout, date });
          this.showToast('Novo bilhete salvo!', 'success');
        }

        betModal.classList.add('hidden');
        this.render();
      });
    }

    // Transaction Modal
    const txModal = document.getElementById('tx-modal');
    const btnAddTx = document.getElementById('btn-add-transaction-manual');
    const btnAddTx2 = document.getElementById('btn-add-tx-modal');
    const btnCloseTx = document.getElementById('btn-close-tx-modal');
    const btnCancelTx = document.getElementById('btn-cancel-tx');
    const txForm = document.getElementById('tx-form');

    const openTxModal = () => {
      txForm.reset();
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      document.getElementById('tx-date').value = now.toISOString().slice(0, 16);
      txModal.classList.remove('hidden');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    if (btnAddTx) btnAddTx.addEventListener('click', openTxModal);
    if (btnAddTx2) btnAddTx2.addEventListener('click', openTxModal);
    if (btnCloseTx) btnCloseTx.addEventListener('click', () => txModal.classList.add('hidden'));
    if (btnCancelTx) btnCancelTx.addEventListener('click', () => txModal.classList.add('hidden'));

    if (txForm) {
      txForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('tx-type').value;
        const amount = parseFloat(document.getElementById('tx-amount').value) || 0;
        const date = new Date(document.getElementById('tx-date').value).toISOString();

        StorageService.addTransaction({ type, amount, date });
        txModal.classList.add('hidden');
        this.showToast('Transação registrada!', 'success');
        this.render();
      });
    }

    // Attach to global window for inline onclicks
    window.app = {
      editBet: (id) => {
        const bet = StorageService.getBets().find(b => b.id === id);
        if (bet) openBetModal(bet);
      },
      deleteBet: (id) => {
        if (confirm('Deseja realmente excluir este bilhete?')) {
          StorageService.deleteBet(id);
          this.showToast('Bilhete excluído.', 'info');
          this.render();
        }
      },
      setBetStatus: (id, status) => {
        const bet = StorageService.getBets().find(b => b.id === id);
        if (bet) {
          const payout = status === 'WON' ? (bet.stake * bet.odd) : 0;
          StorageService.updateBet(id, { status, payout });
          if (status === 'WON' && typeof confetti === 'function') {
            confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
          }
          this.showToast(`Bilhete marcado como ${status === 'WON' ? 'Green!' : 'Red.'}`, 'success');
          this.render();
        }
      },
      quickCashout: (id) => {
        const bet = StorageService.getBets().find(b => b.id === id);
        if (bet) {
          const cVal = prompt('Informe o valor do Cashout recebido em R$:', bet.cashoutValue || bet.stake);
          if (cVal !== null) {
            const parsed = parseFloat(cVal) || bet.stake;
            StorageService.updateBet(id, { status: 'CASHOUT', payout: parsed, cashoutValue: parsed });
            this.showToast('Cashout realizado com sucesso!', 'success');
            this.render();
          }
        }
      },
      deleteTransaction: (id) => {
        if (confirm('Deseja excluir esta transação?')) {
          StorageService.deleteTransaction(id);
          this.showToast('Transação excluída.', 'info');
          this.render();
        }
      }
    };
  }

  /**
   * Settings, Backup & CSV Exports
   */
  setupSettingsAndBackups() {
    const saveBtn = document.getElementById('btn-save-settings');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const initialBankroll = parseFloat(document.getElementById('setting-initial-bank').value) || 100;
        const unitValue = parseFloat(document.getElementById('setting-unit-value').value) || 10;
        StorageService.saveSettings({ initialBankroll, unitValue });
        this.showToast('Configurações salvas com sucesso!', 'success');
        this.render();
      });
    }

    const exportCsvBtn = document.getElementById('btn-export-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        StorageService.exportBetsCSV();
        this.showToast('Planilha CSV exportada!', 'success');
      });
    }

    const exportBackupBtn = document.getElementById('btn-export-backup');
    if (exportBackupBtn) {
      exportBackupBtn.addEventListener('click', () => {
        StorageService.exportFullBackup();
        this.showToast('Backup JSON exportado com sucesso!', 'success');
      });
    }

    const importInput = document.getElementById('input-import-backup');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              StorageService.importFullBackup(evt.target.result);
              this.showToast('Backup restaurado com sucesso!', 'success');
              this.render();
            } catch (err) {
              this.showToast('Arquivo de backup inválido.', 'error');
            }
          };
          reader.readAsText(file);
        }
      });
    }

    const resetDemoBtn = document.getElementById('btn-reset-demo');
    if (resetDemoBtn) {
      resetDemoBtn.addEventListener('click', () => {
        if (confirm('Deseja restaurar os dados de exemplo da Superbet?')) {
          StorageService.resetToDemoData();
          this.showToast('Dados de exemplo restaurados!', 'success');
          this.render();
        }
      });
    }
  }

  loadSettingsForm(settings) {
    const bankInput = document.getElementById('setting-initial-bank');
    const unitInput = document.getElementById('setting-unit-value');
    if (bankInput) bankInput.value = settings.initialBankroll;
    if (unitInput) unitInput.value = settings.unitValue;
  }

  /**
   * Toast notification system
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const icons = {
      success: 'check-circle-2',
      error: 'alert-circle',
      info: 'info'
    };
    const colors = {
      success: 'text-super-green border-super-green/30',
      error: 'text-super-red border-super-red/30',
      info: 'text-super-gold border-super-gold/30'
    };

    toast.className = `toast border ${colors[type] || colors.info}`;
    toast.innerHTML = `
      <i data-lucide="${icons[type] || 'info'}" class="w-4 h-4"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// Start application
window.addEventListener('DOMContentLoaded', () => {
  new SuperTrackerApp();
});
