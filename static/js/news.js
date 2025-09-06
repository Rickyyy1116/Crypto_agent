// News Page JavaScript for Cryptocurrency Trading Assistant

class CryptoNewsApp {
    constructor() {
        this.currentPage = 1;
        this.newsData = [];
        this.filteredNews = [];
        this.isLoading = false;
        this.theme = localStorage.getItem('news-theme') || 'light';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setTheme(this.theme);
        this.loadNews();
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle')?.addEventListener('click', () => {
            this.toggleTheme();
        });

        // Filter controls
        document.getElementById('categoryFilter')?.addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('sourceFilter')?.addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('timeFilter')?.addEventListener('change', () => {
            this.applyFilters();
        });

        // Refresh button
        document.getElementById('refreshNews')?.addEventListener('click', () => {
            this.refreshNews();
        });

        // Load more button
        document.getElementById('loadMore')?.addEventListener('click', () => {
            this.loadMoreNews();
        });
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.setTheme(this.theme);
        localStorage.setItem('news-theme', this.theme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (theme === 'dark') {
                icon.className = 'fas fa-sun';
            } else {
                icon.className = 'fas fa-moon';
            }
        }
    }

    async loadNews() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoadingSpinner(true);
        
        try {
            const response = await fetch('/api/crypto-news?limit=20');
            if (response.ok) {
                const newsData = await response.json();
                this.newsData = this.enhanceNewsData(newsData);
                this.filteredNews = [...this.newsData];
                this.displayNews();
            } else {
                // Fallback to sample news
                this.displaySampleNews();
            }
        } catch (error) {
            console.error('Error loading news:', error);
            this.displaySampleNews();
        } finally {
            this.isLoading = false;
            this.showLoadingSpinner(false);
        }
    }

    enhanceNewsData(newsData) {
        return newsData.map(item => {
            // Categorize news
            const category = this.categorizeNews(item.title, item.summary);
            
            // Analyze sentiment
            const sentiment = this.analyzeSentiment(item.title, item.summary);
            
            // Add enhanced properties
            return {
                ...item,
                category,
                sentiment,
                publishedDate: new Date(item.published),
                id: `news-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            };
        });
    }

    categorizeNews(title, summary) {
        const text = (title + ' ' + summary).toLowerCase();
        
        if (text.includes('bitcoin') || text.includes('btc')) return 'bitcoin';
        if (text.includes('ethereum') || text.includes('eth')) return 'ethereum';
        if (text.includes('defi') || text.includes('decentralized')) return 'defi';
        if (text.includes('regulation') || text.includes('regulatory') || text.includes('規制')) return 'regulation';
        if (text.includes('blockchain') || text.includes('technology') || text.includes('tech')) return 'technology';
        
        return 'general';
    }

    analyzeSentiment(title, summary) {
        const text = (title + ' ' + summary).toLowerCase();
        
        const positiveWords = [
            'surge', 'rally', 'bullish', 'gains', 'rise', 'positive', 'breakthrough', 'adoption',
            'growth', 'boom', 'soar', 'spike', 'moon', 'bull', 'up', 'high', 'record',
            '上昇', '急騰', '強気', '利益', '増加', '前向き', '突破', '採用', '成長', '好調', '買い'
        ];
        
        const negativeWords = [
            'crash', 'dump', 'bearish', 'decline', 'fall', 'negative', 'concern', 'regulation',
            'drop', 'plunge', 'bear', 'down', 'low', 'sell', 'fear', 'risk',
            '暴落', 'ダンプ', '弱気', '下落', '落下', '否定的', '懸念', '規制',
            '低下', '急落', '熊', '下', '低い', '売り', '恐怖', 'リスク', '不安'
        ];
        
        const posCount = positiveWords.filter(word => text.includes(word)).length;
        const negCount = negativeWords.filter(word => text.includes(word)).length;
        
        if (posCount > negCount) return 'positive';
        if (negCount > posCount) return 'negative';
        return 'neutral';
    }

    displayNews() {
        const container = document.getElementById('newsContainer');
        if (!container) return;

        if (this.filteredNews.length === 0) {
            this.showNoResults();
            return;
        }

        const newsHtml = this.filteredNews.map((item, index) => this.createNewsCard(item, index)).join('');
        container.innerHTML = newsHtml;

        // Add click listeners
        this.addNewsCardListeners();
        
        // Show load more button if there are more items
        const loadMoreBtn = document.getElementById('loadMore');
        if (loadMoreBtn && this.filteredNews.length >= 10) {
            loadMoreBtn.style.display = 'block';
        }
    }

    createNewsCard(item, index) {
        const timeAgo = this.formatTimeAgo(item.publishedDate);
        const categoryClass = `category-${item.category}`;
        const sentimentClass = `sentiment-${item.sentiment}`;
        const sentimentIcon = this.getSentimentIcon(item.sentiment);
        
        return `
            <div class="col-lg-4 col-md-6 mb-4">
                <div class="news-card stagger-animation" data-news-id="${item.id}" style="animation-delay: ${index * 0.1}s">
                    <div class="news-card-image">
                        <i class="news-icon ${this.getCategoryIcon(item.category)}"></i>
                        <div class="news-card-source">${item.source}</div>
                    </div>
                    <div class="news-card-body">
                        <div class="category-badge ${categoryClass}">
                            ${this.getCategoryLabel(item.category)}
                        </div>
                        <h3 class="news-card-title">${item.title}</h3>
                        <p class="news-card-summary">${item.summary || 'ニュース詳細を読み込み中...'}</p>
                        <div class="news-card-footer">
                            <div class="news-card-time">
                                <i class="fas fa-clock"></i>
                                ${timeAgo}
                            </div>
                            <div class="news-card-sentiment ${sentimentClass}">
                                ${sentimentIcon} ${this.getSentimentLabel(item.sentiment)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getCategoryIcon(category) {
        const icons = {
            bitcoin: 'fab fa-bitcoin',
            ethereum: 'fab fa-ethereum',
            defi: 'fas fa-coins',
            regulation: 'fas fa-gavel',
            technology: 'fas fa-microchip',
            general: 'fas fa-newspaper'
        };
        return icons[category] || icons.general;
    }

    getCategoryLabel(category) {
        const labels = {
            bitcoin: 'Bitcoin',
            ethereum: 'Ethereum',
            defi: 'DeFi',
            regulation: '規制',
            technology: '技術',
            general: '一般'
        };
        return labels[category] || labels.general;
    }

    getSentimentIcon(sentiment) {
        const icons = {
            positive: '😊',
            negative: '😟',
            neutral: '😐'
        };
        return icons[sentiment] || icons.neutral;
    }

    getSentimentLabel(sentiment) {
        const labels = {
            positive: 'ポジティブ',
            negative: 'ネガティブ',
            neutral: 'ニュートラル'
        };
        return labels[sentiment] || labels.neutral;
    }

    addNewsCardListeners() {
        document.querySelectorAll('.news-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const newsId = e.currentTarget.dataset.newsId;
                const newsItem = this.filteredNews.find(item => item.id === newsId);
                if (newsItem) {
                    this.showNewsModal(newsItem);
                }
            });
        });
    }

    showNewsModal(newsItem) {
        const modal = document.getElementById('newsModal');
        const modalTitle = document.getElementById('newsModalTitle');
        const modalContent = document.getElementById('newsModalContent');
        const modalLink = document.getElementById('newsModalLink');

        if (modalTitle) modalTitle.textContent = newsItem.title;
        if (modalLink) modalLink.href = newsItem.url;

        if (modalContent) {
            const sentimentClass = `sentiment-${newsItem.sentiment}`;
            const sentimentIcon = this.getSentimentIcon(newsItem.sentiment);
            
            modalContent.innerHTML = `
                <div class="news-modal-meta">
                    <div class="news-modal-source">${newsItem.source}</div>
                    <div class="news-modal-time">
                        <i class="fas fa-clock me-1"></i>
                        ${this.formatTimeAgo(newsItem.publishedDate)}
                    </div>
                    <div class="ms-auto">
                        <span class="news-card-sentiment ${sentimentClass}">
                            ${sentimentIcon} ${this.getSentimentLabel(newsItem.sentiment)}
                        </span>
                    </div>
                </div>
                <div class="news-modal-content">
                    <p>${newsItem.summary || 'この記事の詳細な内容を読むには、元記事のリンクをクリックしてください。'}</p>
                    <p class="text-muted">
                        <small>
                            <i class="fas fa-info-circle me-1"></i>
                            完全な記事を読むには「元記事を読む」ボタンをクリックしてください。
                        </small>
                    </p>
                </div>
            `;
        }

        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
    }

    applyFilters() {
        const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';
        const sourceFilter = document.getElementById('sourceFilter')?.value || 'all';
        const timeFilter = document.getElementById('timeFilter')?.value || '24h';

        this.filteredNews = this.newsData.filter(item => {
            // Category filter
            if (categoryFilter !== 'all' && item.category !== categoryFilter) {
                return false;
            }

            // Source filter
            if (sourceFilter !== 'all' && !item.source.toLowerCase().includes(sourceFilter)) {
                return false;
            }

            // Time filter
            const now = new Date();
            const itemTime = new Date(item.published);
            let timeThreshold;

            switch (timeFilter) {
                case '24h':
                    timeThreshold = new Date(now - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    timeThreshold = new Date(now - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    timeThreshold = new Date(now - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    timeThreshold = new Date(0);
            }

            if (itemTime < timeThreshold) {
                return false;
            }

            return true;
        });

        this.displayNews();
    }

    async refreshNews() {
        this.newsData = [];
        this.filteredNews = [];
        this.currentPage = 1;
        await this.loadNews();
    }

    loadMoreNews() {
        // In a real implementation, this would load more pages from the API
        this.showToast('すべてのニュースが読み込まれています', 'info');
    }

    displaySampleNews() {
        const sampleNews = [
            {
                title: "Bitcoin価格が50,000ドルの大台を突破、機関投資家の参入が加速",
                source: "CryptoNews Japan",
                published: new Date(Date.now() - 2 * 60 * 60 * 1000),
                summary: "ビットコインの価格が心理的な節目である50,000ドルを上回り、機関投資家からの大量の資金流入が続いている。市場専門家らは今後の展開について楽観的な見方を示している。",
                url: "https://example.com/bitcoin-50k",
                category: "bitcoin",
                sentiment: "positive"
            },
            {
                title: "イーサリアム2.0のステーキング参加者が1,500万人を超える",
                source: "DeFi Today",
                published: new Date(Date.now() - 4 * 60 * 60 * 1000),
                summary: "イーサリアム2.0のステーキングプールへの参加者数が急速に増加しており、ネットワークのセキュリティとスケーラビリティの向上に貢献している。",
                url: "https://example.com/eth2-staking",
                category: "ethereum",
                sentiment: "positive"
            },
            {
                title: "米SEC、新たな暗号資産規制ガイドラインを発表",
                source: "Regulatory Watch",
                published: new Date(Date.now() - 6 * 60 * 60 * 1000),
                summary: "米国証券取引委員会（SEC）が暗号資産取引所に対する新しい規制要件を公表し、業界の透明性向上を目指している。",
                url: "https://example.com/sec-guidelines",
                category: "regulation",
                sentiment: "neutral"
            },
            {
                title: "DeFiの総ロック価値（TVL）が史上最高の300億ドルに到達",
                source: "DeFi Pulse",
                published: new Date(Date.now() - 8 * 60 * 60 * 1000),
                summary: "分散型金融プロトコル全体の総ロック価値が過去最高を更新し、DeFi エコシステムの急激な成長を示している。",
                url: "https://example.com/defi-tvl-record",
                category: "defi",
                sentiment: "positive"
            },
            {
                title: "Layer 2ソリューション、ガス代を99%削減する新技術を導入",
                source: "Tech Crypto",
                published: new Date(Date.now() - 10 * 60 * 60 * 1000),
                summary: "複数のLayer 2プロジェクトが新しい技術を導入し、取引手数料の大幅な削減に成功。ユーザビリティの向上が期待される。",
                url: "https://example.com/layer2-gas-reduction",
                category: "technology",
                sentiment: "positive"
            },
            {
                title: "中央銀行デジタル通貨（CBDC）の実証実験、世界10カ国で同時開始",
                source: "Global Finance",
                published: new Date(Date.now() - 12 * 60 * 60 * 1000),
                summary: "世界各国の中央銀行がCBDCの実証実験を開始し、デジタル決済の未来に向けた重要な一歩を踏み出している。",
                url: "https://example.com/cbdc-trials",
                category: "regulation",
                sentiment: "neutral"
            }
        ];

        // Add IDs and enhanced data
        this.newsData = sampleNews.map((item, index) => ({
            ...item,
            id: `sample-news-${index}`,
            publishedDate: item.published
        }));

        this.filteredNews = [...this.newsData];
        this.displayNews();
    }

    showNoResults() {
        const container = document.getElementById('newsContainer');
        if (container) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="no-results">
                        <i class="fas fa-search"></i>
                        <h4>ニュースが見つかりません</h4>
                        <p>フィルター条件を変更して再度お試しください</p>
                        <button class="btn btn-primary mt-3" onclick="this.clearFilters()">
                            フィルターをクリア
                        </button>
                    </div>
                </div>
            `;
        }
    }

    clearFilters() {
        document.getElementById('categoryFilter').value = 'all';
        document.getElementById('sourceFilter').value = 'all';
        document.getElementById('timeFilter').value = '24h';
        this.applyFilters();
    }

    showLoadingSpinner(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.style.display = show ? 'block' : 'none';
        }
    }

    formatTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'たった今';
        if (diffMins < 60) return `${diffMins}分前`;
        if (diffHours < 24) return `${diffHours}時間前`;
        if (diffDays < 7) return `${diffDays}日前`;
        
        return date.toLocaleDateString('ja-JP');
    }

    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `alert alert-${type === 'error' ? 'danger' : type} position-fixed`;
        toast.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 1060;
            min-width: 300px;
            animation: slideInRight 0.3s ease;
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
                toast.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }
        }, 3000);
    }
}

// Animation CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Global function for clearing filters
window.clearFilters = function() {
    if (window.cryptoNewsApp) {
        window.cryptoNewsApp.clearFilters();
    }
};

// Initialize the news app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.cryptoNewsApp = new CryptoNewsApp();
});