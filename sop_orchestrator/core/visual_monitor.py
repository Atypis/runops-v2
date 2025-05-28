"""
🎥 Visual Browser Monitoring - Core Implementation

Provides the "Time Machine" functionality for agent actions:
- Screenshot timeline with automatic capture
- Action annotation and overlay system
- Interactive timeline for scrubbing through history
- Evidence capture and export capabilities
- REAL browser-use integration with built-in highlighting
"""

import asyncio
import base64
import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import structlog

try:
    from PIL import Image, ImageDraw, ImageFont
    import io
except ImportError:
    # Fallback for systems without PIL
    Image = ImageDraw = ImageFont = None

logger = structlog.get_logger(__name__)


class ActionType(Enum):
    CLICK = "click"
    TYPE = "type"
    SCROLL = "scroll"
    NAVIGATE = "navigate"
    WAIT = "wait"
    SCREENSHOT = "screenshot"
    EXTRACT = "extract"
    VERIFY = "verify"


@dataclass
class ActionDetail:
    """Detailed action information for timeline"""
    action_id: str
    action_type: ActionType
    element_selector: Optional[str]
    element_text: Optional[str]
    coordinates: Optional[tuple]
    description: str
    input_value: Optional[str] = None
    success: bool = True
    error_message: Optional[str] = None
    duration: float = 0.0
    element_index: Optional[int] = None  # Browser-use element index
    dom_context: Optional[Dict[str, Any]] = None  # Rich DOM context


@dataclass
class TimelineState:
    """Complete state capture at a point in time"""
    timestamp: datetime
    state_id: str
    url: str
    screenshot_path: str
    screenshot_base64: Optional[str]
    action: Optional[ActionDetail]
    dom_elements: List[Dict[str, Any]]
    page_title: str
    agent_id: str
    mission_context: Dict[str, Any]
    annotated_screenshot_path: Optional[str] = None
    # Browser-use specific data
    clickable_elements: Optional[Dict[str, Any]] = None
    selector_map: Optional[Dict[str, Any]] = None
    browser_state: Optional[Dict[str, Any]] = None


class VisualMonitor:
    """
    Core visual monitoring system - the "Time Machine" for agent actions
    Enhanced with real browser-use integration
    """
    
    def __init__(self, browser_session=None, agent_id: str = None):
        self.browser_session = browser_session
        self.agent_id = agent_id or str(uuid.uuid4())
        
        # Timeline storage
        self.timeline: List[TimelineState] = []
        self.current_index = 0
        
        # Configuration
        self.screenshot_interval = 3.0  # Slightly longer for real browser
        self.max_timeline_length = 1000
        self.auto_capture = True
        
        # Storage paths
        self.base_path = Path(__file__).parent.parent / "screenshots" / self.agent_id
        self.base_path.mkdir(parents=True, exist_ok=True)
        
        # Callbacks for real-time updates
        self.timeline_callback: Optional[Callable] = None
        self.evidence_callback: Optional[Callable] = None
        
        # Background capture task
        self._capture_task: Optional[asyncio.Task] = None
        self._is_running = False
        
        logger.info("Visual monitor initialized with real browser-use integration", agent_id=self.agent_id)
    
    async def start_monitoring(self):
        """Start automatic screenshot capture"""
        if self._is_running:
            return
        
        self._is_running = True
        self._capture_task = asyncio.create_task(self._background_capture())
        logger.info("Visual monitoring started", agent_id=self.agent_id)
    
    async def stop_monitoring(self):
        """Stop automatic screenshot capture"""
        self._is_running = False
        if self._capture_task:
            self._capture_task.cancel()
            try:
                await self._capture_task
            except asyncio.CancelledError:
                pass
        logger.info("Visual monitoring stopped", agent_id=self.agent_id)
    
    async def _background_capture(self):
        """Background task for automatic screenshot capture"""
        while self._is_running:
            try:
                if self.browser_session:
                    await self.capture_state("auto_capture")
                await asyncio.sleep(self.screenshot_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Background capture error", error=str(e))
                await asyncio.sleep(2)
    
    async def capture_state(self, action_context: str = None) -> TimelineState:
        """Capture current browser state with real browser-use screenshot"""
        try:
            state_id = str(uuid.uuid4())
            timestamp = datetime.utcnow()
            
            # Initialize defaults
            screenshot_data = None
            screenshot_path = None
            url = "unknown"
            page_title = "unknown"
            dom_elements = []
            clickable_elements = None
            selector_map = None
            browser_state = None
            
            if self.browser_session:
                try:
                    # Wait for page to be ready before capturing
                    await self._wait_for_page_ready()
                    
                    # Get browser-use state summary with highlights
                    logger.debug("Getting browser state summary...")
                    state_summary = await self.browser_session.get_state_summary(cache_clickable_elements_hashes=True)
                    
                    # Extract rich data from browser-use
                    url = state_summary.url
                    page_title = state_summary.title
                    screenshot_data = state_summary.screenshot  # Already has highlights!
                    
                    # Validate screenshot data
                    if not screenshot_data or len(screenshot_data) < 1000:  # Too small to be a real screenshot
                        logger.warning("Screenshot data too small, attempting fallback capture")
                        screenshot_data = await self._fallback_screenshot_capture()
                    
                    # Get clickable elements with their indices
                    if hasattr(state_summary, 'selector_map') and state_summary.selector_map:
                        selector_map = {
                            str(k): {
                                "xpath": v.xpath,
                                "tag_name": getattr(v, 'tag_name', 'unknown'),
                                "attributes": getattr(v, 'attributes', {}),
                                "highlight_index": getattr(v, 'highlight_index', None)
                            }
                            for k, v in state_summary.selector_map.items()
                        }
                    
                    # Get clickable elements text representation
                    if hasattr(state_summary, 'element_tree') and state_summary.element_tree:
                        clickable_elements = {
                            "elements_text": state_summary.element_tree.clickable_elements_to_string(),
                            "total_elements": len(state_summary.selector_map) if state_summary.selector_map else 0
                        }
                    
                    # Store full browser state for debugging
                    browser_state = {
                        "tabs": [{"url": tab.url, "title": tab.title} for tab in state_summary.tabs] if state_summary.tabs else [],
                        "pixels_above": getattr(state_summary, 'pixels_above', 0),
                        "pixels_below": getattr(state_summary, 'pixels_below', 0)
                    }
                    
                    # Save screenshot to disk
                    if screenshot_data:
                        screenshot_path = await self._save_screenshot(screenshot_data, state_id)
                        
                        # Verify the saved screenshot is valid
                        if screenshot_path and not await self._verify_screenshot_quality(screenshot_path):
                            logger.warning("Screenshot quality check failed, retrying...")
                            # Wait a bit and try again
                            await asyncio.sleep(1)
                            screenshot_data = await self._fallback_screenshot_capture()
                            if screenshot_data:
                                screenshot_path = await self._save_screenshot(screenshot_data, state_id)
                    
                    logger.debug(f"Captured browser state: {url}, elements: {len(selector_map) if selector_map else 0}")
                    
                except Exception as e:
                    logger.warning("Browser capture failed", error=str(e))
                    # Fallback to basic info
                    try:
                        if hasattr(self.browser_session, 'agent_current_page') and self.browser_session.agent_current_page:
                            page = self.browser_session.agent_current_page
                            url = page.url
                            page_title = await page.title()
                            
                            # Take basic screenshot as fallback
                            screenshot_bytes = await page.screenshot()
                            screenshot_data = base64.b64encode(screenshot_bytes).decode('utf-8')
                            screenshot_path = await self._save_screenshot(screenshot_data, state_id)
                    except Exception as e2:
                        logger.error("Fallback capture also failed", error=str(e2))
            
            # Create timeline state
            state = TimelineState(
                timestamp=timestamp,
                state_id=state_id,
                url=url,
                screenshot_path=screenshot_path or "",
                screenshot_base64=screenshot_data,
                action=None,  # Will be set by annotate_action
                dom_elements=dom_elements,
                page_title=page_title,
                agent_id=self.agent_id,
                mission_context={"context": action_context or "state_capture"},
                clickable_elements=clickable_elements,
                selector_map=selector_map,
                browser_state=browser_state
            )
            
            # Add to timeline
            self.timeline.append(state)
            self.current_index = len(self.timeline) - 1
            
            # Cleanup old states if needed
            if len(self.timeline) > self.max_timeline_length:
                old_state = self.timeline.pop(0)
                await self._cleanup_state_files(old_state)
            
            # Notify callbacks
            if self.timeline_callback:
                await self.timeline_callback(state)
            
            logger.debug("State captured", state_id=state_id, url=url, elements=len(selector_map) if selector_map else 0)
            return state
            
        except Exception as e:
            logger.error("State capture failed", error=str(e))
            raise
    
    async def _wait_for_page_ready(self):
        """Wait for page to be fully loaded before capturing"""
        if not self.browser_session or not hasattr(self.browser_session, 'agent_current_page'):
            return
        
        try:
            page = self.browser_session.agent_current_page
            if page:
                # Wait for network to be idle
                await page.wait_for_load_state('networkidle', timeout=5000)
                # Additional small delay for rendering
                await asyncio.sleep(0.5)
        except Exception as e:
            logger.debug("Page ready wait failed, continuing anyway", error=str(e))

    async def _fallback_screenshot_capture(self) -> Optional[str]:
        """Fallback screenshot capture method"""
        try:
            if hasattr(self.browser_session, 'agent_current_page') and self.browser_session.agent_current_page:
                page = self.browser_session.agent_current_page
                
                # Wait a bit for page to settle
                await asyncio.sleep(1)
                
                # Take screenshot directly from page
                screenshot_bytes = await page.screenshot(full_page=True)
                return base64.b64encode(screenshot_bytes).decode('utf-8')
        except Exception as e:
            logger.error("Fallback screenshot capture failed", error=str(e))
        
        return None

    async def _verify_screenshot_quality(self, screenshot_path: str) -> bool:
        """Verify that the screenshot is of good quality (not 1x1 pixel)"""
        try:
            if not screenshot_path or not Path(screenshot_path).exists():
                return False
            
            # Check file size - should be more than 1KB for a real screenshot
            file_size = Path(screenshot_path).stat().st_size
            if file_size < 1024:  # Less than 1KB is suspicious
                logger.warning(f"Screenshot file too small: {file_size} bytes")
                return False
            
            # If PIL is available, check image dimensions
            if Image:
                try:
                    with Image.open(screenshot_path) as img:
                        width, height = img.size
                        if width <= 1 or height <= 1:
                            logger.warning(f"Screenshot dimensions too small: {width}x{height}")
                            return False
                        if width < 100 or height < 100:  # Suspiciously small
                            logger.warning(f"Screenshot dimensions suspicious: {width}x{height}")
                            return False
                except Exception as e:
                    logger.warning("Could not verify image dimensions", error=str(e))
            
            return True
        except Exception as e:
            logger.error("Screenshot quality verification failed", error=str(e))
            return False
    
    async def annotate_action(
        self,
        action_type: ActionType,
        element_selector: str = None,
        element_text: str = None,
        coordinates: tuple = None,
        description: str = "",
        input_value: str = None,
        success: bool = True,
        error_message: str = None,
        duration: float = 0.0,
        element_index: int = None,
        dom_context: Dict[str, Any] = None
    ) -> str:
        """Annotate the last captured state with action details"""
        
        if not self.timeline:
            await self.capture_state("before_action")
        
        # Create action detail with browser-use context
        action = ActionDetail(
            action_id=str(uuid.uuid4()),
            action_type=action_type,
            element_selector=element_selector,
            element_text=element_text,
            coordinates=coordinates,
            description=description,
            input_value=input_value,
            success=success,
            error_message=error_message,
            duration=duration,
            element_index=element_index,
            dom_context=dom_context
        )
        
        # Update the last timeline state
        if self.timeline:
            last_state = self.timeline[-1]
            last_state.action = action
            
            # For browser-use, we don't need to create additional annotations
            # since the screenshot already has highlights from browser-use
            logger.info("Action annotated with browser-use context", 
                       action_type=action_type.value, 
                       description=description,
                       element_index=element_index,
                       success=success)
        
        return action.action_id
    
    async def _save_screenshot(self, screenshot_data: str, state_id: str) -> str:
        """Save screenshot to disk"""
        try:
            screenshot_path = self.base_path / f"screenshot_{state_id}.png"
            screenshot_bytes = base64.b64decode(screenshot_data)
            
            with open(screenshot_path, 'wb') as f:
                f.write(screenshot_bytes)
            
            return str(screenshot_path)
        except Exception as e:
            logger.error("Failed to save screenshot", error=str(e))
            return None
    
    async def _cleanup_state_files(self, state: TimelineState):
        """Clean up files for old timeline states"""
        try:
            if state.screenshot_path:
                Path(state.screenshot_path).unlink(missing_ok=True)
            if state.annotated_screenshot_path:
                Path(state.annotated_screenshot_path).unlink(missing_ok=True)
        except Exception as e:
            logger.error("Failed to cleanup state files", error=str(e))
    
    def get_timeline_data(self) -> List[Dict[str, Any]]:
        """Get timeline data for dashboard with browser-use context"""
        timeline_data = []
        
        for state in self.timeline:
            # Convert action to dict with proper serialization
            action_data = None
            if state.action:
                action_dict = asdict(state.action)
                # Convert ActionType enum to string for JSON serialization
                action_dict["action_type"] = state.action.action_type.value
                action_data = action_dict
            
            timeline_data.append({
                "timestamp": state.timestamp.isoformat(),
                "state_id": state.state_id,
                "url": state.url,
                "page_title": state.page_title,
                "action": action_data,
                "screenshot_available": bool(state.screenshot_path),
                "annotated_available": bool(state.annotated_screenshot_path),
                "agent_id": state.agent_id,
                "clickable_elements_count": state.clickable_elements.get("total_elements", 0) if state.clickable_elements else 0,
                "browser_context": {
                    "has_selector_map": bool(state.selector_map),
                    "tabs_count": len(state.browser_state.get("tabs", [])) if state.browser_state else 0
                }
            })
        
        return timeline_data
    
    def get_state_by_id(self, state_id: str) -> Optional[TimelineState]:
        """Get specific timeline state"""
        for state in self.timeline:
            if state.state_id == state_id:
                return state
        return None
    
    async def export_timeline(self, format: str = "json") -> str:
        """Export timeline data with browser-use context"""
        if format == "json":
            export_data = {
                "agent_id": self.agent_id,
                "export_time": datetime.utcnow().isoformat(),
                "timeline_length": len(self.timeline),
                "browser_use_integration": True,
                "timeline": self.get_timeline_data(),
                "browser_context": {
                    "total_screenshots": len([s for s in self.timeline if s.screenshot_path]),
                    "total_actions": len([s for s in self.timeline if s.action]),
                    "unique_urls": list(set(s.url for s in self.timeline)),
                    "element_interactions": [
                        {
                            "state_id": s.state_id,
                            "action_type": s.action.action_type.value if s.action else None,
                            "element_index": s.action.element_index if s.action else None,
                            "success": s.action.success if s.action else None
                        }
                        for s in self.timeline if s.action
                    ]
                }
            }
            
            export_path = self.base_path / f"timeline_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            with open(export_path, 'w') as f:
                json.dump(export_data, f, indent=2)
            
            return str(export_path)
        
        raise ValueError(f"Unsupported export format: {format}")
    
    async def cleanup(self):
        """Clean up all monitoring resources"""
        await self.stop_monitoring()
        
        # Clean up all timeline files
        for state in self.timeline:
            await self._cleanup_state_files(state)
        
        logger.info("Visual monitor cleaned up", agent_id=self.agent_id) 