#!/usr/bin/env node

/**
 * Build AEF Browser Docker Image
 * 
 * Builds the containerized browser environment for AEF automation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function buildBrowserImage() {
  console.log('🐳 Building AEF Browser Docker Image...\n');
  
  try {
    // Check if Docker is available
    console.log('🔍 Checking Docker availability...');
    execSync('docker --version', { stdio: 'inherit' });
    
    // Check if docker/browser directory exists
    const dockerDir = path.join(__dirname, '..', 'docker', 'browser');
    if (!fs.existsSync(dockerDir)) {
      throw new Error(`Docker browser directory not found: ${dockerDir}`);
    }
    
    console.log('✅ Docker available, building image...\n');
    
    // Build the Docker image
    const buildCommand = `docker build -t aef-browser:latest .`;
    console.log(`Running: ${buildCommand} (in ${dockerDir})`);
    
    execSync(buildCommand, { 
      stdio: 'inherit',
      cwd: dockerDir
    });
    
    console.log('\n✅ AEF Browser image built successfully!');
    
    // Verify the image was created
    console.log('\n🔍 Verifying image...');
    execSync('docker images aef-browser:latest', { stdio: 'inherit' });
    
    console.log('\n🎉 Build complete! You can now use containerized browser sessions.');
    console.log('\n💡 Usage:');
    console.log('   - The image will be used automatically by HybridBrowserManager');
    console.log('   - Set mode: "docker" in browser session config');
    console.log('   - Containers will be created on ports 13000-13009');
    
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    
    if (error.message.includes('docker: command not found')) {
      console.log('\n💡 Docker is not installed. Please install Docker first:');
      console.log('   - macOS: https://docs.docker.com/desktop/install/mac-install/');
      console.log('   - Linux: https://docs.docker.com/engine/install/');
      console.log('   - Windows: https://docs.docker.com/desktop/install/windows-install/');
    }
    
    process.exit(1);
  }
}

buildBrowserImage(); 