"""
Configuration file for Cryptocurrency Trading Assistant Agent
"""

import os
from typing import Dict, List, Optional

class Config:
    """Configuration class for the crypto trading assistant."""
    
    # API Endpoints
    COINGECKO_API_BASE = "https://api.coingecko.com/api/v3"
    COINMARKETCAP_API_BASE = "https://pro-api.coinmarketcap.com/v1"
    
    # News RSS Feeds
    NEWS_RSS_FEEDS = [
        "https://cointelegraph.com/rss",
        "https://bitcoinist.com/feed", 
        "https://newsbtc.com/feed",
        "https://cryptopotato.com/feed"
    ]
    
    # Japanese News Sources (RSS endpoints may need to be updated)
    JAPANESE_NEWS_SOURCES = [
        "https://www.coindeskjapan.com",
        "https://jp.cointelegraph.com"
    ]
    
    # Supported Cryptocurrencies (CoinGecko IDs)
    SUPPORTED_CRYPTOS = {
        "BTC": "bitcoin",
        "ETH": "ethereum", 
        "ADA": "cardano",
        "MATIC": "polygon",
        "SOL": "solana",
        "LINK": "chainlink",
        "DOT": "polkadot", 
        "AVAX": "avalanche-2",
        "UNI": "uniswap",
        "AAVE": "aave",
        "XRP": "ripple",
        "LTC": "litecoin",
        "BCH": "bitcoin-cash",
        "BNB": "binancecoin",
        "DOGE": "dogecoin"
    }
    
    # Analysis Configuration
    DEFAULT_ANALYSIS_DEPTH = "standard"
    MAX_NEWS_ITEMS = 20
    PRICE_UPDATE_INTERVAL = 300  # 5 minutes
    
    # Web Interface Configuration  
    WEB_HOST = "0.0.0.0"
    WEB_PORT = 5000
    SECRET_KEY = os.getenv("SECRET_KEY", "crypto_trading_assistant_2024")
    DEBUG_MODE = os.getenv("DEBUG", "False").lower() == "true"
    
    # API Keys (from environment variables)
    COINGECKO_API_KEY = os.getenv("COINGECKO_API_KEY")
    COINMARKETCAP_API_KEY = os.getenv("COINMARKETCAP_API_KEY") 
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    
    # Data Storage
    DATA_DIR = os.getenv("DATA_DIR", "./data")
    CACHE_DIR = os.getenv("CACHE_DIR", "./cache")
    RESULTS_DIR = os.getenv("RESULTS_DIR", "./results")
    
    # Logging Configuration
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE = os.getenv("LOG_FILE", "crypto_agent.log")
    
    # Risk Management Defaults
    DEFAULT_VOLATILITY_THRESHOLD = {
        "low": 2.0,
        "moderate": 5.0, 
        "high": 10.0
    }
    
    DEFAULT_MARKET_CAP_THRESHOLDS = {
        "large_cap": 100_000_000_000,  # >$100B
        "mid_cap": 10_000_000_000,     # >$10B
        "small_cap": 0                  # <$10B
    }
    
    # Analysis Agents Configuration
    AGENTS_CONFIG = {
        "technical_analysis": {
            "enabled": True,
            "indicators": ["price_change", "volume", "market_cap"],
            "timeframes": ["24h", "7d", "30d"]
        },
        "sentiment_analysis": {
            "enabled": True,
            "sources": ["news", "social_media"],
            "keywords": {
                "positive": ["surge", "rally", "bullish", "gains", "rise", "positive", "breakthrough", "adoption"],
                "negative": ["crash", "dump", "bearish", "decline", "fall", "negative", "concern", "regulation"]
            }
        },
        "risk_assessment": {
            "enabled": True,
            "factors": ["volatility", "market_cap", "liquidity", "regulatory"],
            "scoring_weights": {
                "volatility": 0.3,
                "market_cap": 0.2,
                "liquidity": 0.2,
                "news_sentiment": 0.3
            }
        }
    }
    
    @classmethod
    def get_crypto_id(cls, symbol: str) -> Optional[str]:
        """Get CoinGecko ID for a cryptocurrency symbol."""
        return cls.SUPPORTED_CRYPTOS.get(symbol.upper())
    
    @classmethod  
    def get_supported_symbols(cls) -> List[str]:
        """Get list of supported cryptocurrency symbols."""
        return list(cls.SUPPORTED_CRYPTOS.keys())
    
    @classmethod
    def create_directories(cls):
        """Create necessary directories if they don't exist."""
        directories = [cls.DATA_DIR, cls.CACHE_DIR, cls.RESULTS_DIR]
        for directory in directories:
            os.makedirs(directory, exist_ok=True)
    
    @classmethod
    def validate_config(cls) -> Dict[str, bool]:
        """Validate configuration and return status of required components."""
        status = {
            "directories": True,
            "api_access": False,
            "web_dependencies": False
        }
        
        try:
            cls.create_directories()
        except Exception:
            status["directories"] = False
        
        # Check if we can make API calls
        try:
            import requests
            response = requests.get(f"{cls.COINGECKO_API_BASE}/ping", timeout=5)
            status["api_access"] = response.status_code == 200
        except Exception:
            status["api_access"] = False
        
        # Check web dependencies
        try:
            import flask
            import flask_socketio
            status["web_dependencies"] = True
        except ImportError:
            status["web_dependencies"] = False
        
        return status

# Environment-specific configurations
class DevelopmentConfig(Config):
    """Development environment configuration."""
    DEBUG_MODE = True
    LOG_LEVEL = "DEBUG"

class ProductionConfig(Config):
    """Production environment configuration."""
    DEBUG_MODE = False
    LOG_LEVEL = "WARNING"

class TestingConfig(Config):
    """Testing environment configuration."""
    DEBUG_MODE = True
    LOG_LEVEL = "DEBUG"
    DATA_DIR = "./test_data"
    CACHE_DIR = "./test_cache"

# Configuration factory
def get_config(env: str = None) -> Config:
    """Get configuration based on environment."""
    env = env or os.getenv("FLASK_ENV", "development")
    
    configs = {
        "development": DevelopmentConfig,
        "production": ProductionConfig,
        "testing": TestingConfig
    }
    
    return configs.get(env, DevelopmentConfig)