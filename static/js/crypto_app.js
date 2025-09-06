// Cryptocurrency Trading Assistant JavaScript

class CryptoTradingApp {
    constructor() {
        this.currentAnalysis = null;
        this.theme = localStorage.getItem('theme') || 'light';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setTheme(this.theme);
        this.checkAPIStatus();
    }

    setupEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Analysis form
        const analysisForm = document.getElementById('analysisForm');
        if (analysisForm) {
            analysisForm.addEventListener('submit', (e) => this.handleAnalysisSubmit(e));
        }

        // Custom symbol input
        const customSymbol = document.getElementById('customSymbol');
        const cryptoSymbol = document.getElementById('cryptoSymbol');
        
        if (customSymbol && cryptoSymbol) {
            customSymbol.addEventListener('input', (e) => {
                if (e.target.value) {
                    cryptoSymbol.value = '';
                }
            });

            cryptoSymbol.addEventListener('change', (e) => {
                if (e.target.value) {
                    customSymbol.value = '';
                }
            });
        }
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.setTheme(this.theme);
        localStorage.setItem('theme', this.theme);
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

    async handleAnalysisSubmit(e) {
        e.preventDefault();
        
        const formData = this.getFormData();
        if (!this.validateFormData(formData)) {
            return;
        }

        await this.runAnalysis(formData);
    }

    getFormData() {
        const cryptoSymbol = document.getElementById('cryptoSymbol').value;
        const customSymbol = document.getElementById('customSymbol').value;
        const analysisDepth = document.getElementById('analysisDepth').value;
        
        const enabledAgents = {
            technical: document.getElementById('technicalAgent').checked,
            sentiment: document.getElementById('sentimentAgent').checked,
            risk: document.getElementById('riskAgent').checked
        };

        return {
            symbol: customSymbol || cryptoSymbol,
            depth: analysisDepth,
            agents: enabledAgents
        };
    }

    validateFormData(data) {
        if (!data.symbol) {
            this.showError('仮想通貨銘柄を選択または入力してください。');
            return false;
        }

        const enabledAgentCount = Object.values(data.agents).filter(Boolean).length;
        if (enabledAgentCount === 0) {
            this.showError('少なくとも1つの分析エージェントを選択してください。');
            return false;
        }

        return true;
    }

    async runAnalysis(formData) {
        this.setAnalysisStatus('analyzing', '分析実行中...');
        this.showLoadingSpinner(true);
        
        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            
            if (result.success) {
                this.displayAnalysisResults(result.analysis);
                this.setAnalysisStatus('completed', '分析完了');
                this.showExportOptions(true);
            } else {
                this.showError(`分析エラー: ${result.error}`);
                this.setAnalysisStatus('error', 'エラー');
            }
        } catch (error) {
            console.error('Analysis error:', error);
            this.showError('分析中にエラーが発生しました。しばらく後にもう一度お試しください。');
            this.setAnalysisStatus('error', 'エラー');
        } finally {
            this.showLoadingSpinner(false);
        }
    }

    displayAnalysisResults(analysisText) {
        const resultsContainer = document.getElementById('analysisResults');
        if (!resultsContainer) return;

        // Convert markdown to HTML if marked.js is available
        let htmlContent;
        if (typeof marked !== 'undefined') {
            htmlContent = marked.parse(analysisText);
        } else {
            // Fallback: simple formatting
            htmlContent = this.simpleMarkdownToHtml(analysisText);
        }

        resultsContainer.innerHTML = htmlContent;
        resultsContainer.classList.add('analysis-results', 'fade-in');
        
        // Scroll to results
        resultsContainer.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start' 
        });

        this.currentAnalysis = analysisText;
    }

    simpleMarkdownToHtml(text) {
        return text
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^- (.*$)/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
            .replace(/\n/g, '<br>');
    }

    setAnalysisStatus(status, text) {
        const statusElement = document.getElementById('analysisStatus');
        if (!statusElement) return;

        statusElement.textContent = text;
        statusElement.className = 'badge';

        switch (status) {
            case 'analyzing':
                statusElement.classList.add('bg-primary');
                break;
            case 'completed':
                statusElement.classList.add('bg-success');
                break;
            case 'error':
                statusElement.classList.add('bg-danger');
                break;
            default:
                statusElement.classList.add('bg-secondary');
        }
    }

    showLoadingSpinner(show) {
        const spinner = document.getElementById('loadingSpinner');
        const results = document.getElementById('analysisResults');
        
        if (spinner && results) {
            if (show) {
                spinner.classList.remove('d-none');
                results.style.opacity = '0.3';
            } else {
                spinner.classList.add('d-none');
                results.style.opacity = '1';
            }
        }
    }

    showExportOptions(show) {
        const exportOptions = document.getElementById('exportOptions');
        if (exportOptions) {
            if (show) {
                exportOptions.classList.remove('d-none');
                exportOptions.classList.add('slide-up');
            } else {
                exportOptions.classList.add('d-none');
            }
        }
    }

    showError(message) {
        // Create error alert
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger alert-dismissible fade show';
        alert.innerHTML = `
            <i class="fas fa-exclamation-circle"></i> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Insert at top of main content
        const main = document.querySelector('main');
        if (main) {
            main.insertBefore(alert, main.firstChild);
            
            // Auto-dismiss after 5 seconds
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.remove();
                }
            }, 5000);
        }
    }

    async checkAPIStatus() {
        try {
            const response = await fetch('/api/status');
            const status = await response.json();
            this.updateSystemStatus(status);
        } catch (error) {
            console.warn('Could not check API status:', error);
            this.updateSystemStatus({ online: false });
        }
    }

    updateSystemStatus(status) {
        // Update status indicators in the UI
        const statusElements = document.querySelectorAll('.status-item .badge');
        if (statusElements.length > 0 && status.online === false) {
            statusElements[0].textContent = 'オフライン';
            statusElements[0].className = 'badge bg-danger';
        }
    }
}

// Export functions for global access
window.exportResults = function(format) {
    const app = window.cryptoApp;
    if (!app || !app.currentAnalysis) {
        alert('エクスポートするデータがありません。');
        return;
    }

    const filename = `crypto_analysis_${new Date().toISOString().slice(0, 10)}`;
    
    switch (format) {
        case 'txt':
            downloadText(app.currentAnalysis, `${filename}.txt`);
            break;
        case 'html':
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>仮想通貨分析結果</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1, h2, h3 { color: #333; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    ${typeof marked !== 'undefined' ? marked.parse(app.currentAnalysis) : app.currentAnalysis.replace(/\n/g, '<br>')}
</body>
</html>`;
            downloadText(htmlContent, `${filename}.html`);
            break;
        case 'pdf':
            // For PDF export, we'll use the browser's print functionality
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head><title>仮想通貨分析結果</title></head>
                <body style="font-family: Arial; margin: 20px;">
                    ${typeof marked !== 'undefined' ? marked.parse(app.currentAnalysis) : app.currentAnalysis.replace(/\n/g, '<br>')}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
            break;
    }
};

function downloadText(content, filename) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.cryptoApp = new CryptoTradingApp();
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to start analysis
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const form = document.getElementById('analysisForm');
        if (form) {
            form.dispatchEvent(new Event('submit'));
        }
    }
    
    // Ctrl/Cmd + D to toggle theme
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        window.cryptoApp.toggleTheme();
    }
});

// Service worker registration for offline capability (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}