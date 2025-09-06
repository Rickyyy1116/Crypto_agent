// Mobile App JavaScript for Cryptocurrency Trading Assistant

class MobileCryptoApp {
    constructor() {
        this.currentSection = 'quick-analysis';
        this.swiper = null;
        this.priceUpdateInterval = null;
        this.alerts = this.loadAlerts();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeSwiper();
        this.loadInitialData();
        this.startPriceUpdates();
        this.updateActiveNavItem();
    }

    setupEventListeners() {
        // Mobile menu toggle
        document.getElementById('mobile-menu-toggle')?.addEventListener('click', () => {
            this.toggleMobileMenu();
        });

        document.getElementById('mobile-menu-close')?.addEventListener('click', () => {
            this.closeMobileMenu();
        });

        // Crypto selection for analysis
        const cryptoSelect = document.getElementById('mobile-crypto-select');
        const analyzeBtn = document.getElementById('mobile-analyze-btn');

        if (cryptoSelect) {
            cryptoSelect.addEventListener('change', (e) => {
                analyzeBtn.disabled = !e.target.value;
            });
        }

        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                this.runMobileAnalysis();
            });
        }

        // Bottom navigation
        document.querySelectorAll('.bottom-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.target;
                this.navigateToSection(target);
            });
        });

        // Alert management
        document.getElementById('save-alert')?.addEventListener('click', () => {
            this.saveAlert();
        });

        // News refresh
        document.getElementById('refresh-news')?.addEventListener('click', () => {
            this.loadNews();
        });

        // Touch/swipe gestures
        this.setupTouchGestures();

        // Menu overlay click to close
        document.getElementById('mobile-menu')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('mobile-menu-overlay')) {
                this.closeMobileMenu();
            }
        });
    }

    setupTouchGestures() {
        let startY = 0;
        let startX = 0;

        document.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            startX = e.touches[0].clientX;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!e.changedTouches.length) return;

            const endY = e.changedTouches[0].clientY;
            const endX = e.changedTouches[0].clientX;
            const diffY = startY - endY;
            const diffX = startX - endX;

            // Swipe down to refresh (if at top of page)
            if (diffY < -100 && Math.abs(diffX) < 50 && window.scrollY === 0) {
                this.refreshData();
            }
        }, { passive: true });
    }

    initializeSwiper() {
        if (typeof Swiper !== 'undefined') {
            this.swiper = new Swiper('.price-swiper', {
                slidesPerView: 1.2,
                spaceBetween: 15,
                centeredSlides: true,
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
                breakpoints: {
                    480: {
                        slidesPerView: 1.5,
                        spaceBetween: 20,
                    }
                }
            });
        } else {
            console.warn('Swiper not available');
        }
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadPriceData(),
                this.loadNews(),
                this.loadAlertStatus()
            ]);
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showToast('データの読み込みに失敗しました', 'error');
        }
    }

    async loadPriceData() {
        const cryptos = ['bitcoin', 'ethereum', 'cardano'];
        
        for (const crypto of cryptos) {
            try {
                const data = await this.fetchCryptoPrice(crypto);
                if (data) {
                    this.updatePriceCard(crypto, data);
                }
            } catch (error) {
                console.error(`Error loading ${crypto} price:`, error);
                this.showSkeletonPrice(crypto);
            }
        }
    }

    async fetchCryptoPrice(cryptoId) {
        try {
            const response = await fetch(`/api/crypto-price/${cryptoId}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('API error:', error);
        }

        // Fallback to CoinGecko API
        try {
            const response = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd&include_24hr_change=true`
            );
            
            if (response.ok) {
                const data = await response.json();
                return {
                    price_usd: data[cryptoId]?.usd,
                    price_change_24h: data[cryptoId]?.usd_24h_change
                };
            }
        } catch (error) {
            console.error('CoinGecko API error:', error);
        }

        return null;
    }

    updatePriceCard(crypto, data) {
        const priceElement = document.getElementById(`mobile-${crypto === 'bitcoin' ? 'btc' : crypto === 'ethereum' ? 'eth' : 'ada'}-price`);
        const changeElement = document.getElementById(`mobile-${crypto === 'bitcoin' ? 'btc' : crypto === 'ethereum' ? 'eth' : 'ada'}-change`);
        
        if (priceElement && data.price_usd) {
            priceElement.textContent = `$${data.price_usd.toLocaleString()}`;
        }
        
        if (changeElement && data.price_change_24h !== undefined) {
            const change = data.price_change_24h;
            const changeClass = change >= 0 ? 'positive' : 'negative';
            const changeSymbol = change >= 0 ? '+' : '';
            changeElement.textContent = `${changeSymbol}${change.toFixed(2)}%`;
            changeElement.className = `price-change ${changeClass}`;
        }
    }

    showSkeletonPrice(crypto) {
        const shortName = crypto === 'bitcoin' ? 'btc' : crypto === 'ethereum' ? 'eth' : 'ada';
        const priceElement = document.getElementById(`mobile-${shortName}-price`);
        const changeElement = document.getElementById(`mobile-${shortName}-change`);
        
        if (priceElement) {
            priceElement.innerHTML = '<div class="loading-skeleton" style="width: 80px; height: 20px;"></div>';
        }
        
        if (changeElement) {
            changeElement.innerHTML = '<div class="loading-skeleton" style="width: 60px; height: 16px;"></div>';
        }
    }

    async runMobileAnalysis() {
        const cryptoSelect = document.getElementById('mobile-crypto-select');
        const analyzeBtn = document.getElementById('mobile-analyze-btn');
        const resultsDiv = document.getElementById('mobile-analysis-results');
        
        if (!cryptoSelect.value) return;

        // Show loading state
        this.showLoading(true);
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>分析中...';
        
        resultsDiv.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary mb-3"></div>
                <p>エージェントが分析中...</p>
            </div>
        `;

        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    symbol: cryptoSelect.value,
                    depth: 'quick'
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.displayMobileAnalysisResults(result.analysis);
                this.showToast('分析が完了しました', 'success');
            } else {
                throw new Error('Analysis failed');
            }
        } catch (error) {
            console.error('Mobile analysis error:', error);
            resultsDiv.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    分析中にエラーが発生しました
                </div>
            `;
            this.showToast('分析エラー', 'error');
        } finally {
            this.showLoading(false);
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<i class="fas fa-play me-2"></i>分析開始';
        }
    }

    displayMobileAnalysisResults(analysisText) {
        const resultsDiv = document.getElementById('mobile-analysis-results');
        const metrics = this.parseAnalysisMetrics(analysisText);
        
        const html = `
            <div class="analysis-card fade-in">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="mb-0"><i class="fas fa-chart-line me-2"></i>分析結果</h6>
                    <span class="badge bg-primary">最新</span>
                </div>
                ${metrics.map(metric => `
                    <div class="analysis-metric">
                        <span class="metric-label">${metric.label}</span>
                        <span class="metric-value ${metric.class || ''}">${metric.value}</span>
                    </div>
                `).join('')}
                <div class="mt-3">
                    <button class="btn btn-sm btn-outline-primary w-100" onclick="this.showFullAnalysis('${analysisText}')">
                        <i class="fas fa-expand me-1"></i>詳細を表示
                    </button>
                </div>
            </div>
        `;
        
        resultsDiv.innerHTML = html;
    }

    parseAnalysisMetrics(analysisText) {
        const metrics = [];
        
        // Extract key metrics from analysis text
        const priceMatch = analysisText.match(/\$([0-9,]+\.?[0-9]*)/);
        if (priceMatch) {
            metrics.push({
                label: '現在価格',
                value: '$' + priceMatch[1],
                class: ''
            });
        }
        
        const changeMatch = analysisText.match(/([+-]?[0-9]+\.?[0-9]*)%/);
        if (changeMatch) {
            const change = parseFloat(changeMatch[1]);
            metrics.push({
                label: '24h変動',
                value: change.toFixed(2) + '%',
                class: change >= 0 ? 'positive' : 'negative'
            });
        }
        
        // Sentiment analysis
        if (analysisText.includes('POSITIVE') || analysisText.includes('ポジティブ')) {
            metrics.push({
                label: 'センチメント',
                value: '😊 ポジティブ',
                class: 'positive'
            });
        } else if (analysisText.includes('NEGATIVE') || analysisText.includes('ネガティブ')) {
            metrics.push({
                label: 'センチメント', 
                value: '😟 ネガティブ',
                class: 'negative'
            });
        } else {
            metrics.push({
                label: 'センチメント',
                value: '😐 ニュートラル',
                class: ''
            });
        }
        
        // Trading recommendation
        if (analysisText.includes('BUY') || analysisText.includes('買い')) {
            metrics.push({
                label: '推奨',
                value: '📈 BUY',
                class: 'positive'
            });
        } else if (analysisText.includes('SELL') || analysisText.includes('売り')) {
            metrics.push({
                label: '推奨',
                value: '📉 SELL', 
                class: 'negative'
            });
        } else {
            metrics.push({
                label: '推奨',
                value: '⏸️ HOLD',
                class: ''
            });
        }
        
        return metrics;
    }

    async loadNews() {
        try {
            const response = await fetch('/api/crypto-news?limit=10');
            if (response.ok) {
                const news = await response.json();
                this.displayMobileNews(news);
            } else {
                this.displaySampleNews();
            }
        } catch (error) {
            console.error('Error loading news:', error);
            this.displaySampleNews();
        }
    }

    displayMobileNews(newsItems) {
        const newsContainer = document.getElementById('mobile-news');
        if (!newsContainer) return;

        const newsHtml = newsItems.slice(0, 8).map(item => `
            <div class="mobile-news-item fade-in">
                <div class="news-title">${item.title}</div>
                <div class="news-meta">
                    <i class="fas fa-clock me-1"></i>${this.formatTime(item.published)}
                    <span class="ms-2"><i class="fas fa-newspaper me-1"></i>${item.source}</span>
                </div>
                <div class="news-summary">${item.summary || 'ニュース詳細を読み込み中...'}</div>
            </div>
        `).join('');

        newsContainer.innerHTML = newsHtml;
    }

    displaySampleNews() {
        const sampleNews = [
            {
                title: "Bitcoin価格が50,000ドルを突破、機関投資家の参入続く",
                source: "CryptoMobile",
                published: new Date(Date.now() - 1800000),
                summary: "ビットコイン価格が心理的節目となる5万ドルを上回り、機関投資家からの資金流入が続いている。"
            },
            {
                title: "イーサリアムのアップグレードが順調に進行中",
                source: "DeFi Mobile",
                published: new Date(Date.now() - 3600000),
                summary: "イーサリアム2.0への移行が段階的に実施され、取引手数料の削減効果が期待される。"
            },
            {
                title: "DeFi Total Value Lockedが過去最高を更新",
                source: "DeFi Watch",
                published: new Date(Date.now() - 7200000),
                summary: "分散型金融プロトコルに預けられた資産総額が新たな記録を達成し、200億ドルを超えた。"
            }
        ];

        this.displayMobileNews(sampleNews);
    }

    saveAlert() {
        const crypto = document.getElementById('alert-crypto').value;
        const condition = document.getElementById('alert-condition').value;
        const price = parseFloat(document.getElementById('alert-price').value);
        
        if (!crypto || !condition || !price) {
            this.showToast('すべての項目を入力してください', 'warning');
            return;
        }
        
        const alert = {
            id: Date.now(),
            crypto,
            condition,
            price,
            created: new Date(),
            active: true
        };
        
        this.alerts.push(alert);
        this.saveAlerts();
        this.loadAlertStatus();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('alertModal'));
        modal.hide();
        
        this.showToast('アラートを設定しました', 'success');
    }

    loadAlerts() {
        try {
            const saved = localStorage.getItem('crypto-mobile-alerts');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading alerts:', error);
            return [];
        }
    }

    saveAlerts() {
        try {
            localStorage.setItem('crypto-mobile-alerts', JSON.stringify(this.alerts));
        } catch (error) {
            console.error('Error saving alerts:', error);
        }
    }

    loadAlertStatus() {
        // Update alert status indicators
        // Implementation would depend on actual alert checking logic
        console.log('Alert status loaded');
    }

    navigateToSection(sectionId) {
        // Update active nav item
        document.querySelectorAll('.bottom-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        document.querySelector(`[data-target="${sectionId}"]`)?.classList.add('active');
        
        // Scroll to section
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        this.currentSection = sectionId;
    }

    updateActiveNavItem() {
        // Intersection Observer to update active nav item based on scroll
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const sectionId = entry.target.id;
                    if (sectionId) {
                        document.querySelectorAll('.bottom-nav-item').forEach(item => {
                            item.classList.remove('active');
                        });
                        document.querySelector(`[data-target="${sectionId}"]`)?.classList.add('active');
                    }
                }
            });
        }, { threshold: 0.5 });
        
        document.querySelectorAll('.mobile-section[id]').forEach(section => {
            observer.observe(section);
        });
    }

    toggleMobileMenu() {
        const menu = document.getElementById('mobile-menu');
        menu?.classList.toggle('active');
    }

    closeMobileMenu() {
        const menu = document.getElementById('mobile-menu');
        menu?.classList.remove('active');
    }

    showLoading(show) {
        const overlay = document.getElementById('mobile-loading');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `alert alert-${type === 'error' ? 'danger' : type} position-fixed`;
        toast.style.cssText = `
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1060;
            min-width: 280px;
            max-width: 90vw;
            animation: slideDown 0.3s ease;
        `;
        
        const icon = type === 'success' ? 'check-circle' : 
                    type === 'error' ? 'exclamation-triangle' : 
                    type === 'warning' ? 'exclamation-circle' : 'info-circle';
        
        toast.innerHTML = `
            <i class="fas fa-${icon} me-2"></i>${message}
            <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
        `;
        
        document.body.appendChild(toast);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = 'slideUp 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }
        }, 3000);
    }

    startPriceUpdates() {
        // Update prices every 30 seconds
        this.priceUpdateInterval = setInterval(() => {
            this.loadPriceData();
        }, 30000);
    }

    async refreshData() {
        this.showToast('データを更新中...', 'info');
        try {
            await this.loadInitialData();
            this.showToast('データを更新しました', 'success');
        } catch (error) {
            this.showToast('更新に失敗しました', 'error');
        }
    }

    formatTime(date) {
        if (typeof date === 'string') {
            date = new Date(date);
        }
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'たった今';
        if (diffMins < 60) return `${diffMins}分前`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}時間前`;
        return `${Math.floor(diffMins / 1440)}日前`;
    }

    destroy() {
        if (this.priceUpdateInterval) {
            clearInterval(this.priceUpdateInterval);
        }
        
        if (this.swiper) {
            this.swiper.destroy();
        }
    }
}

// Animation CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from { 
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
        to { 
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
    @keyframes slideUp {
        from { 
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        to { 
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
    }
`;
document.head.appendChild(style);

// Global functions
window.showFullAnalysis = function(analysisText) {
    // Show full analysis in a modal or new view
    alert('詳細分析: ' + analysisText.substring(0, 200) + '...');
};

// Initialize mobile app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mobileCryptoApp = new MobileCryptoApp();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pause updates when tab is not visible
        if (window.mobileCryptoApp?.priceUpdateInterval) {
            clearInterval(window.mobileCryptoApp.priceUpdateInterval);
        }
    } else {
        // Resume updates when tab becomes visible
        if (window.mobileCryptoApp) {
            window.mobileCryptoApp.startPriceUpdates();
            window.mobileCryptoApp.refreshData();
        }
    }
});

// Handle online/offline status
window.addEventListener('online', () => {
    if (window.mobileCryptoApp) {
        window.mobileCryptoApp.showToast('オンラインに戻りました', 'success');
        window.mobileCryptoApp.refreshData();
    }
});

window.addEventListener('offline', () => {
    if (window.mobileCryptoApp) {
        window.mobileCryptoApp.showToast('オフラインです', 'warning');
    }
});