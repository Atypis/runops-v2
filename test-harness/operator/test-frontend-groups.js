// Test script to check group nodes in the frontend
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:3002');
  
  // Wait for the app to load
  await page.waitForSelector('#app', { timeout: 5000 });
  
  // Check if mock mode is enabled
  const mockCheckbox = await page.$('input[type="checkbox"]');
  if (mockCheckbox) {
    const isChecked = await page.evaluate(el => el.checked, mockCheckbox);
    if (!isChecked) {
      await mockCheckbox.click();
      console.log('Enabled mock mode');
    }
  }
  
  // Wait a bit for nodes to load
  await page.waitForTimeout(2000);
  
  // Check for group nodes
  const groupNodes = await page.evaluate(() => {
    const nodes = document.querySelectorAll('[class*="rounded-lg"]');
    const groupNodes = [];
    
    nodes.forEach(node => {
      const typeSpan = node.querySelector('span[style*="color"]');
      if (typeSpan && typeSpan.textContent === 'group') {
        const positionSpan = node.querySelector('.font-mono');
        const description = node.querySelector('.text-gray-600');
        groupNodes.push({
          position: positionSpan?.textContent,
          type: 'group',
          description: description?.textContent
        });
      }
    });
    
    return groupNodes;
  });
  
  console.log('Found group nodes:', groupNodes);
  
  // Keep browser open for inspection
  // await browser.close();
})();