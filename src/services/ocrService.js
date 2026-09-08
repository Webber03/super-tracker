/**
 * OCR & Computer Vision Service specialized for Superbet screenshots.
 * Handles preprocessing, color detection (green check / red X / cashout),
 * and regex/NLP parsing for bet slips and payment history.
 */

export class OCRService {
  /**
   * Pre-process image on a hidden canvas for enhanced OCR accuracy.
   */
  static async preprocessImage(imageSrc) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const scale = img.width < 1000 ? 2 : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const colorAnalysis = this.analyzeSuperbetColors(ctx, canvas.width, canvas.height);
        resolve({ dataUrl: canvas.toDataURL('image/png'), colorAnalysis, width: canvas.width, height: canvas.height });
      };
      img.src = imageSrc;
    });
  }

  static analyzeSuperbetColors(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let greenPixels = 0, redPixels = 0, goldPixels = 0;
    const totalPixels = data.length / 4;
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (g > 150 && g > r * 1.3 && g > b * 1.3) greenPixels++;
      if (r > 160 && r > g * 1.4 && r > b * 1.4) redPixels++;
      if (r > 180 && g > 150 && b < 80) goldPixels++;
    }
    return {
      greenRatio: greenPixels / (totalPixels / 4),
      redRatio: redPixels / (totalPixels / 4),
      goldRatio: goldPixels / (totalPixels / 4)
    };
  }

  static async scanImage(imageFileOrBase64, onProgress = () => {}) {
    onProgress(10, 'Preparando imagem...');
    const preprocessed = await this.preprocessImage(imageFileOrBase64);
    onProgress(30, 'Reconhecendo caracteres (OCR)...');
    let text = '';
    try {
      if (typeof Tesseract !== 'undefined') {
        const result = await Tesseract.recognize(
          preprocessed.dataUrl, 'por+eng',
          { logger: m => { if (m.status === 'recognizing text') { onProgress(30 + Math.round((m.progress || 0) * 50), `Lendo texto (${Math.round((m.progress || 0) * 100)}%)...`); } } }
        );
        text = result.data.text || '';
      } else {
        throw new Error('Tesseract não carregado.');
      }
    } catch (err) {
      console.warn('OCR error:', err);
    }
    onProgress(85, 'Interpretando dados da Superbet...');
    const parsedData = this.parseSuperbetText(text, preprocessed.colorAnalysis);
    onProgress(100, 'Concluído!');
    return { rawText: text, ...parsedData };
  }

  static parseSuperbetText(rawText, colorAnalysis = {}) {
    const text = rawText || '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const isPaymentHistory = /HIST[OÓ]RICO\s+DE\s+PAGAMENTO|Dep[oó]sito\s*-\s*Aprovado|Retirada\s*-\s*Pago/i.test(text);
    if (isPaymentHistory) return this.parsePaymentHistory(text, lines);
    return this.parseBetSlip(text, lines, colorAnalysis);
  }

  /**
   * Parses Superbet Bet Slips (Greens, Reds, Open/Cashout)
   * Key distinctions:
   *   "PRÊMIO POT." ou "PRÊM POT." = aposta ABERTA (não é green!)
   *   "PRÊMIO" sozinho (sem POT) = aposta GANHA (green)
   *   "CASHOUT XX R$" = aposta aberta com cashout disponível
   */
  static parseBetSlip(text, lines, colorAnalysis) {

    // ── A. STATUS ──────────────────────────────────────────────────────────────
    // Detecta "PRÊMIO POT." ou "PRÊM POT." = aberta
    const hasPremioPot = /PR[EÊ]M(?:IO)?\s*POT\.?|PRÊMIO\s*POTENCIAL|PRÊM[IO]*\s*POT/i.test(text);
    // Detecta "GANHO POTENCIAL" = aberta
    const hasGanhoPotencial = /GANHO\s+POTENCIAL/i.test(text);
    // Detecta "CASHOUT" botão = aberta
    const hasCashout = /CASHOUT/i.test(text);
    // Detecta "PRÊMIO" puro (sem POT/POTENCIAL) = green
    const hasPremioWon = /PR[EÊ]MIO(?!\s*POT)(?!\s*POTENCIAL)/i.test(text) && !hasPremioPot;
    // Detecta X vermelho ou "CRIAR APOSTA" em aposta finalizada sem cashout (Red)
    const hasRedXIcon = /[xX✖✕]\s*CRIAR\s+APOSTA|[xX✖✕]\s*SIMPLES|[xX✖✕]\s*M[UÚ]LTIPLA|CRIAR\s+APOSTA/i.test(text);
    const hasRedSign = colorAnalysis.redRatio > 0.005 || /perdida|perda|cancelad/i.test(text) || hasRedXIcon;

    let status = 'OPEN';
    if (hasPremioWon && !hasPremioPot && !hasGanhoPotencial && !hasCashout) {
      status = 'WON';
    } else if ((hasRedSign || hasRedXIcon) && !hasCashout && !hasGanhoPotencial && !hasPremioPot) {
      status = 'LOST';
    } else {
      status = 'OPEN';
    }

    // ── B. EVENTO / TIMES ─────────────────────────────────────────────────────
    // Procura por linha de times (Contém '-', '—', '–' ou 'vs') ignorando valores e datas
    let eventName = '';
    for (const line of lines) {
      // Ignora linhas que são manifestamente datas, horários ou valores financeiro
      if (/\d{1,2}\s+[a-z]{3}\.?\s+\d{4}|\d{2}\/\d{2}\/\d{4}|\d{1,2}:\d{2}|R\$|ODDS|PRÊMIO|VALOR|CASHOUT/i.test(line)) continue;
      
      if (/[—–]|\b[-]\b|[\s][-][\s]|\bvs\.?\b/i.test(line)) {
        let cleaned = line
          .replace(/AO\s+VIVO/gi, '')         // remove badge "AO VIVO"
          .replace(/^[^\wÀ-ÿ]+/g, '')       // remove símbolos do início
          .replace(/[^\wÀ-ÿ\s\-–—]/g, ' ')  // remove emojis e caracteres especiais
          .replace(/\s{2,}/g, ' ')
          .trim();
        if (cleaned.length > 3 && cleaned.length < 90) {
          eventName = cleaned;
          break;
        }
      }
    }

    // Fallback: primeira linha de texto substancial se não achou separador explícito
    if (!eventName) {
      for (const line of lines) {
        if (/SIMPLES|M[UÚ]LTIPLA|COMPLETADO|ATIVO|APOSTA|R\$|ODDS|VALOR|\d{2}:\d{2}/i.test(line)) continue;
        const cleaned = line.replace(/AO\s+VIVO/gi, '').replace(/[^\wÀ-ÿ\s\-–—]/g, '').trim();
        if (cleaned.length > 5 && cleaned.length < 80) {
          eventName = cleaned;
          break;
        }
      }
    }

    // ── C. MERCADO / SELEÇÕES ─────────────────────────────────────────────────
    const MARKET_KW = /Total de Gols|Chutes no Gol|Mais de \d|Menos de \d|Ambas|1[oº°]\s*Tempo|2[oº°]\s*Tempo|Resultado|Handicap|Escanteios|Cartões|Vencedor|Dupla|Empate|BTTS/i;
    const marketLines = [];
    for (const line of lines) {
      if (MARKET_KW.test(line)) {
        let cleaned = line
          .replace(/@\s*[\d\.,]+\s*/g, '')         // remove odds "@2.05"
          .replace(/DICAS\s+DE\s+APOSTA/gi, '')     // remove "DICAS DE APOSTA"
          .replace(/^[0-9\s•·e|xX✖✕]+(?=1[oº°]|Resultado|Total|Ambas|Chutes|Handicap|Escanteios|Cartões|Vencedor)/i, '') // remove bullet points misread
          .replace(/[^\wÀ-ÿ\s\.\-\/+:º°]/g, '')     // mantém acentos e caracteres de texto útil
          .replace(/\s{2,}/g, ' ')
          .trim();
        cleaned = cleaned.replace(/^[e0-9|]\s+/i, '');
        if (cleaned.length > 3 && !marketLines.some(m => m.includes(cleaned))) {
          marketLines.push(cleaned);
        }
      }
    }
    const marketName = marketLines.length > 0 ? marketLines.join(' | ') : 'Aposta Superbet';

    // ── D. STAKE (VALOR APOSTADO) ─────────────────────────────────────────────
    let stake = 0;
    // Remove qualquer texto entre parênteses multilinhas ex: "(5,00 R$ DE APOSTA GRÁTIS INCL.)"
    const textWithoutParens = text.replace(/\([\s\S]*?\)/g, '');
    const stakeMatch =
      textWithoutParens.match(/VALOR[\s\S]*?([\d\.,]+)\s*R?\$?/i) ||
      textWithoutParens.match(/APOSTA[\s\S]*?([\d\.,]+)\s*R?\$?/i) ||
      textWithoutParens.match(/([\d\.,]+)\s*R\$[\s\n]*ODDS/i) ||
      textWithoutParens.match(/([\d\.,]+)\s*R\$/i);
    if (stakeMatch && stakeMatch[1]) stake = this.parseCurrency(stakeMatch[1]);

    // ── E. ODDS ───────────────────────────────────────────────────────────────
    // Estratégia 1: extrair tudo após "ODDS TOTAIS" e pegar o ÚLTIMO decimal
    let odd = 0;

    const oddsSectionMatch = text.match(/ODDS\s*TOTAIS\s*([\s\S]{0,120}?)(?:\n\s*\n|PR[EÊ]MIO|GANHO|CASHOUT|APOSTA\b|$)/i);
    if (oddsSectionMatch) {
      const section = oddsSectionMatch[1];
      const nums = section.match(/[\d]+[,\.][\d]+/g) || [];
      if (nums.length > 0) {
        const last = this.parseFloatNumber(nums[nums.length - 1]);
        if (last >= 1.01 && last <= 200) odd = last;
      }
    }

    // Estratégia 2: linha "@ X.XX ⚡ Y.YY" — pega o último decimal após @
    if (!odd || odd < 1.01) {
      const atLineMatch = text.match(/@\s*([\d\.,]+(?:\s*[\S]*\s*[\d\.,]+)*)/);
      if (atLineMatch) {
        const nums = atLineMatch[1].match(/[\d]+[,\.][\d]+/g) || [];
        if (nums.length > 0) {
          const last = this.parseFloatNumber(nums[nums.length - 1]);
          if (last >= 1.01 && last <= 200) odd = last;
        }
      }
    }

    // Estratégia 3: fallback genérico — qualquer decimal plausível que não seja o stake
    if (!odd || odd < 1.01) {
      const allDecimals = text.match(/[\d]+[,\.][\d]{2}/g) || [];
      for (const m of allDecimals) {
        const val = this.parseFloatNumber(m);
        if (val >= 1.05 && val <= 50 && Math.abs(val - stake) > 0.01) {
          odd = val;
          break;
        }
      }
    }

    // ── F. PAYOUT / PRÊMIO / CASHOUT ─────────────────────────────────────────
    let payout = 0;
    if (status === 'LOST') {
      payout = 0;
    } else {
      const premioMatch =
        text.match(/PR[EÊ]MIO\s*(?:POT\.?)?\s*([\d\.,]+)\s*R?\$?/i) ||
        text.match(/GANHO\s+POTENCIAL[\s\n]*([\d\.,]+)\s*R?\$?/i) ||
        text.match(/CASHOUT\s+([\d\.,]+)\s*R?\$?/i);
      if (premioMatch && premioMatch[1]) {
        payout = this.parseCurrency(premioMatch[1]);
      } else if (status === 'WON' && stake > 0 && odd > 0) {
        payout = Number((stake * odd).toFixed(2));
      }
    }

    // ── G. DATA / HORA ────────────────────────────────────────────────────────
    let dateStr = new Date().toISOString();
    const dateMatch = text.match(/(\d{1,2})\s+DE\s+([A-Z]{3})\.?\s+DE\s+(\d{4})\s*[—\-]\s*(\d{1,2}:\d{2})/i) ||
                      text.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*[\-—]?\s*(\d{1,2}:\d{2})/i);
    if (dateMatch) dateStr = this.normalizeSuperbetDate(dateMatch);

    return {
      type: 'BET',
      status,
      event: eventName || 'Superbet Aposta',
      market: marketName,
      stake: stake || 10.00,
      odd: odd || 1.85,
      payout,
      date: dateStr,
      confidence: (stake > 0 && odd > 0) ? 'HIGH' : 'MEDIUM'
    };
  }

  /**
   * Parses Superbet Payment History (Histórico de Pagamento)
   */
  static parsePaymentHistory(text, lines) {
    const transactions = [];
    const txRegex = /(Dep[oó]sito\s*-\s*Aprovado|Retirada\s*-\s*Pago)[\s\S]*?(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}:\d{2})[\s\S]*?([+-]?\s*R\$\s*[\d\.,]+)/gi;
    let match;
    while ((match = txRegex.exec(text)) !== null) {
      const type = /Dep[oó]sito/i.test(match[1]) ? 'DEPOSIT' : 'WITHDRAWAL';
      const amount = this.parseCurrency(match[4]);
      const [d, m, y] = match[2].split('/');
      transactions.push({
        id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type, status: 'APPROVED', amount,
        date: `${y}-${m}-${d}T${match[3]}:00`,
        description: type === 'DEPOSIT' ? 'Depósito Aprovado' : 'Retirada Paga'
      });
    }

    if (transactions.length === 0) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/Dep[oó]sito|Retirada/i.test(line)) {
          const type = /Dep[oó]sito/i.test(line) ? 'DEPOSIT' : 'WITHDRAWAL';
          const nextLines = lines.slice(i, i + 3).join(' ');
          const valMatch = nextLines.match(/R\$\s*([\d\.,]+)/i);
          const dateMatch = nextLines.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}:\d{2})/i);
          if (valMatch) {
            const amount = this.parseCurrency(valMatch[1]);
            let isoDate = new Date().toISOString();
            if (dateMatch) {
              const [d, m, y] = dateMatch[1].split('/');
              isoDate = `${y}-${m}-${d}T${dateMatch[2]}:00`;
            }
            transactions.push({
              id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
              type, status: 'APPROVED', amount, date: isoDate,
              description: type === 'DEPOSIT' ? 'Depósito Aprovado' : 'Retirada Paga'
            });
          }
        }
      }
    }

    return {
      type: 'PAYMENT_HISTORY',
      transactions: transactions.length > 0 ? transactions : [{
        id: 'tx_sample_1', type: 'DEPOSIT', status: 'APPROVED',
        amount: 40.00, date: new Date().toISOString(), description: 'Depósito Aprovado'
      }]
    };
  }

  static parseCurrency(valStr) {
    if (!valStr) return 0;
    const clean = valStr.replace(/[^\d,\.]/g, '').trim();
    if (clean.includes(',') && clean.includes('.')) return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
    if (clean.includes(',')) return parseFloat(clean.replace(',', '.'));
    return parseFloat(clean) || 0;
  }

  static parseFloatNumber(valStr) {
    if (!valStr) return 0;
    const clean = valStr.replace(/[^\d,\.]/g, '').trim();
    return parseFloat(clean.replace(',', '.')) || 0;
  }

  static normalizeSuperbetDate(match) {
    try {
      if (match[1] && match[1].includes('/')) {
        const [d, m, y] = match[1].split('/');
        const timeParts = (match[2] || '12:00').split(':');
        const hh = timeParts[0].padStart(2, '0');
        const mm = (timeParts[1] || '00').padStart(2, '0');
        const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${hh}:${mm}:00`;
        const test = new Date(iso);
        if (!isNaN(test.getTime())) return iso;
      } else if (match.length >= 5) {
        const day = match[1].padStart(2, '0');
        const monthMap = { 'JAN':'01','FEV':'02','MAR':'03','ABR':'04','MAI':'05','JUN':'06','JUL':'07','AGO':'08','SET':'09','OUT':'10','NOV':'11','DEZ':'12' };
        const month = monthMap[match[2].toUpperCase().substr(0, 3)] || '09';
        const timeParts = (match[4] || '12:00').split(':');
        const hh = timeParts[0].padStart(2, '0');
        const mm = (timeParts[1] || '00').padStart(2, '0');
        const iso = `${match[3]}-${month}-${day}T${hh}:${mm}:00`;
        const test = new Date(iso);
        if (!isNaN(test.getTime())) return iso;
      }
      return new Date().toISOString();
    } catch (e) {
      return new Date().toISOString();
    }
  }
}
