#!/usr/bin/env python3
"""
🎥 Standalone Timeline Viewer

A simple, always-on web interface to view all captured visual monitoring timelines.
Runs independently of any automation - just browse your results!
"""

import os
import json
import base64
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

app = FastAPI(title="Visual Timeline Viewer", description="Browse your automation timelines")

# Base path for screenshots
SCREENSHOTS_BASE = Path(__file__).parent / "screenshots"

# Mount screenshots directory as static files
if SCREENSHOTS_BASE.exists():
    app.mount("/screenshots", StaticFiles(directory=str(SCREENSHOTS_BASE)), name="screenshots")

def get_all_timelines() -> List[Dict[str, Any]]:
    """Get all available timeline exports"""
    timelines = []
    
    if not SCREENSHOTS_BASE.exists():
        return timelines
    
    for agent_dir in SCREENSHOTS_BASE.iterdir():
        if agent_dir.is_dir():
            for file in agent_dir.glob("timeline_export_*.json"):
                try:
                    with open(file, 'r') as f:
                        data = json.load(f)
                    
                    timelines.append({
                        "agent_id": data.get("agent_id", "unknown"),
                        "export_time": data.get("export_time", "unknown"),
                        "timeline_length": data.get("timeline_length", 0),
                        "file_path": str(file),
                        "file_name": file.name,
                        "browser_use_integration": data.get("browser_use_integration", False),
                        "summary": {
                            "total_screenshots": len([s for s in data.get("timeline", []) if s.get("screenshot_available")]),
                            "total_actions": len([s for s in data.get("timeline", []) if s.get("action")]),
                            "unique_urls": list(set(s.get("url", "") for s in data.get("timeline", []))),
                            "duration_minutes": calculate_duration(data.get("timeline", []))
                        }
                    })
                except Exception as e:
                    print(f"Error reading {file}: {e}")
    
    # Sort by export time (newest first)
    timelines.sort(key=lambda x: x["export_time"], reverse=True)
    return timelines

def calculate_duration(timeline: List[Dict]) -> float:
    """Calculate timeline duration in minutes"""
    if len(timeline) < 2:
        return 0
    
    try:
        start = datetime.fromisoformat(timeline[0]["timestamp"].replace('Z', '+00:00'))
        end = datetime.fromisoformat(timeline[-1]["timestamp"].replace('Z', '+00:00'))
        return (end - start).total_seconds() / 60
    except:
        return 0

def find_screenshot_file(agent_id: str, state_id: str) -> str:
    """Find screenshot file for a given state_id, handling data consistency issues"""
    # First try the agent's own directory
    agent_dir = SCREENSHOTS_BASE / agent_id
    if agent_dir.exists():
        screenshot_file = agent_dir / f"screenshot_{state_id}.png"
        if screenshot_file.exists():
            return f"/screenshots/{agent_id}/screenshot_{state_id}.png"
    
    # If not found, search all directories (handle data consistency issues)
    for agent_dir in SCREENSHOTS_BASE.iterdir():
        if agent_dir.is_dir():
            screenshot_file = agent_dir / f"screenshot_{state_id}.png"
            if screenshot_file.exists():
                return f"/screenshots/{agent_dir.name}/screenshot_{state_id}.png"
    
    return None

@app.get("/api/screenshot/{agent_id}/{state_id}")
async def get_screenshot(agent_id: str, state_id: str):
    """Get screenshot for a specific state"""
    screenshot_path = find_screenshot_file(agent_id, state_id)
    if not screenshot_path:
        raise HTTPException(status_code=404, detail="Screenshot not found")
    
    # Convert to file system path
    file_path = SCREENSHOTS_BASE / screenshot_path.replace("/screenshots/", "")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Screenshot file not found")
    
    return FileResponse(file_path, media_type="image/png")

@app.get("/api/screenshot-url/{agent_id}/{state_id}")
async def get_screenshot_url(agent_id: str, state_id: str):
    """Get screenshot URL for a specific state"""
    screenshot_path = find_screenshot_file(agent_id, state_id)
    if not screenshot_path:
        return {"url": None, "available": False}
    
    return {"url": screenshot_path, "available": True}

@app.get("/", response_class=HTMLResponse)
async def timeline_browser():
    """Main timeline browser page"""
    return HTMLResponse(content="""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎥 Visual Timeline Viewer</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            min-height: 100vh;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .header p {
            font-size: 1.2em;
            opacity: 0.8;
        }

        .timeline-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
            gap: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }

        .timeline-card {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            cursor: pointer;
        }

        .timeline-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .agent-id {
            font-size: 0.9em;
            background: rgba(76, 175, 80, 0.3);
            padding: 4px 8px;
            border-radius: 4px;
            font-family: monospace;
        }

        .export-time {
            font-size: 0.8em;
            opacity: 0.7;
        }

        .stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 15px;
        }

        .stat {
            background: rgba(0, 0, 0, 0.2);
            padding: 10px;
            border-radius: 6px;
            text-align: center;
        }

        .stat-value {
            font-size: 1.5em;
            font-weight: bold;
            color: #4CAF50;
        }

        .stat-label {
            font-size: 0.8em;
            opacity: 0.8;
        }

        .urls {
            margin-top: 15px;
        }

        .urls h4 {
            margin-bottom: 8px;
            font-size: 0.9em;
        }

        .url-list {
            max-height: 100px;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.2);
            padding: 8px;
            border-radius: 4px;
        }

        .url-item {
            font-size: 0.8em;
            margin-bottom: 4px;
            opacity: 0.9;
            word-break: break-all;
        }

        .browser-use-badge {
            background: #2196F3;
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.7em;
            font-weight: bold;
        }

        .no-timelines {
            text-align: center;
            padding: 60px 20px;
            opacity: 0.7;
        }

        .refresh-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
        }

        .refresh-btn:hover {
            background: #45a049;
        }
    </style>
</head>
<body>
    <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
    
    <div class="header">
        <h1>🎥 Visual Timeline Viewer</h1>
        <p>Browse all your automation timelines and screenshots</p>
    </div>

    <div class="timeline-grid" id="timelineGrid">
        <div class="no-timelines">
            <h3>Loading timelines...</h3>
        </div>
    </div>

    <script>
        async function loadTimelines() {
            try {
                const response = await fetch('/api/timelines');
                const timelines = await response.json();
                
                const grid = document.getElementById('timelineGrid');
                
                if (timelines.length === 0) {
                    grid.innerHTML = `
                        <div class="no-timelines">
                            <h3>No timelines found</h3>
                            <p>Run some automation demos to see timelines here!</p>
                        </div>
                    `;
                    return;
                }
                
                grid.innerHTML = timelines.map(timeline => `
                    <div class="timeline-card" onclick="viewTimeline('${timeline.file_name}')">
                        <div class="card-header">
                            <div class="agent-id">${timeline.agent_id.substring(0, 8)}...</div>
                            <div class="export-time">${formatTime(timeline.export_time)}</div>
                        </div>
                        
                        ${timeline.browser_use_integration ? '<span class="browser-use-badge">BROWSER-USE</span>' : ''}
                        
                        <div class="stats">
                            <div class="stat">
                                <div class="stat-value">${timeline.timeline_length}</div>
                                <div class="stat-label">States</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value">${timeline.summary.total_screenshots}</div>
                                <div class="stat-label">Screenshots</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value">${timeline.summary.total_actions}</div>
                                <div class="stat-label">Actions</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value">${timeline.summary.duration_minutes.toFixed(1)}m</div>
                                <div class="stat-label">Duration</div>
                            </div>
                        </div>
                        
                        <div class="urls">
                            <h4>Websites Visited (${timeline.summary.unique_urls.length}):</h4>
                            <div class="url-list">
                                ${timeline.summary.unique_urls.slice(0, 5).map(url => 
                                    `<div class="url-item">${url}</div>`
                                ).join('')}
                                ${timeline.summary.unique_urls.length > 5 ? 
                                    `<div class="url-item">... and ${timeline.summary.unique_urls.length - 5} more</div>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('');
                
            } catch (error) {
                console.error('Failed to load timelines:', error);
                document.getElementById('timelineGrid').innerHTML = `
                    <div class="no-timelines">
                        <h3>Error loading timelines</h3>
                        <p>${error.message}</p>
                    </div>
                `;
            }
        }
        
        function formatTime(isoString) {
            try {
                return new Date(isoString).toLocaleString();
            } catch {
                return isoString;
            }
        }
        
        function viewTimeline(fileName) {
            window.open(`/timeline/${fileName}`, '_blank');
        }
        
        // Load timelines on page load
        loadTimelines();
        
        // Auto-refresh every 30 seconds
        setInterval(loadTimelines, 30000);
    </script>
</body>
</html>
    """)

@app.get("/api/timelines")
async def get_timelines():
    """API endpoint to get all timelines"""
    return get_all_timelines()

@app.get("/timeline/{file_name}")
async def view_timeline(file_name: str):
    """View a specific timeline"""
    # Find the timeline file
    timeline_file = None
    for agent_dir in SCREENSHOTS_BASE.iterdir():
        if agent_dir.is_dir():
            potential_file = agent_dir / file_name
            if potential_file.exists():
                timeline_file = potential_file
                break
    
    if not timeline_file:
        raise HTTPException(status_code=404, detail="Timeline not found")
    
    # Load timeline data
    with open(timeline_file, 'r') as f:
        timeline_data = json.load(f)
    
    return HTMLResponse(content=f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Timeline: {timeline_data.get('agent_id', 'Unknown')}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            min-height: 100vh;
        }}

        .header {{
            background: rgba(0, 0, 0, 0.3);
            padding: 20px;
            border-bottom: 2px solid rgba(255, 255, 255, 0.1);
        }}

        .back-btn {{
            background: #4CAF50;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-bottom: 15px;
        }}

        .timeline-container {{
            display: flex;
            height: calc(100vh - 120px);
        }}

        .timeline-list {{
            width: 300px;
            background: rgba(0, 0, 0, 0.4);
            overflow-y: auto;
            padding: 20px;
        }}

        .timeline-item {{
            background: rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: background 0.2s ease;
        }}

        .timeline-item:hover {{
            background: rgba(255, 255, 255, 0.2);
        }}

        .timeline-item.active {{
            background: rgba(76, 175, 80, 0.3);
            border-left: 4px solid #4CAF50;
        }}

        .item-time {{
            font-size: 11px;
            opacity: 0.7;
            margin-bottom: 5px;
        }}

        .item-action {{
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 3px;
        }}

        .item-url {{
            font-size: 11px;
            opacity: 0.8;
            word-break: break-all;
        }}

        .item-elements {{
            font-size: 10px;
            color: #4CAF50;
            margin-top: 3px;
        }}

        .content-area {{
            flex: 1;
            padding: 20px;
            overflow-y: auto;
        }}

        .state-info {{
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }}

        .state-url {{
            font-size: 16px;
            color: #4CAF50;
            margin-bottom: 10px;
            word-break: break-all;
        }}

        .state-title {{
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
        }}

        .state-meta {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }}

        .meta-item {{
            background: rgba(0, 0, 0, 0.2);
            padding: 10px;
            border-radius: 6px;
        }}

        .meta-label {{
            font-size: 12px;
            opacity: 0.7;
            margin-bottom: 5px;
        }}

        .meta-value {{
            font-size: 14px;
            font-weight: bold;
        }}

        .action-info {{
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }}

        .action-type {{
            display: inline-block;
            background: #2196F3;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 10px;
        }}

        .action-type.navigate {{ background: #4CAF50; }}
        .action-type.click {{ background: #f44336; }}
        .action-type.type {{ background: #2196F3; }}

        .no-selection {{
            text-align: center;
            padding: 60px 20px;
            opacity: 0.7;
        }}

        .screenshot-container {{
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }}

        .screenshot-img {{
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            border: 2px solid rgba(255, 255, 255, 0.2);
            background: rgba(0, 0, 0, 0.3);
        }}

        .screenshot-error {{
            text-align: center;
            padding: 40px;
            background: rgba(255, 0, 0, 0.1);
            border-radius: 6px;
            color: #ff6b6b;
        }}

        .screenshot-loading {{
            text-align: center;
            padding: 40px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 6px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <button class="back-btn" onclick="window.close()">← Back to Timeline Browser</button>
        <h1>Timeline: {timeline_data.get('agent_id', 'Unknown')[:16]}...</h1>
        <p>Exported: {timeline_data.get('export_time', 'Unknown')} | {timeline_data.get('timeline_length', 0)} states | Browser-Use: {'Yes' if timeline_data.get('browser_use_integration') else 'No'}</p>
    </div>

    <div class="timeline-container">
        <div class="timeline-list" id="timelineList">
            <!-- Timeline items will be populated by JavaScript -->
        </div>
        
        <div class="content-area" id="contentArea">
            <div class="no-selection">
                <h3>Select a timeline state to view details</h3>
                <p>Click on any item in the timeline to see the browser state and action details</p>
            </div>
        </div>
    </div>

    <script>
        const timelineData = {json.dumps(timeline_data.get('timeline', []))};
        const agentId = '{timeline_data.get('agent_id', 'unknown')}';
        let currentIndex = -1;

        function populateTimeline() {{
            const listElement = document.getElementById('timelineList');
            
            listElement.innerHTML = timelineData.map((item, index) => `
                <div class="timeline-item" onclick="selectState(${{index}})">
                    <div class="item-time">${{formatTime(item.timestamp)}}</div>
                    <div class="item-action">
                        ${{item.action ? item.action.description : 'State capture'}}
                    </div>
                    <div class="item-url">${{item.url}}</div>
                    <div class="item-elements">${{item.clickable_elements_count || 0}} interactive elements</div>
                </div>
            `).join('');
        }}

        async function loadScreenshot(stateId) {{
            try {{
                const response = await fetch(`/api/screenshot-url/${{agentId}}/${{stateId}}`);
                const data = await response.json();
                
                if (data.available && data.url) {{
                    return `
                        <div class="screenshot-container">
                            <h4>📸 Browser Screenshot</h4>
                            <img src="${{data.url}}" alt="Browser screenshot" class="screenshot-img" 
                                 onerror="this.parentElement.innerHTML='<div class=\\"screenshot-error\\">❌ Failed to load screenshot</div>'" />
                        </div>
                    `;
                }} else {{
                    return `
                        <div class="screenshot-container">
                            <div class="screenshot-error">📷 No screenshot available for this state</div>
                        </div>
                    `;
                }}
            }} catch (error) {{
                console.error('Error loading screenshot:', error);
                return `
                    <div class="screenshot-container">
                        <div class="screenshot-error">❌ Error loading screenshot: ${{error.message}}</div>
                    </div>
                `;
            }}
        }}

        async function selectState(index) {{
            currentIndex = index;
            const state = timelineData[index];
            
            // Update active state in timeline
            document.querySelectorAll('.timeline-item').forEach((item, i) => {{
                item.classList.toggle('active', i === index);
            }});
            
            // Show loading state
            const contentArea = document.getElementById('contentArea');
            contentArea.innerHTML = `
                <div class="state-info">
                    <div class="state-url">${{state.url}}</div>
                    <div class="state-title">${{state.page_title || 'No title'}}</div>
                    
                    <div class="state-meta">
                        <div class="meta-item">
                            <div class="meta-label">Timestamp</div>
                            <div class="meta-value">${{formatTime(state.timestamp)}}</div>
                        </div>
                        <div class="meta-item">
                            <div class="meta-label">Interactive Elements</div>
                            <div class="meta-value">${{state.clickable_elements_count || 0}}</div>
                        </div>
                        <div class="meta-item">
                            <div class="meta-label">Screenshot</div>
                            <div class="meta-value">${{state.screenshot_available ? '✅ Available' : '❌ Not available'}}</div>
                        </div>
                        <div class="meta-item">
                            <div class="meta-label">Browser Tabs</div>
                            <div class="meta-value">${{state.browser_context ? state.browser_context.tabs_count : 'Unknown'}}</div>
                        </div>
                    </div>
                </div>
                
                <div class="screenshot-loading">
                    <h4>📸 Loading screenshot...</h4>
                </div>
                
                ${{state.action ? `
                    <div class="action-info">
                        <div class="action-type ${{state.action.action_type}}">${{state.action.action_type.toUpperCase()}}</div>
                        <div style="margin-bottom: 10px;"><strong>Description:</strong> ${{state.action.description}}</div>
                        <div style="margin-bottom: 10px;"><strong>Success:</strong> ${{state.action.success ? '✅ Yes' : '❌ No'}}</div>
                        <div style="margin-bottom: 10px;"><strong>Duration:</strong> ${{state.action.duration}}s</div>
                        ${{state.action.input_value ? `<div style="margin-bottom: 10px;"><strong>Input:</strong> ${{state.action.input_value}}</div>` : ''}}
                        ${{state.action.element_index !== null ? `<div style="margin-bottom: 10px;"><strong>Element Index:</strong> ${{state.action.element_index}}</div>` : ''}}
                        ${{state.action.error_message ? `<div style="color: #f44336;"><strong>Error:</strong> ${{state.action.error_message}}</div>` : ''}}
                    </div>
                ` : ''}}
            `;
            
            // Load screenshot asynchronously
            if (state.screenshot_available) {{
                const screenshotHtml = await loadScreenshot(state.state_id);
                const loadingElement = contentArea.querySelector('.screenshot-loading');
                if (loadingElement) {{
                    loadingElement.outerHTML = screenshotHtml;
                }}
            }} else {{
                const loadingElement = contentArea.querySelector('.screenshot-loading');
                if (loadingElement) {{
                    loadingElement.outerHTML = `
                        <div class="screenshot-container">
                            <div class="screenshot-error">📷 No screenshot captured for this state</div>
                        </div>
                    `;
                }}
            }}
        }}

        function formatTime(isoString) {{
            try {{
                return new Date(isoString).toLocaleTimeString();
            }} catch {{
                return isoString;
            }}
        }}

        // Initialize
        populateTimeline();
    </script>
</body>
</html>
    """)

def main():
    """Run the standalone timeline viewer"""
    print("🎥 Starting Visual Timeline Viewer...")
    print("📁 Looking for timelines in:", SCREENSHOTS_BASE)
    
    timelines = get_all_timelines()
    print(f"📊 Found {len(timelines)} timeline(s)")
    
    print("\n🌐 Starting web server...")
    print("   Timeline Viewer: http://localhost:8084")
    print("   Press Ctrl+C to stop")
    
    uvicorn.run(app, host="localhost", port=8084, log_level="info")

if __name__ == "__main__":
    main() 