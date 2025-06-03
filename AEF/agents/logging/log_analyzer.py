#!/usr/bin/env python3
"""
Log Analyzer CLI Tool

A command-line interface for analyzing and managing AEF agent execution logs.
Provides easy access to execution history, performance metrics, and comparisons.
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any

# Handle both standalone and module imports
try:
    from .enhanced_logging_system import EnhancedLogger
except ImportError:
    from enhanced_logging_system import EnhancedLogger


class LogAnalyzer:
    """CLI tool for analyzing agent execution logs."""
    
    def __init__(self, base_log_dir: str = "AEF/agents/execution_logs"):
        self.base_log_dir = Path(base_log_dir)
        
    def list_executions(self, limit: int = 10, show_details: bool = False):
        """List recent executions with summary information."""
        executions = EnhancedLogger.list_executions(str(self.base_log_dir))
        
        if not executions:
            print("📭 No executions found.")
            return
        
        print(f"\n📊 Found {len(executions)} executions (showing last {min(limit, len(executions))}):\n")
        
        for i, exec_data in enumerate(executions[:limit]):
            metadata = exec_data['metadata']
            
            # Status icon
            if metadata['status'] == 'running':
                status_icon = "🔄"
            elif metadata['success']:
                status_icon = "✅"
            else:
                status_icon = "❌"
            
            # Format duration
            duration = metadata.get('duration_seconds', 0)
            duration_str = f"{duration:.1f}s" if duration > 0 else "N/A"
            
            # Format start time
            start_time = datetime.fromisoformat(metadata['start_time'])
            time_str = start_time.strftime("%Y-%m-%d %H:%M:%S")
            
            print(f"{i+1:2d}. {status_icon} {exec_data['folder']}")
            print(f"    📅 {time_str} | ⏱️ {duration_str} | 📊 {metadata['steps_completed']} steps | 🪙 {metadata['total_tokens']:,} tokens")
            
            if show_details:
                task_preview = metadata['task_description'][:100]
                if len(metadata['task_description']) > 100:
                    task_preview += "..."
                print(f"    📝 {task_preview}")
                
                if metadata.get('error'):
                    print(f"    ❌ Error: {metadata['error'][:80]}...")
            
            print()
    
    def show_execution_details(self, execution_id: str):
        """Show detailed information about a specific execution."""
        execution_path = self.base_log_dir / execution_id
        
        if not execution_path.exists():
            print(f"❌ Execution not found: {execution_id}")
            return
        
        summary = EnhancedLogger.get_execution_summary(str(execution_path))
        
        if "error" in summary:
            print(f"❌ {summary['error']}")
            return
        
        metadata_path = execution_path / "execution_metadata.json"
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        print(f"\n📊 Execution Details: {execution_id}")
        print("=" * 60)
        
        # Basic info
        start_time = datetime.fromisoformat(metadata['start_time'])
        print(f"📅 Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        if metadata.get('end_time'):
            end_time = datetime.fromisoformat(metadata['end_time'])
            print(f"🏁 End Time: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        print(f"⏱️ Duration: {metadata['duration_seconds']:.1f} seconds")
        print(f"📊 Steps: {metadata['steps_completed']}")
        print(f"🪙 Tokens: {metadata['total_tokens']:,}")
        print(f"✅ Success: {metadata['success']}")
        print(f"📁 Status: {metadata['status']}")
        
        # Task description
        print(f"\n📝 Task Description:")
        print(f"{metadata['task_description']}")
        
        # Configuration
        if metadata.get('execution_config'):
            print(f"\n⚙️ Configuration:")
            for key, value in metadata['execution_config'].items():
                print(f"  • {key}: {value}")
        
        # Artifacts
        artifacts = metadata.get('artifacts', {})
        print(f"\n📦 Artifacts:")
        print(f"  • Conversation logs: {len(artifacts.get('conversation_logs', []))}")
        print(f"  • Screenshots: {len(artifacts.get('screenshots', []))}")
        print(f"  • GIF file: {'✅' if artifacts.get('gif_file') else '❌'}")
        
        # Error details
        if metadata.get('error'):
            print(f"\n❌ Error Details:")
            print(f"{metadata['error']}")
        
        # Final summary
        if artifacts.get('final_summary'):
            print(f"\n📋 Final Summary:")
            print(f"{artifacts['final_summary']}")
        
        print(f"\n📁 Full logs location: {execution_path}")
    
    def compare_executions(self, exec_id1: str, exec_id2: str):
        """Compare two executions side by side."""
        path1 = self.base_log_dir / exec_id1
        path2 = self.base_log_dir / exec_id2
        
        if not path1.exists():
            print(f"❌ Execution not found: {exec_id1}")
            return
        
        if not path2.exists():
            print(f"❌ Execution not found: {exec_id2}")
            return
        
        summary1 = EnhancedLogger.get_execution_summary(str(path1))
        summary2 = EnhancedLogger.get_execution_summary(str(path2))
        
        print(f"\n📊 Execution Comparison")
        print("=" * 60)
        print(f"{'Metric':<20} {'Execution 1':<25} {'Execution 2':<25}")
        print("-" * 70)
        
        metrics = [
            ("ID", exec_id1[:25], exec_id2[:25]),
            ("Start Time", summary1['start_time'][:19], summary2['start_time'][:19]),
            ("Duration", f"{summary1['duration']:.1f}s", f"{summary2['duration']:.1f}s"),
            ("Steps", str(summary1['steps']), str(summary2['steps'])),
            ("Tokens", f"{summary1['tokens']:,}", f"{summary2['tokens']:,}"),
            ("Success", "✅" if summary1['success'] else "❌", "✅" if summary2['success'] else "❌"),
            ("Logs", str(summary1['conversation_logs_count']), str(summary2['conversation_logs_count'])),
            ("Screenshots", str(summary1['screenshots_count']), str(summary2['screenshots_count']))
        ]
        
        for metric, val1, val2 in metrics:
            print(f"{metric:<20} {val1:<25} {val2:<25}")
        
        # Performance comparison
        if summary1['duration'] > 0 and summary2['duration'] > 0:
            print(f"\n📈 Performance Analysis:")
            
            # Speed comparison
            speed_diff = ((summary2['duration'] - summary1['duration']) / summary1['duration']) * 100
            if speed_diff > 0:
                print(f"  • Execution 2 was {speed_diff:.1f}% slower")
            else:
                print(f"  • Execution 2 was {abs(speed_diff):.1f}% faster")
            
            # Efficiency comparison
            eff1 = summary1['tokens'] / summary1['duration'] if summary1['duration'] > 0 else 0
            eff2 = summary2['tokens'] / summary2['duration'] if summary2['duration'] > 0 else 0
            
            print(f"  • Tokens per second: {eff1:.1f} vs {eff2:.1f}")
            
            # Steps comparison
            if summary1['steps'] != summary2['steps']:
                step_diff = summary2['steps'] - summary1['steps']
                print(f"  • Step difference: {step_diff:+d} steps")
    
    def cleanup_old_logs(self, days: int = 30, dry_run: bool = True):
        """Clean up old execution logs."""
        cutoff_date = datetime.now().timestamp() - (days * 24 * 60 * 60)
        
        executions = EnhancedLogger.list_executions(str(self.base_log_dir))
        old_executions = []
        
        for exec_data in executions:
            start_time = datetime.fromisoformat(exec_data['metadata']['start_time'])
            if start_time.timestamp() < cutoff_date:
                old_executions.append(exec_data)
        
        if not old_executions:
            print(f"✅ No executions older than {days} days found.")
            return
        
        print(f"🗑️ Found {len(old_executions)} executions older than {days} days:")
        
        for exec_data in old_executions:
            metadata = exec_data['metadata']
            start_time = datetime.fromisoformat(metadata['start_time'])
            print(f"  • {exec_data['folder']} ({start_time.strftime('%Y-%m-%d %H:%M:%S')})")
        
        if dry_run:
            print(f"\n🔍 This was a dry run. Use --no-dry-run to actually delete these logs.")
        else:
            import shutil
            for exec_data in old_executions:
                shutil.rmtree(exec_data['path'])
                print(f"🗑️ Deleted: {exec_data['folder']}")
            print(f"✅ Cleaned up {len(old_executions)} old executions.")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="AEF Agent Log Analyzer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python log_analyzer.py --list                    # List recent executions
  python log_analyzer.py --list --limit 20         # List last 20 executions
  python log_analyzer.py --details EXEC_ID         # Show execution details
  python log_analyzer.py --compare EXEC1 EXEC2     # Compare two executions
  python log_analyzer.py --cleanup --days 7        # Clean up logs older than 7 days
        """
    )
    
    parser.add_argument("--list", action="store_true", help="List recent executions")
    parser.add_argument("--limit", type=int, default=10, help="Limit number of executions to show")
    parser.add_argument("--details", type=str, help="Show details for specific execution ID")
    parser.add_argument("--compare", nargs=2, metavar=("EXEC1", "EXEC2"), help="Compare two executions")
    parser.add_argument("--cleanup", action="store_true", help="Clean up old logs")
    parser.add_argument("--days", type=int, default=30, help="Days threshold for cleanup")
    parser.add_argument("--no-dry-run", action="store_true", help="Actually perform cleanup (not just preview)")
    parser.add_argument("--verbose", action="store_true", help="Show detailed information")
    parser.add_argument("--log-dir", type=str, default="AEF/agents/execution_logs", help="Base log directory")
    
    args = parser.parse_args()
    
    if len(sys.argv) == 1:
        parser.print_help()
        return
    
    analyzer = LogAnalyzer(args.log_dir)
    
    try:
        if args.list:
            analyzer.list_executions(limit=args.limit, show_details=args.verbose)
        
        elif args.details:
            analyzer.show_execution_details(args.details)
        
        elif args.compare:
            analyzer.compare_executions(args.compare[0], args.compare[1])
        
        elif args.cleanup:
            analyzer.cleanup_old_logs(days=args.days, dry_run=not args.no_dry_run)
        
        else:
            parser.print_help()
    
    except KeyboardInterrupt:
        print("\n👋 Interrupted by user")
    except Exception as e:
        print(f"❌ Error: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    main() 