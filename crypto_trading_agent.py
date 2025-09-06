#!/usr/bin/env python3
"""
Cryptocurrency Trading Assistant Agent
Combines multi-agent analysis with comprehensive data sources for crypto trading decisions.
"""

import asyncio
import json
import logging
import re
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed

# Optional dependencies with graceful fallback
try:
    import requests
except ImportError:
    requests = None

try:
    import feedparser
except ImportError:
    feedparser = None

try:
    import google.generativeai as genai
except ImportError:
    genai = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class CryptoData:
    symbol: str
    price_usd: float
    price_jpy: float
    market_cap: float
    volume_24h: float
    price_change_24h: float
    timestamp: datetime

@dataclass
class NewsItem:
    title: str
    url: str
    source: str
    published: datetime
    summary: str

class CryptoDataAggregator:
    """Aggregates cryptocurrency data from multiple sources."""
    
    def __init__(self):
        self.coingecko_api = "https://api.coingecko.com/api/v3"
        
        # Rate limiting and caching
        self.last_api_call = 0
        self.min_api_interval = 2  # Minimum 2 seconds between API calls
        self.price_cache = {}
        self.cache_duration = 60  # Cache for 60 seconds
        
        # Initialize Gemini AI
        self.gemini_api_key = os.getenv('GEMINI_API_KEY')
        if self.gemini_api_key and genai:
            try:
                genai.configure(api_key=self.gemini_api_key)
                self.gemini_model = genai.GenerativeModel('gemini-pro')
                logger.info("Gemini API initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini API: {e}")
                self.gemini_model = None
        else:
            self.gemini_model = None
            if not self.gemini_api_key:
                logger.info("GEMINI_API_KEY not found in environment variables")
        # Enhanced RSS sources from the guide
        self.news_sources = [
            # Main English sources with confirmed RSS
            "https://cointelegraph.com/rss",
            "https://bitcoinist.com/feed", 
            "https://newsbtc.com/feed",
            "https://cryptopotato.com/feed",
            # Additional reliable sources
            "https://coindesk.com/arc/outboundfeeds/rss/",
            "https://decrypt.co/feed"
        ]
        self.japanese_sources = [
            # Will need to check for RSS endpoints
            "https://www.coindeskjapan.com",
            "https://jp.cointelegraph.com"
        ]
        # News categorization keywords
        self.category_keywords = {
            'bitcoin': ['bitcoin', 'btc', 'satoshi'],
            'ethereum': ['ethereum', 'eth', 'vitalik', 'eip', 'merge', 'staking'],
            'defi': ['defi', 'decentralized finance', 'yield', 'liquidity', 'uniswap', 'aave', 'compound'],
            'regulation': ['regulation', 'sec', 'cftc', 'fda', 'government', 'ban', 'legal', 'compliance'],
            'technology': ['blockchain', 'smart contract', 'consensus', 'mining', 'node', 'protocol'],
            'market': ['price', 'bull', 'bear', 'rally', 'crash', 'volatility', 'trading'],
            'adoption': ['adoption', 'institutional', 'corporate', 'mainstream', 'acceptance'],
            'security': ['hack', 'exploit', 'vulnerability', 'security', 'breach', 'scam']
        }
        # Sentiment analysis keywords
        self.positive_keywords = ['surge', 'rally', 'bullish', 'growth', 'adoption', 'partnership', 
                                'upgrade', 'launch', 'success', 'breakthrough', 'positive', 'gains']
        self.negative_keywords = ['crash', 'dump', 'bearish', 'decline', 'hack', 'ban', 'regulation',
                                'vulnerability', 'scam', 'negative', 'losses', 'concerns']
        
        # Translation dictionary for common crypto terms
        self.translation_dict = {
            # Market terms
            'surge': '急騰', 'rally': '上昇', 'bullish': '強気', 'bearish': '弱気',
            'dump': '暴落', 'crash': 'クラッシュ', 'pump': '急騰', 'moon': '高騰',
            'gains': '利益', 'losses': '損失', 'volatility': 'ボラティリティ',
            'adoption': '採用', 'breakthrough': '突破', 'partnership': 'パートナーシップ',
            
            # Crypto terms
            'bitcoin': 'ビットコイン', 'ethereum': 'イーサリアム', 'blockchain': 'ブロックチェーン',
            'cryptocurrency': '仮想通貨', 'crypto': '仮想通貨', 'defi': 'DeFi',
            'smart contract': 'スマートコントラクト', 'mining': 'マイニング',
            'wallet': 'ウォレット', 'exchange': '取引所', 'trading': '取引',
            
            # Action terms  
            'launched': 'ローンチ', 'announced': '発表', 'revealed': '発表',
            'upgraded': 'アップグレード', 'integrated': '統合', 'acquired': '買収',
            'invested': '投資', 'funding': '資金調達', 'raised': '調達'
        }
    
    def get_crypto_price(self, symbol: str) -> Optional[CryptoData]:
        """Get current cryptocurrency price data with rate limiting and caching."""
        if not requests:
            logger.error("requests library not available. Install with: pip install requests")
            return None
        
        # Check cache first
        cache_key = symbol.lower()
        now = time.time()
        
        if cache_key in self.price_cache:
            cached_data, cache_time = self.price_cache[cache_key]
            if now - cache_time < self.cache_duration:
                logger.info(f"Returning cached data for {symbol}")
                return cached_data
        
        # Rate limiting
        time_since_last_call = now - self.last_api_call
        if time_since_last_call < self.min_api_interval:
            sleep_time = self.min_api_interval - time_since_last_call
            logger.info(f"Rate limiting: sleeping for {sleep_time:.2f} seconds")
            time.sleep(sleep_time)
        
        try:
            url = f"{self.coingecko_api}/simple/price"
            params = {
                'ids': symbol.lower(),
                'vs_currencies': 'usd,jpy',
                'include_market_cap': 'true',
                'include_24hr_vol': 'true',
                'include_24hr_change': 'true'
            }
            
            self.last_api_call = time.time()
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if symbol.lower() in data:
                coin_data = data[symbol.lower()]
                crypto_data = CryptoData(
                    symbol=symbol.upper(),
                    price_usd=coin_data.get('usd', 0),
                    price_jpy=coin_data.get('jpy', 0),
                    market_cap=coin_data.get('usd_market_cap', 0),
                    volume_24h=coin_data.get('usd_24h_vol', 0),
                    price_change_24h=coin_data.get('usd_24h_change', 0),
                    timestamp=datetime.now()
                )
                
                # Cache the result
                self.price_cache[cache_key] = (crypto_data, time.time())
                return crypto_data
                
        except Exception as e:
            logger.error(f"Error fetching price for {symbol}: {e}")
            # Return cached data if available, even if expired
            if cache_key in self.price_cache:
                logger.info(f"Returning expired cached data for {symbol}")
                cached_data, _ = self.price_cache[cache_key]
                return cached_data
                
        return None
    
    def get_crypto_news(self, limit: int = 20) -> List[NewsItem]:
        """Get latest cryptocurrency news from RSS feeds with enhanced analysis."""
        if not feedparser:
            logger.warning("feedparser library not available. Install with: pip install feedparser")
            return self._get_sample_news(limit)
        
        news_items = []
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            for source_url in self.news_sources:
                future = executor.submit(self._parse_rss_feed_enhanced, source_url)
                futures.append(future)
            
            for future in as_completed(futures):
                try:
                    items = future.result()
                    news_items.extend(items)
                except Exception as e:
                    logger.error(f"Error parsing news feed: {e}")
        
        # Sort by publication date and return most recent with analysis
        news_items.sort(key=lambda x: x.published, reverse=True)
        return news_items[:limit]
    
    def categorize_news(self, text: str) -> List[str]:
        """Categorize news based on content."""
        categories = []
        text_lower = text.lower()
        
        for category, keywords in self.category_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                categories.append(category)
        
        return categories if categories else ['general']
    
    def analyze_sentiment(self, text: str) -> tuple:
        """Analyze sentiment of news text. Returns (sentiment, score)."""
        text_lower = text.lower()
        
        positive_score = sum(1 for keyword in self.positive_keywords if keyword in text_lower)
        negative_score = sum(1 for keyword in self.negative_keywords if keyword in text_lower)
        
        total_score = positive_score - negative_score
        
        if total_score > 1:
            return ('positive', total_score)
        elif total_score < -1:
            return ('negative', total_score)
        else:
            return ('neutral', total_score)
    
    def translate_crypto_terms(self, text: str) -> str:
        """Translate common crypto terms to Japanese."""
        translated_text = text
        for english, japanese in self.translation_dict.items():
            # Case insensitive replacement
            translated_text = re.sub(r'\b' + re.escape(english) + r'\b', japanese, translated_text, flags=re.IGNORECASE)
        return translated_text
    
    def summarize_and_translate_news(self, title: str, summary: str) -> dict:
        """Summarize and translate news content to Japanese using Gemini AI."""
        
        # Try Gemini AI translation first
        if self.gemini_model:
            try:
                prompt = f"""
以下の仮想通貨ニュースを日本語に翻訳し、要約してください。

タイトル: {title}
内容: {summary}

要求:
1. タイトルを自然な日本語に翻訳
2. 内容を2-3文で要約し日本語に翻訳
3. 仮想通貨の専門用語は適切な日本語に変換
4. 重要な情報を残しながら簡潔にまとめる

レスポンス形式:
タイトル: [翻訳されたタイトル]
要約: [翻訳された要約]
"""
                
                response = self.gemini_model.generate_content(prompt)
                
                if response.text:
                    lines = response.text.strip().split('\n')
                    japanese_title = title  # fallback
                    japanese_summary = summary  # fallback
                    
                    for line in lines:
                        if line.startswith('タイトル:'):
                            japanese_title = line.replace('タイトル:', '').strip()
                        elif line.startswith('要約:'):
                            japanese_summary = line.replace('要約:', '').strip()
                    
                    return {
                        'original_title': title,
                        'japanese_title': japanese_title,
                        'original_summary': summary,
                        'japanese_summary': japanese_summary,
                        'translation_applied': True,
                        'translation_method': 'gemini'
                    }
                    
            except Exception as e:
                logger.warning(f"Gemini translation failed, falling back to keyword replacement: {e}")
        
        # Fallback to basic keyword translation
        sentences = summary.split('. ')
        short_summary = '. '.join(sentences[:2])
        if len(sentences) > 2:
            short_summary += '...'
        
        japanese_title = self.translate_crypto_terms(title)
        japanese_summary = self.translate_crypto_terms(short_summary)
        
        return {
            'original_title': title,
            'japanese_title': japanese_title,
            'original_summary': summary,
            'japanese_summary': japanese_summary,
            'translation_applied': japanese_title != title or japanese_summary != short_summary,
            'translation_method': 'keywords'
        }
    
    def fetch_article_content(self, url: str) -> str:
        """Fetch full article content from URL."""
        if not requests or not BeautifulSoup:
            return ""
        
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Remove scripts, styles, and other unwanted elements
            for element in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe']):
                element.decompose()
            
            # Try to find article content using common selectors
            content_selectors = [
                'article', '.article-content', '.post-content', '.entry-content',
                '.content', 'main', '.main-content', '[role="main"]'
            ]
            
            content = ""
            for selector in content_selectors:
                elements = soup.select(selector)
                if elements:
                    content = ' '.join([elem.get_text().strip() for elem in elements])
                    break
            
            if not content:
                # Fallback to body text
                content = soup.get_text()
            
            # Clean up whitespace and limit length
            content = ' '.join(content.split())
            return content[:3000]  # Limit to 3000 characters
            
        except Exception as e:
            logger.warning(f"Error fetching article content from {url}: {e}")
            return ""
    
    def analyze_article_with_ai(self, title: str, summary: str, content: str, url: str) -> dict:
        """Use AI to analyze article and provide detailed insights."""
        if not self.gemini_model or not content:
            return self.summarize_and_translate_news(title, summary)
        
        try:
            prompt = f"""
以下の仮想通貨ニュース記事を詳細に分析し、日本語で情報をまとめてください：

タイトル: {title}
要約: {summary}
記事内容: {content}

以下の観点から分析してください：
1. 主要な内容の要約（3-4文）
2. 市場への影響度（高・中・低）
3. 関連する仮想通貨・プロジェクト
4. 投資家への示唆
5. 重要なキーワード（3-5個）

レスポンス形式：
タイトル: [日本語タイトル]
要約: [詳細要約]
影響度: [高/中/低]
関連通貨: [通貨名]
投資示唆: [投資への影響]
キーワード: [キーワード1, キーワード2, ...]
"""
            
            response = self.gemini_model.generate_content(prompt)
            
            if response.text:
                result = {
                    'original_title': title,
                    'original_summary': summary,
                    'japanese_title': title,
                    'japanese_summary': summary,
                    'impact_level': 'medium',
                    'related_currencies': [],
                    'investment_insight': '',
                    'keywords': [],
                    'full_content': content[:500],
                    'translation_method': 'gemini_detailed'
                }
                
                # Parse AI response
                lines = response.text.strip().split('\n')
                for line in lines:
                    if line.startswith('タイトル:'):
                        result['japanese_title'] = line.replace('タイトル:', '').strip()
                    elif line.startswith('要約:'):
                        result['japanese_summary'] = line.replace('要約:', '').strip()
                    elif line.startswith('影響度:'):
                        impact = line.replace('影響度:', '').strip()
                        result['impact_level'] = impact.lower()
                    elif line.startswith('関連通貨:'):
                        currencies = line.replace('関連通貨:', '').strip()
                        result['related_currencies'] = [c.strip() for c in currencies.split(',') if c.strip()]
                    elif line.startswith('投資示唆:'):
                        result['investment_insight'] = line.replace('投資示唆:', '').strip()
                    elif line.startswith('キーワード:'):
                        keywords = line.replace('キーワード:', '').strip()
                        result['keywords'] = [k.strip() for k in keywords.split(',') if k.strip()]
                
                result['translation_applied'] = True
                return result
                
        except Exception as e:
            logger.warning(f"Gemini detailed analysis failed: {e}")
        
        # Fallback to basic translation
        return self.summarize_and_translate_news(title, summary)
    
    def _parse_rss_feed_enhanced(self, feed_url: str) -> List[NewsItem]:
        """Parse a single RSS feed with enhanced analysis."""
        if not feedparser:
            return []
            
        try:
            logger.info(f"Parsing RSS feed: {feed_url}")
            feed = feedparser.parse(feed_url)
            items = []
            
            for entry in feed.entries[:15]:  # Limit per feed to get variety
                published = datetime.now()
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    try:
                        published = datetime(*entry.published_parsed[:6])
                    except:
                        published = datetime.now()
                
                title = entry.get('title', 'No title')
                summary = entry.get('summary', entry.get('description', ''))
                url = entry.get('link', '')
                full_text = f"{title} {summary}"
                
                # Enhanced analysis
                categories = self.categorize_news(full_text)
                sentiment, sentiment_score = self.analyze_sentiment(full_text)
                
                # Fetch full article content and analyze with AI
                article_content = self.fetch_article_content(url)
                if article_content and self.gemini_model:
                    translation_result = self.analyze_article_with_ai(title, summary, article_content, url)
                else:
                    translation_result = self.summarize_and_translate_news(title, summary)
                
                # Create enhanced NewsItem
                news_item = NewsItem(
                    title=translation_result['japanese_title'] if translation_result['translation_applied'] else title,
                    url=entry.get('link', ''),
                    source=feed.feed.get('title', self._extract_domain(feed_url)),
                    published=published,
                    summary=translation_result['japanese_summary'] if translation_result['translation_applied'] else summary
                )
                
                # Add enhanced attributes
                news_item.categories = categories
                news_item.sentiment = sentiment
                news_item.sentiment_score = sentiment_score
                news_item.original_title = translation_result['original_title']
                news_item.original_summary = translation_result['original_summary']
                news_item.translation_applied = translation_result['translation_applied']
                
                items.append(news_item)
            
            logger.info(f"Successfully parsed {len(items)} articles from {feed_url}")
            return items
            
        except Exception as e:
            logger.error(f"Error parsing RSS feed {feed_url}: {e}")
            return []
    
    def _extract_domain(self, url: str) -> str:
        """Extract domain name from URL."""
        try:
            from urllib.parse import urlparse
            return urlparse(url).netloc
        except:
            return url
    
    def _parse_rss_feed(self, feed_url: str) -> List[NewsItem]:
        """Legacy RSS feed parser - kept for compatibility."""
        return self._parse_rss_feed_enhanced(feed_url)
    
    def _get_sample_news(self, limit: int) -> List[NewsItem]:
        """Get sample news items when feedparser is not available."""
        sample_news = [
            NewsItem(
                title="Bitcoin価格が上昇傾向、機関投資家の関心高まる",
                url="https://example.com/bitcoin-institutional-interest",
                source="Sample Crypto News",
                published=datetime.now() - timedelta(hours=2),
                summary="機関投資家のビットコインへの関心が高まっており、価格上昇要因となっている"
            ),
            NewsItem(
                title="Ethereum 2.0アップデートが順調に進行",
                url="https://example.com/ethereum-upgrade",
                source="Sample Tech News",
                published=datetime.now() - timedelta(hours=4),
                summary="Ethereum 2.0のアップグレードが計画通り進行し、ステーキング報酬が安定している"
            ),
            NewsItem(
                title="DeFiプロトコルの総ロック資産価値が増加",
                url="https://example.com/defi-tvl-increase",
                source="Sample DeFi News",
                published=datetime.now() - timedelta(hours=6),
                summary="分散型金融プロトコルの総ロック資産価値が過去最高水準に達している"
            )
        ]
        return sample_news[:limit]

class CryptoAnalysisAgent:
    """Base class for crypto analysis agents."""
    
    def __init__(self, name: str, role: str):
        self.name = name
        self.role = role
    
    def analyze(self, crypto_data: CryptoData, news: List[NewsItem], context: str = "") -> str:
        """エージェントの専門分野に基づいて分析を実行する。"""
        raise NotImplementedError

class TechnicalAnalysisAgent(CryptoAnalysisAgent):
    """テクニカル分析専門エージェント"""
    
    def __init__(self):
        super().__init__("テクニカル分析エージェント", "テクニカル分析")
    
    def analyze(self, crypto_data: CryptoData, news: List[NewsItem], context: str = "") -> str:
        analysis = f"""
## 📊 {crypto_data.symbol} テクニカル分析レポート

**現在価格**: ${crypto_data.price_usd:,.2f} (¥{crypto_data.price_jpy:,.0f})
**24時間変動**: {crypto_data.price_change_24h:+.2f}%
**時価総額**: ${crypto_data.market_cap:,.0f}
**24時間取引量**: ${crypto_data.volume_24h:,.0f}

### 📈 テクニカル指標分析
"""
        
        # 価格動向の基本的なテクニカル分析
        if crypto_data.price_change_24h > 5:
            analysis += "\n🟢 **強い上昇シグナル**: 24時間で5%以上の上昇"
            analysis += "\n💡 **判断**: 強気トレンドが継続中。買い圧力が強い状況です。"
        elif crypto_data.price_change_24h > 2:
            analysis += "\n🟡 **中程度の上昇シグナル**: 24時間で2-5%の上昇"
            analysis += "\n💡 **判断**: 緩やかな上昇トレンド。慎重な楽観視が可能。"
        elif crypto_data.price_change_24h < -5:
            analysis += "\n🔴 **強い下降シグナル**: 24時間で5%以上の下落"
            analysis += "\n💡 **判断**: 売り圧力が強く、弱気トレンドが支配的。"
        elif crypto_data.price_change_24h < -2:
            analysis += "\n🟠 **中程度の下降シグナル**: 24時間で2-5%の下落"
            analysis += "\n💡 **判断**: 調整局面の可能性。様子見が推奨されます。"
        else:
            analysis += "\n⚪ **ニュートラル**: 価格は2%以内で安定"
            analysis += "\n💡 **判断**: レンジ相場。明確な方向性を待つ局面。"
        
        # 取引量分析
        if crypto_data.volume_24h > crypto_data.market_cap * 0.1:
            analysis += "\n\n📈 **高取引量**: 活発な取引活動を検出"
            analysis += "\n🔍 **詳細**: 時価総額の10%を超える取引量。市場の関心が高い状況。"
        else:
            analysis += "\n\n📉 **通常取引量**: 標準的な取引活動"
            analysis += "\n🔍 **詳細**: 通常レベルの取引量。安定した市場状況。"
        
        # 市場規模による分析
        if crypto_data.market_cap > 100_000_000_000:  # >$100B
            analysis += "\n\n🏛️ **大型銘柄**: 時価総額1000億ドル超の安定資産"
        elif crypto_data.market_cap > 10_000_000_000:  # >$10B
            analysis += "\n\n🏢 **中型銘柄**: 時価総額100-1000億ドルの成長資産"
        else:
            analysis += "\n\n🏠 **小型銘柄**: 時価総額100億ドル未満の高リスク・高リターン資産"
        
        return analysis

class SentimentAnalysisAgent(CryptoAnalysisAgent):
    """ニュースからのセンチメント分析専門エージェント"""
    
    def __init__(self):
        super().__init__("センチメント分析エージェント", "市場センチメント分析")
    
    def analyze(self, crypto_data: CryptoData, news: List[NewsItem], context: str = "") -> str:
        analysis = f"""
## 📰 {crypto_data.symbol} センチメント分析レポート

**最新ニュース分析** (過去{len(news)}件の記事):
"""
        
        # カテゴリ別ニュース統計
        category_counts = {}
        sentiment_counts = {'positive': 0, 'negative': 0, 'neutral': 0}
        
        # 重要ニュースのハイライト表示（上位8件）
        for i, item in enumerate(news[:8]):
            # Enhanced sentiment analysis if available
            if hasattr(item, 'sentiment') and hasattr(item, 'categories'):
                sentiment_emoji = '🟢' if item.sentiment == 'positive' else '🔴' if item.sentiment == 'negative' else '🟡'
                categories_str = ', '.join(item.categories)
                analysis += f"\n{sentiment_emoji} **{item.source}** ({item.sentiment.capitalize()}): {item.title}"
                
                # Count categories
                for category in item.categories:
                    category_counts[category] = category_counts.get(category, 0) + 1
                
                # Count sentiments
                sentiment_counts[item.sentiment] += 1
            else:
                # Legacy sentiment analysis
                title_lower = item.title.lower()
                summary_lower = (item.summary or '').lower()
                
                positive_score = sum(1 for keyword in self.positive_keywords if keyword in f"{title_lower} {summary_lower}")
                negative_score = sum(1 for keyword in self.negative_keywords if keyword in f"{title_lower} {summary_lower}")
                
                if positive_score > negative_score:
                    sentiment_emoji = '🟢'
                    sentiment = 'ポジティブ'
                    sentiment_counts['positive'] += 1
                elif negative_score > positive_score:
                    sentiment_emoji = '🔴'
                    sentiment = 'ネガティブ'
                    sentiment_counts['negative'] += 1
                else:
                    sentiment_emoji = '🟡'
                    sentiment = 'ニュートラル'
                    sentiment_counts['neutral'] += 1
                
                analysis += f"\n{sentiment_emoji} **{item.source}** ({sentiment}): {item.title}"
        
        # Additional news count
        remaining_news = len(news) - 8
        if remaining_news > 0:
            analysis += f"\n\n📝 **その他のニュース**: {remaining_news}件の追加ニュースを分析済み"
        
        # Category analysis
        if category_counts:
            analysis += f"\n\n### 📊 ニュースカテゴリ分析"
            for category, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
                category_names = {
                    'bitcoin': 'Bitcoin関連',
                    'ethereum': 'Ethereum関連', 
                    'defi': 'DeFi関連',
                    'regulation': '規制関連',
                    'technology': '技術関連',
                    'market': '市場関連',
                    'adoption': '採用関連',
                    'security': 'セキュリティ関連',
                    'general': '一般'
                }
                analysis += f"\n- {category_names.get(category, category)}: {count}件"
        
        # 総合センチメント評価
        total_news = len(news)
        if total_news > 0:
            positive_ratio = sentiment_counts['positive'] / total_news
            negative_ratio = sentiment_counts['negative'] / total_news
            
            analysis += f"\n\n### 🎯 総合センチメント評価"
            if positive_ratio > 0.5:
                analysis += f"\n🟢 **非常にポジティブ** - 市場は強い楽観ムードです"
                sentiment_score = int((positive_ratio - negative_ratio) * 10)
                analysis += f"\n📊 **スコア**: +{sentiment_score} (強気指標が支配的)"
                analysis += f"\n💡 **判断**: ニュースからの買い圧力が予想されます。"
            elif negative_ratio > 0.5:
                analysis += f"\n🔴 **ネガティブ傾向** - 市場に慎重なムードが広がっています"
                sentiment_score = int((negative_ratio - positive_ratio) * -10)
                analysis += f"\n📊 **スコア**: {sentiment_score} (弱気要因が多い)"
                analysis += f"\n💡 **判断**: ニュースからの売り圧力が懸念されます。"
            else:
                analysis += f"\n🟡 **ニュートラル** - バランスの取れたニュース環境"
                sentiment_score = int((positive_ratio - negative_ratio) * 5)
                analysis += f"\n📊 **スコア**: {sentiment_score:+d} (中立的な市場センチメント)"
                analysis += f"\n💡 **判断**: ニュースからの明確な方向性は見えません。"
        
        # 時間軸分析
        if news:
            recent_news = [n for n in news if (datetime.now() - n.published).days < 1]
            if recent_news:
                recent_positive = sum(1 for n in recent_news if hasattr(n, 'sentiment') and n.sentiment == 'positive')
                analysis += f"\n\n### ⏰ 最新24時間のトレンド"
                analysis += f"\n- 最新ニュース: {len(recent_news)}件"
                if recent_positive > len(recent_news) / 2:
                    analysis += f"\n- 📈 **直近トレンド**: ポジティブニュースが増加中"
                else:
                    analysis += f"\n- 📉 **直近トレンド**: 慎重なニュースが多い状況"
        
        return analysis

class RiskAssessmentAgent(CryptoAnalysisAgent):
    """リスク評価専門エージェント"""
    
    def __init__(self):
        super().__init__("リスク評価エージェント", "リスク分析")
    
    def analyze(self, crypto_data: CryptoData, news: List[NewsItem], context: str = "") -> str:
        analysis = f"""
## 🛡️ {crypto_data.symbol} リスク評価レポート

### 📊 ボラティリティ分析
"""
        
        # 24時間変動率に基づくボラティリティ評価
        abs_change = abs(crypto_data.price_change_24h)
        
        if abs_change > 15:
            risk_level = "🔴 **超高リスク**"
            risk_score = 5
            recommendation = "極めて高いボラティリティ。ポジションサイズを最小限に抑えることを推奨"
            detail = "24時間で15%を超える変動は異常値。市場の混乱や重要なイベントが発生している可能性"
        elif abs_change > 10:
            risk_level = "🔴 **高リスク**"
            risk_score = 4
            recommendation = "高いボラティリティのため、ポジションサイズの削減を検討"
            detail = "10%を超える日次変動。短期的な価格変動に注意が必要"
        elif abs_change > 5:
            risk_level = "🟠 **中リスク**"
            risk_score = 3
            recommendation = "標準的なリスク管理プロトコルの適用を推奨"
            detail = "中程度のボラティリティ。通常の仮想通貨市場の範囲内"
        elif abs_change > 2:
            risk_level = "🟡 **やや低リスク**"
            risk_score = 2
            recommendation = "比較的安定した値動き。通常の投資戦略が適用可能"
            detail = "軽度の価格変動。安定した市場環境を示唆"
        else:
            risk_level = "🟢 **低リスク**"
            risk_score = 1
            recommendation = "非常に安定した資産。大きなポジションも検討可能"
            detail = "極めて安定した価格動向。リスクは最小限"
        
        analysis += f"\n{risk_level} - 24時間ボラティリティ: {abs_change:.2f}%"
        analysis += f"\n💡 **推奨事項**: {recommendation}"
        analysis += f"\n🔍 **詳細**: {detail}"
        
        # 市場規模によるリスク評価
        analysis += f"\n\n### 🏛️ 市場規模リスク分析"
        
        if crypto_data.market_cap > 500_000_000_000:  # >$500B
            cap_risk = "🟢 **超大型銘柄**"
            cap_detail = "時価総額5000億ドル超。最高レベルの安定性と流動性を提供"
            cap_score = 1
        elif crypto_data.market_cap > 100_000_000_000:  # >$100B
            cap_risk = "🟢 **大型銘柄**"
            cap_detail = "確立された資産。機関投資家の参入により安定性が高い"
            cap_score = 2
        elif crypto_data.market_cap > 50_000_000_000:  # >$50B
            cap_risk = "🟡 **準大型銘柄**"
            cap_detail = "成長段階の主要銘柄。適度なリスクと成長ポテンシャルのバランス"
            cap_score = 2
        elif crypto_data.market_cap > 10_000_000_000:  # >$10B
            cap_risk = "🟡 **中型銘柄**"
            cap_detail = "中程度のリスクと成長ポテンシャル。市場変動の影響を受けやすい"
            cap_score = 3
        elif crypto_data.market_cap > 1_000_000_000:  # >$1B
            cap_risk = "🟠 **小型銘柄**"
            cap_detail = "高いリスクと高いリターン。価格操作のリスクも存在"
            cap_score = 4
        else:
            cap_risk = "🔴 **超小型銘柄**"
            cap_detail = "極めて高いリスク。流動性不足と大きな価格変動の可能性"
            cap_score = 5
        
        analysis += f"\n{cap_risk} - 時価総額: ${crypto_data.market_cap:,.0f}"
        analysis += f"\n🔍 **分析**: {cap_detail}"
        
        # 取引量リスク分析
        analysis += f"\n\n### 💹 流動性リスク分析"
        
        volume_to_mcap_ratio = crypto_data.volume_24h / crypto_data.market_cap if crypto_data.market_cap > 0 else 0
        
        if volume_to_mcap_ratio > 0.3:
            liquidity_risk = "🟢 **非常に高い流動性**"
            liquidity_detail = "極めて活発な取引。大口取引でも価格への影響は限定的"
            liquidity_score = 1
        elif volume_to_mcap_ratio > 0.1:
            liquidity_risk = "🟢 **高い流動性**"
            liquidity_detail = "活発な取引量。スムーズな売買が可能"
            liquidity_score = 1
        elif volume_to_mcap_ratio > 0.05:
            liquidity_risk = "🟡 **中程度の流動性**"
            liquidity_detail = "標準的な流動性レベル。大口取引時は注意が必要"
            liquidity_score = 2
        elif volume_to_mcap_ratio > 0.01:
            liquidity_risk = "🟠 **やや低い流動性**"
            liquidity_detail = "限定的な流動性。取引時のスリッページに注意"
            liquidity_score = 3
        else:
            liquidity_risk = "🔴 **低い流動性**"
            liquidity_detail = "流動性不足。大きな価格変動や売買困難のリスク"
            liquidity_score = 4
        
        analysis += f"\n{liquidity_risk} - 出来高/時価総額比: {volume_to_mcap_ratio:.1%}"
        analysis += f"\n🔍 **分析**: {liquidity_detail}"
        
        # 総合リスクスコア計算
        total_risk_score = (risk_score + cap_score + liquidity_score) / 3
        
        analysis += f"\n\n### 🎯 総合リスク評価"
        
        if total_risk_score <= 1.5:
            overall_risk = "🟢 **低リスク資産**"
            investment_advice = "保守的な投資家にも適した安定資産。長期保有に適している。"
        elif total_risk_score <= 2.5:
            overall_risk = "🟡 **中程度リスク資産**"
            investment_advice = "バランス型投資家向け。適度なリスク管理が必要。"
        elif total_risk_score <= 3.5:
            overall_risk = "🟠 **やや高リスク資産**"
            investment_advice = "リスク許容度の高い投資家向け。ポジション管理が重要。"
        else:
            overall_risk = "🔴 **高リスク資産**"
            investment_advice = "積極的な投資家のみ推奨。厳格なリスク管理が必須。"
        
        analysis += f"\n{overall_risk} - 総合スコア: {total_risk_score:.1f}/5.0"
        analysis += f"\n💡 **投資判断**: {investment_advice}"
        
        # リスク管理の推奨事項
        analysis += f"\n\n### 📋 リスク管理推奨事項"
        analysis += f"\n🔸 **ポジションサイズ**: 投資元本の{max(1, 20-int(total_risk_score*3)):.0f}%以下に制限"
        analysis += f"\n🔸 **ストップロス**: {max(5, int(total_risk_score*3)):.0f}%の損失で損切りを検討"
        analysis += f"\n🔸 **分散投資**: このアセットの比重は全体ポートフォリオの{max(10, 50-int(total_risk_score*10)):.0f}%以下に"
        
        return analysis

class CryptoTradingAssistant:
    """Main cryptocurrency trading assistant orchestrating multiple agents."""
    
    def __init__(self):
        self.data_aggregator = CryptoDataAggregator()
        self.agents = [
            TechnicalAnalysisAgent(),
            SentimentAnalysisAgent(),
            RiskAssessmentAgent()
        ]
    
    async def analyze_cryptocurrency(self, symbol: str) -> str:
        """Perform comprehensive cryptocurrency analysis."""
        logger.info(f"Starting analysis for {symbol}")
        
        # Gather data
        crypto_data = self.data_aggregator.get_crypto_price(symbol)
        if not crypto_data:
            return f"❌ Could not fetch data for {symbol}. Please check the symbol and try again."
        
        news = self.data_aggregator.get_crypto_news()
        
        # 包括的なレポートを生成
        report = f"""
# 📊 仮想通貨取引分析レポート
**分析対象**: {crypto_data.symbol}
**分析実行時刻**: {datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}
**データソース**: CoinGecko API, 複数のニュースRSSフィード

---
"""
        
        # Run all agent analyses
        for agent in self.agents:
            try:
                analysis = agent.analyze(crypto_data, news)
                report += f"\n{analysis}\n\n---\n"
            except Exception as e:
                logger.error(f"Error in {agent.name} analysis: {e}")
                report += f"\n⚠️ **{agent.name}**: 分析が一時的に利用できません\n\n---\n"
        
        # Add trading recommendation
        report += self._generate_trading_recommendation(crypto_data, news)
        
        return report
    
    def _generate_trading_recommendation(self, crypto_data: CryptoData, news: List[NewsItem]) -> str:
        """総合的な取引推奨を生成する"""
        recommendation = """
## 🎯 総合投資判断レポート

### 💰 ポジション推奨
"""
        
        # シンプルなスコアリングシステム
        score = 0
        analysis_factors = []
        
        # 価格モメンタムスコア
        if crypto_data.price_change_24h > 5:
            score += 2
            analysis_factors.append("強い上昇トレンド (+2点)")
        elif crypto_data.price_change_24h > 2:
            score += 1
            analysis_factors.append("中程度の上昇トレンド (+1点)")
        elif crypto_data.price_change_24h < -5:
            score -= 2
            analysis_factors.append("強い下降トレンド (-2点)")
        elif crypto_data.price_change_24h < -2:
            score -= 1
            analysis_factors.append("中程度の下降トレンド (-1点)")
        else:
            analysis_factors.append("価格安定 (0点)")
        
        # 取引量スコア
        if crypto_data.volume_24h > crypto_data.market_cap * 0.1:
            score += 1
            analysis_factors.append("高い取引量 (+1点)")
        else:
            analysis_factors.append("通常の取引量 (0点)")
        
        # ニュースセンチメントの簡易評価
        positive_count = 0
        negative_count = 0
        for item in news[:5]:  # 最新5件をチェック
            title_lower = item.title.lower()
            if any(word in title_lower for word in ['上昇', '急騰', '強気', 'surge', 'rally', 'bullish']):
                positive_count += 1
            elif any(word in title_lower for word in ['下落', '暴落', '弱気', 'crash', 'decline', 'bearish']):
                negative_count += 1
        
        if positive_count > negative_count:
            score += 1
            analysis_factors.append("ポジティブなニュースセンチメント (+1点)")
        elif negative_count > positive_count:
            score -= 1
            analysis_factors.append("ネガティブなニュースセンチメント (-1点)")
        else:
            analysis_factors.append("中立的なニュースセンチメント (0点)")
        
        # スコアに基づく推奨生成
        if score >= 3:
            recommendation += """
🟢 **強力な買いシグナル**
- 積極的なポジション構築を検討
- 技術的・センチメント的要因が強く一致
- 押し目での追加投資機会を監視
- 推奨投資比率: ポートフォリオの15-20%
"""
        elif score >= 1:
            recommendation += """
🟡 **買いシグナル**
- 慎重なポジション増加を検討
- 複数の好材料が揃っている状況
- 段階的な投資アプローチを推奨
- 推奨投資比率: ポートフォリオの10-15%
"""
        elif score <= -3:
            recommendation += """
🔴 **強力な売りシグナル**
- ポジションの大幅削減を検討
- 複数のネガティブ要因が重複
- 市場安定まで待機を推奨
- 推奨投資比率: ポートフォリオの0-5%
"""
        elif score <= -1:
            recommendation += """
🟠 **売りシグナル**
- ポジションサイズの削減を検討
- ネガティブ要因への警戒が必要
- 慎重な観察期間を推奨
- 推奨投資比率: ポートフォリオの5-10%
"""
        else:
            recommendation += """
⚪ **ホールド/中立**
- 現在のポジションを維持
- 混在するシグナルのため慎重な判断が必要
- より明確な方向性まで様子見
- 推奨投資比率: 現状維持
"""
        
        recommendation += f"""

### 📊 判断根拠 (総合スコア: {score:+d}点)
"""
        for factor in analysis_factors:
            recommendation += f"- {factor}\n"
        
        recommendation += f"""
### ⚠️ リスク管理の重要事項
- 🚫 **損失許容額**: 投資元本は失っても問題のない金額に限定
- 🛡️ **ストップロス**: {abs(crypto_data.price_change_24h) * 1.5:.1f}%程度の損失で損切り検討
- 📊 **分散投資**: 単一銘柄への過度な集中を避ける
- ⏰ **定期見直し**: 市況変化に応じた戦略調整

### 📈 現在の市場データサマリー
- **現在価格**: ${crypto_data.price_usd:,.2f} (¥{crypto_data.price_jpy:,.0f})
- **24時間変動**: {crypto_data.price_change_24h:+.2f}%
- **時価総額**: ${crypto_data.market_cap:,.0f}
- **24時間取引量**: ${crypto_data.volume_24h:,.0f}

---
**📝 免責事項**: この分析は情報提供目的のみです。投資判断は自己責任で行ってください。
**🤖 分析エージェント**: テクニカル分析・センチメント分析・リスク評価の統合判断
"""
        
        return recommendation

# Web interface helper functions
def create_web_interface():
    """Create a simple web interface for the trading assistant."""
    try:
        from flask import Flask, render_template, request, jsonify
        from flask_socketio import SocketIO
        
        app = Flask(__name__)
        app.config['SECRET_KEY'] = 'crypto_trading_assistant_2024'
        socketio = SocketIO(app, cors_allowed_origins="*")
        
        assistant = CryptoTradingAssistant()
        
        @app.route('/')
        def index():
            return render_template('crypto_analysis.html')
        
        @app.route('/dashboard')
        def dashboard():
            """Advanced dashboard interface."""
            return render_template('dashboard.html')
        
        @app.route('/mobile')
        def mobile():
            """Mobile-optimized interface."""
            return render_template('mobile.html')
        
        @app.route('/settings')
        def settings():
            """System settings page."""
            return render_template('settings.html')
        
        
        @app.route('/analyze', methods=['POST'])
        def analyze():
            try:
                data = request.get_json()
                symbol = data.get('symbol', 'bitcoin') if data else 'bitcoin'
                analysis = asyncio.run(assistant.analyze_cryptocurrency(symbol))
                return jsonify({'success': True, 'analysis': analysis})
            except Exception as e:
                return jsonify({'success': False, 'error': str(e)})
        
        @app.route('/api/status', methods=['GET'])
        def api_status():
            """Check API status endpoint."""
            return jsonify({
                'online': True,
                'services': {
                    'coingecko': requests is not None,
                    'news_feeds': feedparser is not None
                }
            })
        
        @app.route('/api/crypto-price/<crypto_id>', methods=['GET'])
        def get_crypto_price(crypto_id):
            """Get cryptocurrency price data."""
            try:
                crypto_data = assistant.data_aggregator.get_crypto_price(crypto_id)
                if crypto_data:
                    return jsonify({
                        'symbol': crypto_data.symbol,
                        'price_usd': crypto_data.price_usd,
                        'price_jpy': crypto_data.price_jpy,
                        'market_cap': crypto_data.market_cap,
                        'volume_24h': crypto_data.volume_24h,
                        'price_change_24h': crypto_data.price_change_24h,
                        'timestamp': crypto_data.timestamp.isoformat()
                    })
                else:
                    return jsonify({'error': 'Data not available'}), 404
            except Exception as e:
                return jsonify({'error': str(e)}), 500
        
        @app.route('/api/crypto-news', methods=['GET'])
        def get_crypto_news():
            """Get latest cryptocurrency news."""
            try:
                limit = request.args.get('limit', 10, type=int)
                news_items = assistant.data_aggregator.get_crypto_news(limit)
                
                news_data = []
                for item in news_items:
                    news_data.append({
                        'title': item.title,
                        'url': item.url,
                        'source': item.source,
                        'published': item.published.isoformat(),
                        'summary': item.summary
                    })
                
                return jsonify(news_data)
            except Exception as e:
                return jsonify({'error': str(e)}), 500
        
        return app, socketio
        
    except ImportError as e:
        logger.warning(f"Flask dependencies not available: {e}")
        logger.info("Install Flask dependencies with: pip install Flask Flask-SocketIO")
        return None, None

# CLI Interface
async def run_cli_interface():
    """Run command-line interface for the trading assistant."""
    assistant = CryptoTradingAssistant()
    
    print("🚀 Cryptocurrency Trading Assistant")
    print("=" * 50)
    print("Enter cryptocurrency symbols (e.g., bitcoin, ethereum, cardano)")
    print("Type 'quit' to exit")
    print()
    
    while True:
        try:
            symbol = input("📈 Enter crypto symbol: ").strip()
            
            if symbol.lower() in ['quit', 'exit', 'q']:
                print("👋 Goodbye!")
                break
            
            if not symbol:
                continue
            
            print(f"\n🔄 Analyzing {symbol.upper()}...")
            analysis = await assistant.analyze_cryptocurrency(symbol)
            print(analysis)
            print("\n" + "=" * 50 + "\n")
            
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Cryptocurrency Trading Assistant")
    parser.add_argument('--web', action='store_true', help='Run web interface')
    parser.add_argument('--symbol', type=str, help='Analyze specific cryptocurrency')
    args = parser.parse_args()
    
    if args.symbol:
        # Single analysis mode
        assistant = CryptoTradingAssistant()
        analysis = asyncio.run(assistant.analyze_cryptocurrency(args.symbol))
        print(analysis)
    elif args.web:
        # Web interface mode
        app, socketio = create_web_interface()
        if app and socketio:
            print("🌐 Starting web interface on http://localhost:8000")
            socketio.run(app, debug=True, host='0.0.0.0', port=8000, allow_unsafe_werkzeug=True)
        else:
            print("❌ Web interface not available. Install Flask and Flask-SocketIO.")
    else:
        # CLI mode
        asyncio.run(run_cli_interface())