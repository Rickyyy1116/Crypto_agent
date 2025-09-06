#!/usr/bin/env python3
"""
Cryptocurrency Trading Assistant Agent - Startup Script
Easy-to-use startup script with dependency checking and setup guidance.
"""

import sys
import os
import subprocess
import importlib
from typing import List, Tuple

def check_python_version() -> bool:
    """Check if Python version is 3.8 or higher."""
    version = sys.version_info
    if version.major == 3 and version.minor >= 8:
        print(f"✅ Python {version.major}.{version.minor}.{version.micro} - OK")
        return True
    else:
        print(f"❌ Python {version.major}.{version.minor}.{version.micro} - Version 3.8+ required")
        return False

def check_dependencies() -> List[Tuple[str, bool, str]]:
    """Check if required dependencies are installed."""
    required_deps = [
        ("requests", "API data fetching"),
        ("feedparser", "RSS news parsing"),
        ("flask", "Web interface"),
        ("flask_socketio", "Real-time web updates")
    ]
    
    optional_deps = [
        ("pandas", "Data analysis"),
        ("matplotlib", "Data visualization"), 
        ("numpy", "Numerical computations")
    ]
    
    all_deps = required_deps + optional_deps
    results = []
    
    print("\n📦 Checking Dependencies:")
    print("=" * 40)
    
    for dep_name, description in all_deps:
        try:
            importlib.import_module(dep_name.replace("-", "_"))
            print(f"✅ {dep_name:<15} - {description}")
            results.append((dep_name, True, description))
        except ImportError:
            is_required = dep_name in [d[0] for d in required_deps]
            status = "❌ REQUIRED" if is_required else "⚠️  OPTIONAL"
            print(f"{status} {dep_name:<15} - {description}")
            results.append((dep_name, False, description))
    
    return results

def install_dependencies() -> bool:
    """Install missing dependencies."""
    print("\n🔧 Installing Dependencies:")
    print("=" * 40)
    
    try:
        # Install basic requirements
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", 
            "requests", "feedparser", "flask", "flask-socketio",
            "--user"
        ])
        print("✅ Core dependencies installed successfully")
        
        # Try to install optional dependencies
        try:
            subprocess.check_call([
                sys.executable, "-m", "pip", "install",
                "pandas", "numpy", "matplotlib",
                "--user"
            ])
            print("✅ Optional dependencies installed successfully")
        except subprocess.CalledProcessError:
            print("⚠️  Some optional dependencies could not be installed")
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Installation failed: {e}")
        print("Please install dependencies manually:")
        print("pip install requests feedparser flask flask-socketio")
        return False

def create_directories():
    """Create necessary directories."""
    directories = ["data", "cache", "results", "logs"]
    
    print("\n📁 Creating Directories:")
    print("=" * 40)
    
    for directory in directories:
        try:
            os.makedirs(directory, exist_ok=True)
            print(f"✅ {directory}/")
        except Exception as e:
            print(f"❌ {directory}/ - Error: {e}")

def run_system_check():
    """Run comprehensive system check."""
    print("🚀 Cryptocurrency Trading Assistant Agent")
    print("=" * 50)
    print("System Check and Setup")
    print("=" * 50)
    
    # Check Python version
    if not check_python_version():
        print("\n❌ Python version check failed. Please install Python 3.8+")
        sys.exit(1)
    
    # Check dependencies
    deps_results = check_dependencies()
    missing_required = [dep for dep, installed, _ in deps_results if not installed and dep in ["requests", "feedparser", "flask", "flask_socketio"]]
    
    # Install missing dependencies if needed
    if missing_required:
        print(f"\n⚠️  Missing {len(missing_required)} required dependencies")
        
        install_choice = input("\nWould you like to install missing dependencies? (y/n): ").lower().strip()
        if install_choice in ['y', 'yes']:
            if not install_dependencies():
                sys.exit(1)
        else:
            print("❌ Cannot continue without required dependencies")
            sys.exit(1)
    
    # Create directories
    create_directories()
    
    print("\n✅ System check completed successfully!")
    return True

def show_usage_guide():
    """Show usage guide and options."""
    print("\n📖 Usage Options:")
    print("=" * 40)
    print("1. Command Line Interface:")
    print("   python crypto_trading_agent.py")
    print()
    print("2. Web Interface:")
    print("   python crypto_trading_agent.py --web")
    print("   Then open: http://localhost:5000")
    print()
    print("3. Single Analysis:")
    print("   python crypto_trading_agent.py --symbol bitcoin")
    print()
    print("4. Available Cryptocurrencies:")
    print("   bitcoin, ethereum, cardano, polygon, solana")
    print("   chainlink, polkadot, avalanche-2, uniswap, aave")
    print()

def main():
    """Main startup function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Cryptocurrency Trading Assistant Agent Startup")
    parser.add_argument('--check', action='store_true', help='Run system check only')
    parser.add_argument('--install', action='store_true', help='Install dependencies only')
    parser.add_argument('--run', choices=['cli', 'web'], help='Run specific interface')
    parser.add_argument('--symbol', type=str, help='Analyze specific cryptocurrency')
    args = parser.parse_args()
    
    # Run system check
    if not run_system_check():
        sys.exit(1)
    
    # If only checking or installing, exit here
    if args.check:
        print("\n✅ System check completed.")
        return
    
    if args.install:
        print("\n✅ Dependencies installation completed.")
        return
    
    # Show usage guide
    show_usage_guide()
    
    # Determine what to run
    if args.run or args.symbol:
        try:
            # Import the main application
            from crypto_trading_agent import CryptoTradingAssistant, create_web_interface, run_cli_interface
            import asyncio
            
            if args.symbol:
                # Single analysis
                print(f"\n🔍 Analyzing {args.symbol.upper()}...")
                assistant = CryptoTradingAssistant()
                analysis = asyncio.run(assistant.analyze_cryptocurrency(args.symbol))
                print(analysis)
                
            elif args.run == 'web':
                # Web interface
                app, socketio = create_web_interface()
                if app and socketio:
                    print("\n🌐 Starting web interface...")
                    print("Open your browser and go to: http://localhost:5000")
                    socketio.run(app, debug=False, host='0.0.0.0', port=5000)
                else:
                    print("❌ Web interface not available. Check Flask installation.")
                    
            elif args.run == 'cli':
                # CLI interface  
                print("\n💻 Starting command line interface...")
                asyncio.run(run_cli_interface())
                
        except ImportError as e:
            print(f"\n❌ Error importing application: {e}")
            print("Please ensure crypto_trading_agent.py is in the current directory")
            sys.exit(1)
        except Exception as e:
            print(f"\n❌ Error running application: {e}")
            sys.exit(1)
    else:
        # Interactive mode
        print("\n🎯 What would you like to do?")
        print("1. Start Web Interface")
        print("2. Start CLI Interface") 
        print("3. Analyze a specific cryptocurrency")
        print("4. Exit")
        
        while True:
            choice = input("\nEnter your choice (1-4): ").strip()
            
            if choice == '1':
                os.system(f"{sys.executable} {__file__} --run web")
                break
            elif choice == '2':
                os.system(f"{sys.executable} {__file__} --run cli")
                break
            elif choice == '3':
                symbol = input("Enter cryptocurrency symbol (e.g., bitcoin): ").strip()
                if symbol:
                    os.system(f"{sys.executable} {__file__} --symbol {symbol}")
                break
            elif choice == '4':
                print("👋 Goodbye!")
                break
            else:
                print("❌ Invalid choice. Please enter 1-4.")

if __name__ == "__main__":
    main()