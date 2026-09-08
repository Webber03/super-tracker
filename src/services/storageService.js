/**
 * Storage & Data Persistence Service.
 * Manages LocalStorage, initial seed data based on Superbet screenshots,
 * and JSON/CSV import/export.
 */

const STORAGE_KEYS = {
  BETS: 'supertracker_bets_v1',
  TRANSACTIONS: 'supertracker_tx_v1',
  SETTINGS: 'supertracker_settings_v1'
};

const DEFAULT_SETTINGS = {
  initialBankroll: 0,
  unitValue: 10.00,
  currency: 'R$'
};

// Initial seeds preloaded from the user's Superbet screenshots
const DEMO_BETS = [
  {
    id: 'bet_real_madrid',
    event: 'Betis — Real Madrid',
    market: 'Antony - Mais de 0.5 Chutes + Vini Jr - Mais de 0.5 Chutes',
    odd: 2.42,
    originalOdd: 2.05,
    stake: 25.00,
    payout: 60.50,
    status: 'OPEN', // Aberta / Cashout R$ 25,00
    cashoutValue: 25.00,
    date: '2026-09-04T12:00:00',
    tags: ['SuperOdds', 'Chutes no Gol', 'La Liga']
  },
  {
    id: 'bet_leones_orense',
    event: 'Leones del Norte — Orense',
    market: '1º Tempo - Total de Gols — Mais de 0.5',
    odd: 1.97,
    stake: 7.77,
    payout: 0,
    status: 'LOST', // Red
    date: '2026-09-03T19:21:00',
    tags: ['1º Tempo', 'Gols']
  },
  {
    id: 'bet_gyor_ferencvaros',
    event: 'Gyor ETO — Ferencvaros',
    market: 'Total de Gols — Mais de 2.5',
    odd: 1.51,
    stake: 21.70,
    payout: 32.77,
    status: 'WON', // Green
    date: '2026-09-03T16:02:00',
    tags: ['Over 2.5', 'Gols']
  },
  {
    id: 'bet_arsenal_chelsea',
    event: 'Arsenal — Chelsea',
    market: 'Ambas Equipes Marcam — Sim',
    odd: 1.75,
    stake: 20.00,
    payout: 35.00,
    status: 'WON',
    date: '2026-09-02T16:00:00',
    tags: ['Ambas Marcam', 'Premier League']
  },
  {
    id: 'bet_flamengo_palmeiras',
    event: 'Flamengo — Palmeiras',
    market: 'Total de Escanteios — Mais de 9.5',
    odd: 1.88,
    stake: 15.00,
    payout: 28.20,
    status: 'WON',
    date: '2026-09-01T20:00:00',
    tags: ['Cantos', 'Brasileirão']
  },
  {
    id: 'bet_bayern_dortmund',
    event: 'Bayern München — Dortmund',
    market: 'Total de Gols — Mais de 3.5',
    odd: 2.10,
    stake: 18.00,
    payout: 0,
    status: 'LOST',
    date: '2026-08-30T13:30:00',
    tags: ['Over Gols', 'Bundesliga']
  }
];

const DEMO_TRANSACTIONS = [
  { id: 'tx_1', type: 'DEPOSIT', status: 'APPROVED', amount: 40.00, date: '2026-09-03T14:51:00', description: 'Depósito Aprovado' },
  { id: 'tx_2', type: 'DEPOSIT', status: 'APPROVED', amount: 21.70, date: '2026-09-03T08:07:00', description: 'Depósito Aprovado' },
  { id: 'tx_3', type: 'WITHDRAWAL', status: 'APPROVED', amount: 45.01, date: '2026-09-02T13:09:00', description: 'Retirada Pago' },
  { id: 'tx_4', type: 'DEPOSIT', status: 'APPROVED', amount: 50.00, date: '2026-09-02T10:10:00', description: 'Depósito Aprovado' },
  { id: 'tx_5', type: 'WITHDRAWAL', status: 'APPROVED', amount: 56.07, date: '2026-09-01T22:14:00', description: 'Retirada Pago' },
  { id: 'tx_6', type: 'DEPOSIT', status: 'APPROVED', amount: 50.00, date: '2026-09-01T15:58:00', description: 'Depósito Aprovado' },
  { id: 'tx_7', type: 'WITHDRAWAL', status: 'APPROVED', amount: 50.00, date: '2026-08-31T16:15:00', description: 'Retirada Pago' },
  { id: 'tx_8', type: 'DEPOSIT', status: 'APPROVED', amount: 50.94, date: '2026-08-31T09:25:00', description: 'Depósito Aprovado' },
  { id: 'tx_9', type: 'DEPOSIT', status: 'APPROVED', amount: 26.64, date: '2026-08-30T15:35:00', description: 'Depósito Aprovado' },
  { id: 'tx_10', type: 'WITHDRAWAL', status: 'APPROVED', amount: 58.72, date: '2026-08-29T12:59:00', description: 'Retirada Pago' }
];

export class StorageService {
  /**
   * Initialize storage with defaults if empty
   */
  static init() {
    // Limpa dados de demo antigos (versão anterior auto-populava dados)
    const CLEAN_VERSION = 'v3_clean';
    if (localStorage.getItem('supertracker_version') !== CLEAN_VERSION) {
      localStorage.removeItem(STORAGE_KEYS.BETS);
      localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      localStorage.setItem('supertracker_version', CLEAN_VERSION);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      this.saveSettings(DEFAULT_SETTINGS);
    }
  }

  // --- BETS CRUD ---
  static getBets() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BETS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  static saveBets(bets) {
    localStorage.setItem(STORAGE_KEYS.BETS, JSON.stringify(bets));
  }

  static addBet(bet) {
    const bets = this.getBets();
    const newBet = {
      id: bet.id || 'bet_' + Date.now(),
      event: bet.event || 'Aposta Sem Título',
      market: bet.market || 'Geral',
      odd: parseFloat(bet.odd) || 1.80,
      stake: parseFloat(bet.stake) || 0,
      payout: parseFloat(bet.payout) || 0,
      status: bet.status || 'OPEN',
      date: bet.date || new Date().toISOString(),
      tags: bet.tags || []
    };
    bets.unshift(newBet);
    this.saveBets(bets);
    return newBet;
  }

  static updateBet(id, updatedFields) {
    const bets = this.getBets();
    const index = bets.findIndex(b => b.id === id);
    if (index !== -1) {
      bets[index] = { ...bets[index], ...updatedFields };
      this.saveBets(bets);
      return bets[index];
    }
    return null;
  }

  static deleteBet(id) {
    const bets = this.getBets().filter(b => b.id !== id);
    this.saveBets(bets);
    return bets;
  }

  // --- TRANSACTIONS CRUD ---
  static getTransactions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  static saveTransactions(txs) {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(txs));
  }

  static addTransaction(tx) {
    const txs = this.getTransactions();
    const newTx = {
      id: tx.id || 'tx_' + Date.now(),
      type: tx.type || 'DEPOSIT',
      status: tx.status || 'APPROVED',
      amount: parseFloat(tx.amount) || 0,
      date: tx.date || new Date().toISOString(),
      description: tx.description || (tx.type === 'DEPOSIT' ? 'Depósito Aprovado' : 'Retirada Paga')
    };
    txs.unshift(newTx);
    this.saveTransactions(txs);
    return newTx;
  }

  static addTransactionsBatch(newTxs) {
    const txs = this.getTransactions();
    // Avoid exact duplicate dates & amounts
    const filteredNew = newTxs.filter(nt => 
      !txs.some(existing => existing.date === nt.date && existing.amount === nt.amount && existing.type === nt.type)
    );
    const combined = [...filteredNew, ...txs];
    this.saveTransactions(combined);
    return combined;
  }

  static deleteTransaction(id) {
    const txs = this.getTransactions().filter(t => t.id !== id);
    this.saveTransactions(txs);
    return txs;
  }

  // --- SETTINGS ---
  static getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  }

  static saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  // --- BACKUP & EXPORT ---
  static exportFullBackup() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings: this.getSettings(),
      bets: this.getBets(),
      transactions: this.getTransactions()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supertracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static importFullBackup(jsonString) {
    const data = JSON.parse(jsonString);
    if (data.bets && Array.isArray(data.bets)) {
      this.saveBets(data.bets);
    }
    if (data.transactions && Array.isArray(data.transactions)) {
      this.saveTransactions(data.transactions);
    }
    if (data.settings) {
      this.saveSettings(data.settings);
    }
    return true;
  }

  static exportBetsCSV() {
    const bets = this.getBets();
    const headers = ['ID', 'Data', 'Evento', 'Mercado', 'Status', 'Stake (R$)', 'Odd', 'Premio (R$)', 'Lucro/Prejuizo (R$)'];
    const rows = bets.map(b => {
      const profit = b.status === 'WON' ? (b.payout - b.stake) : (b.status === 'LOST' ? -b.stake : 0);
      return [
        b.id,
        b.date,
        `"${(b.event || '').replace(/"/g, '""')}"`,
        `"${(b.market || '').replace(/"/g, '""')}"`,
        b.status,
        b.stake.toFixed(2),
        b.odd.toFixed(2),
        b.payout.toFixed(2),
        profit.toFixed(2)
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supertracker_bilhetes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static resetToDemoData() {
    this.saveBets(DEMO_BETS);
    this.saveTransactions(DEMO_TRANSACTIONS);
    this.saveSettings(DEFAULT_SETTINGS);
  }
}
