# 仮想通貨取引支援エージェント 🚀


> **多エージェント分析による総合的な仮想通貨投資判断支援システム**

このプロジェクトは、複数の専門エージェントが協力して仮想通貨の投資判断をサポートする、包括的な取引支援システムです。[TradingAgents-crypto](https://github.com/hollowtimTW/TradingAgents-crypto)の多エージェントアーキテクチャと、日米の仮想通貨情報源を組み合わせて構築されています。

## ✨ 特徴

### 🤖 多エージェント分析システム
- **テクニカル分析エージェント**: 価格動向、テクニカル指標、ボリューム分析
- **センチメント分析エージェント**: ニュース、ソーシャルメディアの感情分析
- **リスク評価エージェント**: ボラティリティ、市場規模、流動性リスクの評価

### 🌐 包括的データソース
- **CoinGecko API**: リアルタイム価格、時価総額、取引量データ
- **世界のニュースRSS**: Cointelegraph、Bitcoinist、NewsBTC等
- **日本語ニュース対応**: CoinDesk Japan、コインテレグラフ ジャパン
- **多通貨対応**: USD、JPY価格表示

### 💻 使いやすいインターface
- **Webインターface**: 美しいダーク/ライトモード切り替え
- **リアルタイム更新**: SocketIOによるライブ分析状況表示
- **CLIインターface**: コマンドライン愛好者向け
- **結果エクスポート**: PDF、HTML、テキスト形式での出力

## 🚀 クイックスタート

### 前提条件
- Python 3.8 以上
- インターネット接続（API呼び出し用）

### 1. 簡単セットアップ（推奨）

```bash
# スタートアップスクリプトを実行（依存関係の自動チェック・インストール）
python start_crypto_agent.py
```

### 2. 手動セットアップ

```bash
# 依存関係のインストール
pip install -r requirements.txt

# ディレクトリ作成
mkdir data cache results logs

# システムチェック
python start_crypto_agent.py --check
```

### 3. 実行方法

#### Webインターface（推奨）
```bash
python crypto_trading_agent.py --web
# ブラウザで http://localhost:5000 を開く
```

#### 利用可能なUIモード
- **基本インターface**: http://localhost:5000/
- **高機能ダッシュボード**: http://localhost:5000/dashboard
- **モバイル最適化UI**: http://localhost:5000/mobile

#### コマンドラインインターface
```bash
python crypto_trading_agent.py
```

#### 単発分析
```bash
python crypto_trading_agent.py --symbol bitcoin
```

## 📊 対応仮想通貨

| シンボル | 名称 | CoinGecko ID |
|---------|------|--------------|
| BTC | Bitcoin | bitcoin |
| ETH | Ethereum | ethereum |
| ADA | Cardano | cardano |
| MATIC | Polygon | polygon |
| SOL | Solana | solana |
| LINK | Chainlink | chainlink |
| DOT | Polkadot | polkadot |
| AVAX | Avalanche | avalanche-2 |
| UNI | Uniswap | uniswap |
| AAVE | Aave | aave |

*その他のCoinGecko対応通貨も、IDを直接入力することで分析可能*

## 🎯 使用例

### Webインターface
1. ブラウザでアクセス
2. 仮想通貨を選択（例: Bitcoin）
3. 分析エージェントを選択
4. 「分析開始」をクリック
5. リアルタイムで分析結果を確認
6. 必要に応じて結果をエクスポート

### プログラム的な使用
```python
from crypto_trading_agent import CryptoTradingAssistant
import asyncio

# エージェントの初期化
assistant = CryptoTradingAssistant()

# ビットコインの分析
analysis = await assistant.analyze_cryptocurrency("bitcoin")
print(analysis)
```

## 🛡️ リスク管理機能

### ボラティリティ分析
- **低リスク**: 24時間変動率 < 2%
- **中リスク**: 24時間変動率 2-5%
- **高リスク**: 24時間変動率 > 5%

### 市場規模分類
- **大型株**: 時価総額 > 1,000億USD
- **中型株**: 時価総額 100-1,000億USD
- **小型株**: 時価総額 < 100億USD

## ⚠️ 免責事項

**重要**: このシステムは教育・研究目的で作成されています。投資判断は自己責任で行ってください。

- 分析結果は投資アドバイスではありません
- 市場の変動により損失が生じる可能性があります
- 投資前に十分なリサーチを行ってください

## 📝 ライセンス

このプロジェクトは MIT License の下で公開されています。

---

**📞 サポート**: Issues ページでお気軽にお問い合わせください
**🌟 Star us**: このプロジェクトが役立ったら、ぜひスターをお願いします！