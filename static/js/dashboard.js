// Advanced Dashboard JavaScript for Cryptocurrency Trading Assistant

class CryptoDashboard {
    constructor() {
        this.socket = null;
        this.charts = {};
        this.updateInterval = 30000; // 30 seconds default
        this.theme = localStorage.getItem('dashboard-theme') || 'light';
        this.priceChart = null;
        this.sentimentChart = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.initializeSocket();
        this.setTheme(this.theme);
        await this.loadInitialData();
        this.startRealTimeUpdates();
        this.initializeCharts();
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle')?.addEventListener('click', () => {
            this.toggleTheme();
        });

        // Quick analysis
        const quickAnalysisSelect = document.getElementById('quick-analysis-select');
        const quickAnalyzeBtn = document.getElementById('quick-analyze-btn');

        if (quickAnalysisSelect) {
            quickAnalysisSelect.addEventListener('change', (e) => {
                quickAnalyzeBtn.disabled = !e.target.value;
            });
        }

        if (quickAnalyzeBtn) {
            quickAnalyzeBtn.addEventListener('click', () => {
                this.runQuickAnalysis();
            });
        }

        // Detailed analysis
        document.getElementById('start-detailed-analysis')?.addEventListener('click', () => {
            this.runDetailedAnalysis();
        });

        // Chart cryptocurrency selection
        document.getElementById('chart-crypto-select')?.addEventListener('change', (e) => {
            this.updatePriceChart(e.target.value);
        });

        // Settings save
        document.querySelector('#settingsModal .btn-primary')?.addEventListener('click', () => {
            this.saveSettings();
        });
    }

    initializeSocket() {
        if (typeof io !== 'undefined') {
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('Connected to server');
                this.updateConnectionStatus(true);
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
                this.updateConnectionStatus(false);
            });

            this.socket.on('price_update', (data) => {
                this.handlePriceUpdate(data);
            });

            this.socket.on('news_update', (data) => {
                this.handleNewsUpdate(data);
            });

            this.socket.on('analysis_progress', (data) => {
                this.handleAnalysisProgress(data);
            });
        }
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.setTheme(this.theme);
        localStorage.setItem('dashboard-theme', this.theme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const themeIcon = document.querySelector('#themeToggle i');
        if (themeIcon) {
            themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
        
        // Update charts if they exist
        if (this.priceChart) {
            this.updateChartTheme();
        }
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadMarketOverview(),
                this.loadCryptoNews(),
                this.loadAgentStatus()
            ]);
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('データの読み込みに失敗しました', 'error');
        }
    }

    async loadMarketOverview() {
        const cryptos = ['bitcoin', 'ethereum'];
        
        for (const crypto of cryptos) {
            try {
                const response = await fetch(`/api/crypto-price/${crypto}`);
                if (response.ok) {
                    const data = await response.json();
                    this.updatePriceCard(crypto, data);
                } else {
                    // Fallback to CoinGecko API directly
                    const fallbackData = await this.fetchFromCoinGecko(crypto);
                    if (fallbackData) {
                        this.updatePriceCard(crypto, fallbackData);
                    }
                }
            } catch (error) {
                console.error(`Error loading ${crypto} data:`, error);
                this.showSkeletonData(crypto);
            }
        }

        // Load additional market data
        await this.loadMarketMetrics();
    }

    async fetchFromCoinGecko(cryptoId) {
        try {
            const response = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd,jpy&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
            );
            
            if (response.ok) {
                const data = await response.json();
                return data[cryptoId];
            }
        } catch (error) {
            console.error('CoinGecko API error:', error);
        }
        return null;
    }

    updatePriceCard(crypto, data) {
        const priceElement = document.getElementById(`${crypto === 'bitcoin' ? 'btc' : 'eth'}-price`);
        const changeElement = document.getElementById(`${crypto === 'bitcoin' ? 'btc' : 'eth'}-change`);
        
        if (priceElement && data) {
            const price = data.usd || data.price_usd;
            const change = data.usd_24h_change || data.price_change_24h;
            
            priceElement.innerHTML = `$${price?.toLocaleString() || 'N/A'}`;
            
            if (changeElement && change !== undefined) {
                const changeClass = change >= 0 ? 'price-up' : 'price-down';
                changeElement.innerHTML = `<span class="${changeClass}">${change.toFixed(2)}%</span>`;
            }
        }
    }

    async loadMarketMetrics() {
        try {
            // Mock data for demonstration - replace with actual API
            const totalMarketCap = '$2.45T';
            const fearGreedIndex = '72 (Greed)';
            
            const marketCapElement = document.getElementById('total-market-cap');
            const fearGreedElement = document.getElementById('fear-greed-index');
            
            if (marketCapElement) {
                marketCapElement.textContent = totalMarketCap;
            }
            
            if (fearGreedElement) {
                fearGreedElement.textContent = fearGreedIndex;
            }
        } catch (error) {
            console.error('Error loading market metrics:', error);
        }
    }

    async loadCryptoNews() {
        try {
            const response = await fetch('/api/crypto-news');
            if (response.ok) {
                const news = await response.json();
                this.displayNews(news);
            } else {
                // Fallback to sample news
                this.displaySampleNews();
            }
        } catch (error) {
            console.error('Error loading news:', error);
            this.displaySampleNews();
        }
    }

    displayNews(newsItems) {
        const newsContainer = document.getElementById('crypto-news');
        if (!newsContainer) return;

        const newsHtml = newsItems.slice(0, 5).map(item => `
            <div class="news-item fade-in">
                <h6>${item.title}</h6>
                <div class="news-meta">
                    <small><i class="fas fa-clock me-1"></i>${this.formatTime(item.published)}</small>
                    <small class="ms-2"><i class="fas fa-newspaper me-1"></i>${item.source}</small>
                </div>
                <p class="news-summary">${item.summary || 'ニュース詳細を読み込み中...'}</p>
            </div>
        `).join('');

        newsContainer.innerHTML = newsHtml;
    }

    displaySampleNews() {
        const sampleNews = [
            {
                title: "Bitcoin価格が再び上昇傾向、機関投資家の関心が高まる",
                source: "CryptoNews",
                published: new Date(Date.now() - 3600000), // 1 hour ago
                summary: "ビットコイン価格が24時間で3.2%上昇し、機関投資家からの注目が集まっている。"
            },
            {
                title: "Ethereum 2.0のステーキング報酬が安定化",
                source: "DeFi Today", 
                published: new Date(Date.now() - 7200000), // 2 hours ago
                summary: "イーサリアム2.0のステーキング参加者が増加し、年率約4.5%の安定した報酬を提供。"
            },
            {
                title: "規制当局がDeFiプロトコルへの監視を強化",
                source: "Regulatory Watch",
                published: new Date(Date.now() - 10800000), // 3 hours ago
                summary: "各国の規制当局が分散型金融プロトコルに対する監視体制を強化する方針を発表。"
            }
        ];

        this.displayNews(sampleNews);
    }

    async loadAgentStatus() {
        // Update agent status indicators
        const agents = ['テクニカル分析', 'センチメント分析', 'リスク評価'];
        
        agents.forEach((agent, index) => {
            setTimeout(() => {
                // Animate status loading
                const statusElements = document.querySelectorAll('.agent-status-item .badge');
                if (statusElements[index]) {
                    statusElements[index].classList.add('pulse');
                    setTimeout(() => {
                        statusElements[index].classList.remove('pulse');
                    }, 1000);
                }
            }, index * 500);
        });
    }

    initializeCharts() {
        this.initializePriceChart();
        this.initializeSentimentChart();
    }

    initializePriceChart() {
        const chartElement = document.getElementById('price-chart');
        if (!chartElement || typeof ApexCharts === 'undefined') {
            console.warn('ApexCharts not available or chart element not found');
            return;
        }

        const options = {
            series: [{
                name: 'Price',
                data: this.generateSamplePriceData()
            }],
            chart: {
                type: 'line',
                height: 400,
                toolbar: {
                    show: true
                },
                theme: {
                    mode: this.theme
                }
            },
            stroke: {
                curve: 'smooth',
                width: 2
            },
            colors: ['#4e73df'],
            xaxis: {
                type: 'datetime',
                labels: {
                    format: 'HH:mm'
                }
            },
            yaxis: {
                title: {
                    text: 'Price (USD)'
                },
                labels: {
                    formatter: (val) => '$' + val.toLocaleString()
                }
            },
            tooltip: {
                x: {
                    format: 'dd/MM/yy HH:mm'
                }
            }
        };

        this.priceChart = new ApexCharts(chartElement, options);
        this.priceChart.render();
    }

    initializeSentimentChart() {
        const ctx = document.getElementById('sentiment-chart');
        if (!ctx || typeof Chart === 'undefined') {
            console.warn('Chart.js not available or chart element not found');
            return;
        }

        this.sentimentChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['ポジティブ', 'ニュートラル', 'ネガティブ'],
                datasets: [{
                    data: [45, 35, 20],
                    backgroundColor: [
                        '#1cc88a',
                        '#f6c23e', 
                        '#e74a3b'
                    ],
                    borderWidth: 2,
                    borderColor: this.theme === 'dark' ? '#374151' : '#ffffff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: this.theme === 'dark' ? '#ffffff' : '#374151'
                        }
                    }
                }
            }
        });
    }

    generateSamplePriceData() {
        const data = [];
        let basePrice = 45000;
        const now = new Date();
        
        for (let i = 24; i >= 0; i--) {
            const time = new Date(now - i * 60 * 60 * 1000);
            basePrice += (Math.random() - 0.5) * 1000;
            data.push([time.getTime(), Math.round(basePrice)]);
        }
        
        return data;
    }

    async updatePriceChart(cryptoId) {
        if (!this.priceChart) return;
        
        try {
            // Show loading state
            this.showNotification('価格データを更新中...', 'info');
            
            // Generate new sample data (replace with actual API call)
            const newData = this.generateSamplePriceData();
            
            await this.priceChart.updateSeries([{
                name: cryptoId.toUpperCase(),
                data: newData
            }]);
            
            this.showNotification('価格チャートを更新しました', 'success');
        } catch (error) {
            console.error('Error updating price chart:', error);
            this.showNotification('価格チャートの更新に失敗しました', 'error');
        }
    }

    async runQuickAnalysis() {
        const cryptoSelect = document.getElementById('quick-analysis-select');
        const resultsDiv = document.getElementById('quick-analysis-results');
        const analyzeBtn = document.getElementById('quick-analyze-btn');
        
        if (!cryptoSelect.value) return;
        
        // Show loading state
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>分析中...';
        resultsDiv.innerHTML = '<div class="text-center"><div class="spinner-border text-primary"></div></div>';
        
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
                this.displayQuickAnalysisResults(result.analysis);
            } else {
                throw new Error('Analysis failed');
            }
        } catch (error) {
            console.error('Quick analysis error:', error);
            resultsDiv.innerHTML = `
                <div class="alert alert-danger-custom">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    分析中にエラーが発生しました
                </div>
            `;
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<i class="fas fa-play me-2"></i>クイック分析実行';
        }
    }

    displayQuickAnalysisResults(analysisText) {
        const resultsDiv = document.getElementById('quick-analysis-results');
        
        // Parse key metrics from analysis text
        const metrics = this.parseAnalysisMetrics(analysisText);
        
        const html = `
            <div class="fade-in">
                <h6><i class="fas fa-chart-line me-2"></i>分析結果サマリー</h6>
                ${metrics.map(metric => `
                    <div class="metric">
                        <span>${metric.label}</span>
                        <strong class="${metric.class || ''}">${metric.value}</strong>
                    </div>
                `).join('')}
                <div class="mt-3">
                    <button class="btn btn-sm btn-outline-primary" onclick="this.showFullAnalysis()">
                        <i class="fas fa-expand me-1"></i>詳細を表示
                    </button>
                </div>
            </div>
        `;
        
        resultsDiv.innerHTML = html;
    }

    parseAnalysisMetrics(analysisText) {
        // Simple parsing of analysis text to extract key metrics
        const metrics = [];
        
        // Look for price information
        const priceMatch = analysisText.match(/\$([0-9,]+\.?[0-9]*)/);
        if (priceMatch) {
            metrics.push({
                label: '現在価格',
                value: '$' + priceMatch[1],
                class: ''
            });
        }
        
        // Look for percentage changes
        const changeMatch = analysisText.match(/([+-]?[0-9]+\.?[0-9]*)%/);
        if (changeMatch) {
            const change = parseFloat(changeMatch[1]);
            metrics.push({
                label: '24h変動',
                value: change.toFixed(2) + '%',
                class: change >= 0 ? 'price-up' : 'price-down'
            });
        }
        
        // Look for sentiment
        if (analysisText.includes('POSITIVE') || analysisText.includes('ポジティブ')) {
            metrics.push({
                label: 'センチメント',
                value: 'ポジティブ',
                class: 'sentiment-positive'
            });
        } else if (analysisText.includes('NEGATIVE') || analysisText.includes('ネガティブ')) {
            metrics.push({
                label: 'センチメント',
                value: 'ネガティブ',
                class: 'sentiment-negative'
            });
        } else {
            metrics.push({
                label: 'センチメント',
                value: 'ニュートラル',
                class: 'sentiment-neutral'
            });
        }
        
        // Look for recommendation
        if (analysisText.includes('BUY') || analysisText.includes('買い')) {
            metrics.push({
                label: '推奨',
                value: 'BUY',
                class: 'sentiment-positive'
            });
        } else if (analysisText.includes('SELL') || analysisText.includes('売り')) {
            metrics.push({
                label: '推奨',
                value: 'SELL',
                class: 'sentiment-negative'
            });
        } else {
            metrics.push({
                label: '推奨',
                value: 'HOLD',
                class: 'sentiment-neutral'
            });
        }
        
        return metrics;
    }

    async runDetailedAnalysis() {
        const cryptoSelect = document.getElementById('analysis-crypto');
        const depthSelect = document.getElementById('analysis-depth');
        const resultsDiv = document.getElementById('detailed-analysis-results');
        
        if (!cryptoSelect.value) {
            this.showNotification('仮想通貨を選択してください', 'warning');
            return;
        }
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('analysisModal'));
        modal.hide();
        
        // Show analysis in progress
        resultsDiv.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;"></div>
                <h5>詳細分析を実行中...</h5>
                <p class="text-muted">複数のエージェントが協力して分析しています</p>
                <div class="progress mt-3" style="height: 10px;">
                    <div class="progress-bar progress-bar-animated" id="analysis-progress" style="width: 0%"></div>
                </div>
            </div>
        `;
        
        // Simulate analysis progress
        this.simulateAnalysisProgress();
        
        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    symbol: cryptoSelect.value,
                    depth: depthSelect.value
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.displayDetailedAnalysisResults(result.analysis);
                this.showNotification('詳細分析が完了しました', 'success');
            } else {
                throw new Error('Detailed analysis failed');
            }
        } catch (error) {
            console.error('Detailed analysis error:', error);
            resultsDiv.innerHTML = `
                <div class="alert alert-danger-custom">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    詳細分析中にエラーが発生しました
                </div>
            `;
            this.showNotification('分析エラーが発生しました', 'error');
        }
    }

    simulateAnalysisProgress() {
        const progressBar = document.getElementById('analysis-progress');
        if (!progressBar) return;
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 95) {
                progress = 95;
                clearInterval(interval);
            }
            progressBar.style.width = progress + '%';
        }, 500);
    }

    displayDetailedAnalysisResults(analysisText) {
        const resultsDiv = document.getElementById('detailed-analysis-results');
        
        // Convert markdown-like text to structured HTML
        const sections = this.parseAnalysisSections(analysisText);
        
        const html = sections.map(section => `
            <div class="analysis-section fade-in">
                <h4>${section.title}</h4>
                <div class="content">${section.content}</div>
                ${section.metrics ? `
                    <div class="metric-grid">
                        ${section.metrics.map(metric => `
                            <div class="metric-card">
                                <div class="metric-value ${metric.class || ''}">${metric.value}</div>
                                <div class="metric-label">${metric.label}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');
        
        resultsDiv.innerHTML = html;
    }

    parseAnalysisSections(analysisText) {
        const sections = [];
        const lines = analysisText.split('\n');
        let currentSection = null;
        
        for (const line of lines) {
            if (line.startsWith('##')) {
                if (currentSection) {
                    sections.push(currentSection);
                }
                currentSection = {
                    title: line.replace(/^##\s*/, ''),
                    content: '',
                    metrics: []
                };
            } else if (currentSection) {
                if (line.includes('$') && line.includes(':')) {
                    // Try to extract metrics
                    const [label, value] = line.split(':');
                    currentSection.metrics.push({
                        label: label.trim(),
                        value: value.trim()
                    });
                } else {
                    currentSection.content += line + '<br>';
                }
            }
        }
        
        if (currentSection) {
            sections.push(currentSection);
        }
        
        return sections.length > 0 ? sections : [{
            title: '分析結果',
            content: analysisText.replace(/\n/g, '<br>'),
            metrics: []
        }];
    }

    startRealTimeUpdates() {
        // Update market data periodically
        setInterval(() => {
            this.loadMarketOverview();
        }, this.updateInterval);
        
        // Update news less frequently
        setInterval(() => {
            this.loadCryptoNews();
        }, this.updateInterval * 2);
    }

    handlePriceUpdate(data) {
        if (data.symbol && data.price) {
            this.updatePriceCard(data.symbol.toLowerCase(), data);
        }
    }

    handleNewsUpdate(newsItems) {
        this.displayNews(newsItems);
    }

    handleAnalysisProgress(data) {
        const progressBar = document.getElementById('analysis-progress');
        if (progressBar && data.progress) {
            progressBar.style.width = data.progress + '%';
        }
    }

    updateConnectionStatus(connected) {
        // Update UI to show connection status
        const statusElements = document.querySelectorAll('.badge');
        statusElements[0]?.classList.toggle('bg-success', connected);
        statusElements[0]?.classList.toggle('bg-danger', !connected);
        statusElements[0].textContent = connected ? 'オンライン' : 'オフライン';
    }

    updateChartTheme() {
        if (this.priceChart) {
            this.priceChart.updateOptions({
                theme: {
                    mode: this.theme
                }
            });
        }
        
        if (this.sentimentChart) {
            this.sentimentChart.data.datasets[0].borderColor = 
                this.theme === 'dark' ? '#374151' : '#ffffff';
            this.sentimentChart.options.plugins.legend.labels.color = 
                this.theme === 'dark' ? '#ffffff' : '#374151';
            this.sentimentChart.update();
        }
    }

    saveSettings() {
        const updateFreq = document.getElementById('update-frequency').value;
        const priceAlerts = document.getElementById('price-alerts').checked;
        const newsAlerts = document.getElementById('news-alerts').checked;
        
        this.updateInterval = parseInt(updateFreq) * 1000;
        
        // Save to localStorage
        localStorage.setItem('dashboard-settings', JSON.stringify({
            updateFrequency: updateFreq,
            priceAlerts,
            newsAlerts
        }));
        
        this.showNotification('設定を保存しました', 'success');
        
        // Restart real-time updates with new frequency
        this.startRealTimeUpdates();
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type}-custom position-fixed`;
        notification.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            animation: slideInRight 0.3s ease;
        `;
        
        const icon = type === 'success' ? 'check-circle' : 
                    type === 'error' ? 'exclamation-triangle' : 
                    type === 'warning' ? 'exclamation-circle' : 'info-circle';
        
        notification.innerHTML = `
            <i class="fas fa-${icon} me-2"></i>${message}
            <button type="button" class="btn-close float-end" onclick="this.parentElement.remove()"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
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
}

// Animation CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.cryptoDashboard = new CryptoDashboard();
});

// Global functions
window.showFullAnalysis = function() {
    // Trigger detailed analysis modal
    const modal = new bootstrap.Modal(document.getElementById('analysisModal'));
    modal.show();
};