"""
Integration tests for Scout-enhanced Browser-Use
Tests actual DOM extraction with enhanced attributes
"""

import os
import sys
import pytest
import asyncio
import tempfile
from pathlib import Path

# Add parent directories to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

# Set environment variable to prevent auto-patching during import
os.environ['SCOUT_DISABLE_PATCH'] = '1'

from scouts.scout_agent import ScoutAgent
from scouts import browser_use_patch
from browser_use import Browser
from browser_use.browser.browser import BrowserConfig
from browser_use.llm.base import BaseChatModel


# Mock LLM for testing
class MockLLM(BaseChatModel):
	"""Mock LLM that returns predetermined responses"""
	
	async def execute(self, messages):
		# Return a simple response that won't trigger any actions
		return {
			'thinking': 'Testing DOM extraction',
			'evaluation_previous_goal': 'Starting test',
			'memory': 'No previous actions',
			'next_goal': 'Extract DOM information',
			'action': []
		}
	
	def process_output(self, output):
		return output
	
	@property 
	def prompt_tokens(self):
		return 0
	
	@property
	def completion_tokens(self):
		return 0
	
	@property
	def total_tokens(self):
		return 0
	
	@property
	def cost(self):
		return 0.0


class TestScoutIntegration:
	"""Integration tests with real browser instance"""
	
	def setup_method(self):
		"""Setup for each test"""
		# Remove environment variable for tests
		if 'SCOUT_DISABLE_PATCH' in os.environ:
			del os.environ['SCOUT_DISABLE_PATCH']
		
		# Ensure patch is applied
		if not browser_use_patch.is_patched():
			browser_use_patch.apply_scout_patch()
	
	def teardown_method(self):
		"""Cleanup after each test"""
		# Restore environment variable
		os.environ['SCOUT_DISABLE_PATCH'] = '1'
	
	@pytest.mark.asyncio
	async def test_scout_agent_initialization(self):
		"""Test that ScoutAgent initializes with enhanced attributes"""
		# Create a Scout agent
		agent = ScoutAgent(
			task="Test Scout reconnaissance",
			llm=MockLLM()
		)
		
		# Verify Scout attributes are included
		assert agent.verify_scout_attributes()
		
		# Check specific attributes
		scout_attrs = agent.scout_attributes
		assert 'id' in scout_attrs
		assert 'data-testid' in scout_attrs
		assert 'data-qa' in scout_attrs
		
		# Clean up
		if hasattr(agent, 'browser_session') and agent.browser_session:
			await agent.browser_session.close()
	
	@pytest.mark.asyncio
	async def test_dom_extraction_includes_scout_attributes(self):
		"""Test that DOM extraction includes Scout-specific attributes"""
		# Create test HTML with various attributes
		test_html = """
		<html>
		<body>
			<button 
				id="submit-btn"
				data-testid="form-submit"
				data-qa="submit-button"
				class="btn btn-primary"
				aria-label="Submit form"
				onclick="handleSubmit()"
			>
				Submit
			</button>
			<input
				type="email"
				name="email"
				data-cy="email-input"
				placeholder="Enter email"
			/>
			<a
				href="/about"
				data-automation="about-link"
				data-test-id="nav-about"
			>
				About Us
			</a>
			<div
				data-component="header"
				data-role="navigation"
				data-track="nav-click"
			>
				Navigation
			</div>
		</body>
		</html>
		"""
		
		# Write to temp file
		with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
			f.write(test_html)
			temp_path = f.name
		
		try:
			# Create browser instance
			browser_config = BrowserConfig(headless=True)
			browser = Browser(browser_config)
			browser_session = await browser.new_session()
			context = await browser_session.new_context()
			page = await context.new_page()
			
			# Create Scout agent with the page
			agent = ScoutAgent(
				task="Extract DOM with Scout attributes",
				llm=MockLLM(),
				page=page,
				browser_session=browser_session
			)
			
			# Navigate to test page
			await page.goto(f"file://{temp_path}")
			await page.wait_for_load_state('domcontentloaded')
			
			# Get browser state through the agent's controller
			browser_state = await agent.controller.get_browser_state()
			
			# Convert DOM to string with Scout attributes
			dom_string = browser_state.element_tree.clickable_elements_to_string(
				include_attributes=agent.all_attributes
			)
			
			# Verify Scout attributes are included
			assert 'id="submit-btn"' in dom_string or "id='submit-btn'" in dom_string
			assert 'data-testid="form-submit"' in dom_string or "data-testid='form-submit'" in dom_string
			assert 'data-qa="submit-button"' in dom_string or "data-qa='submit-button'" in dom_string
			assert 'data-cy="email-input"' in dom_string or "data-cy='email-input'" in dom_string
			assert 'data-automation="about-link"' in dom_string or "data-automation='about-link'" in dom_string
			assert 'data-test-id="nav-about"' in dom_string or "data-test-id='nav-about'" in dom_string
			assert 'href="/about"' in dom_string or "href='/about'" in dom_string
			
			# Verify Browser-Use defaults still work
			assert 'aria-label="Submit form"' in dom_string or "aria-label='Submit form'" in dom_string
			assert 'placeholder="Enter email"' in dom_string or "placeholder='Enter email'" in dom_string
			assert 'type="email"' in dom_string or "type='email'" in dom_string
			assert 'name="email"' in dom_string or "name='email'" in dom_string
			
			# Verify framework/analytics attributes
			assert 'data-component="header"' in dom_string or "data-component='header'" in dom_string
			assert 'data-role="navigation"' in dom_string or "data-role='navigation'" in dom_string
			assert 'data-track="nav-click"' in dom_string or "data-track='nav-click'" in dom_string
			
			# Clean up
			await browser_session.close()
			
		finally:
			# Cleanup temp file
			os.unlink(temp_path)
	
	@pytest.mark.asyncio
	async def test_scout_agent_properties(self):
		"""Test ScoutAgent property methods"""
		agent = ScoutAgent(
			task="Test properties",
			llm=MockLLM()
		)
		
		# Test scout_attributes property
		scout_attrs = agent.scout_attributes
		assert isinstance(scout_attrs, list)
		assert len(scout_attrs) == len(browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES)
		assert 'data-testid' in scout_attrs
		
		# Test all_attributes property
		all_attrs = agent.all_attributes
		assert isinstance(all_attrs, list)
		assert len(all_attrs) == len(browser_use_patch.SCOUT_WHITELIST)
		assert 'aria-label' in all_attrs  # Browser-Use default
		assert 'data-testid' in all_attrs  # Scout addition
		
		# Clean up
		if hasattr(agent, 'browser_session') and agent.browser_session:
			await agent.browser_session.close()
	
	@pytest.mark.asyncio
	async def test_attribute_filtering_logic(self):
		"""Test that attribute filtering works correctly with Scout patches"""
		# Create test HTML
		test_html = """
		<html>
		<body>
			<button id="test-btn" class="btn" onclick="alert('test')">Click me</button>
		</body>
		</html>
		"""
		
		with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
			f.write(test_html)
			temp_path = f.name
		
		try:
			# Create browser instance
			browser_config = BrowserConfig(headless=True)
			browser = Browser(browser_config)
			browser_session = await browser.new_session()
			context = await browser_session.new_context()
			page = await context.new_page()
			
			# Create Scout agent
			agent = ScoutAgent(
				task="Test filtering",
				llm=MockLLM(),
				page=page,
				browser_session=browser_session
			)
			
			# Navigate to test page
			await page.goto(f"file://{temp_path}")
			await page.wait_for_load_state('domcontentloaded')
			
			# Get browser state
			browser_state = await agent.controller.get_browser_state()
			
			# Convert DOM to string
			dom_string = browser_state.element_tree.clickable_elements_to_string(
				include_attributes=agent.all_attributes
			)
			
			# Verify included attributes
			assert 'id="test-btn"' in dom_string or "id='test-btn'" in dom_string
			
			# Verify excluded attributes (not in whitelist)
			assert 'class=' not in dom_string
			assert 'onclick=' not in dom_string
			
			# Clean up
			await browser_session.close()
			
		finally:
			os.unlink(temp_path)
	
	@pytest.mark.asyncio
	async def test_complex_selector_discovery(self):
		"""Test discovery of complex selectors for Director use"""
		# Create test HTML with various selector types
		test_html = """
		<html>
		<body>
			<form data-testid="login-form">
				<input 
					id="username"
					name="username"
					data-qa="username-input"
					aria-label="Username"
					placeholder="Enter username"
				/>
				<input 
					id="password"
					type="password"
					name="password"
					data-test="password-field"
					aria-label="Password"
				/>
				<button
					data-testid="submit-btn"
					type="submit"
					aria-label="Log in"
				>
					Login
				</button>
			</form>
		</body>
		</html>
		"""
		
		with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
			f.write(test_html)
			temp_path = f.name
		
		try:
			# Create browser instance
			browser_config = BrowserConfig(headless=True)
			browser = Browser(browser_config)
			browser_session = await browser.new_session()
			context = await browser_session.new_context()
			page = await context.new_page()
			
			# Create Scout agent
			agent = ScoutAgent(
				task="Discover selectors",
				llm=MockLLM(),
				page=page,
				browser_session=browser_session
			)
			
			# Navigate to test page
			await page.goto(f"file://{temp_path}")
			await page.wait_for_load_state('domcontentloaded')
			
			# Get browser state
			browser_state = await agent.controller.get_browser_state()
			
			# Convert DOM to string
			dom_string = browser_state.element_tree.clickable_elements_to_string(
				include_attributes=agent.all_attributes
			)
			
			# Verify all selector types are discoverable
			# ID selectors
			assert 'id="username"' in dom_string or "id='username'" in dom_string
			assert 'id="password"' in dom_string or "id='password'" in dom_string
			
			# Data-testid selectors
			assert 'data-testid="login-form"' in dom_string or "data-testid='login-form'" in dom_string
			assert 'data-testid="submit-btn"' in dom_string or "data-testid='submit-btn'" in dom_string
			
			# QA selectors
			assert 'data-qa="username-input"' in dom_string or "data-qa='username-input'" in dom_string
			assert 'data-test="password-field"' in dom_string or "data-test='password-field'" in dom_string
			
			# Form selectors
			assert 'name="username"' in dom_string or "name='username'" in dom_string
			assert 'name="password"' in dom_string or "name='password'" in dom_string
			assert 'type="password"' in dom_string or "type='password'" in dom_string
			assert 'type="submit"' in dom_string or "type='submit'" in dom_string
			
			# Accessibility selectors
			assert 'aria-label=' in dom_string
			assert 'placeholder=' in dom_string
			
			# Clean up
			await browser_session.close()
			
		finally:
			os.unlink(temp_path)