const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

describe('Docker Container Health Checks', () => {
  const timeout = 60000; // 60 seconds timeout for Docker operations

  test('docker-compose.yml is valid', async () => {
    try {
      await execPromise('docker-compose config');
    } catch (error) {
      throw new Error(`docker-compose.yml validation failed: ${error.message}`);
    }
  }, timeout);

  test('docker-compose.prod.yml is valid', async () => {
    try {
      await execPromise('docker-compose -f docker-compose.prod.yml config');
    } catch (error) {
      throw new Error(`docker-compose.prod.yml validation failed: ${error.message}`);
    }
  }, timeout);

  test('engine Dockerfile builds successfully', async () => {
    try {
      await execPromise('cd engine && docker build -t dollarzing-engine-test .');
    } catch (error) {
      throw new Error(`Engine Dockerfile build failed: ${error.message}`);
    }
  }, timeout);

  test('frontend Dockerfile builds successfully', async () => {
    try {
      await execPromise('docker build -t dollarzing-frontend-test .');
    } catch (error) {
      throw new Error(`Frontend Dockerfile build failed: ${error.message}`);
    }
  }, timeout);

  test('development containers start and respond to health checks', async () => {
    try {
      // Start development environment
      await execPromise('docker-compose up -d');
      
      // Wait for containers to be ready
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Check engine health
      const engineHealth = await execPromise('docker-compose exec -T engine curl -f http://localhost:3001/health');
      expect(engineHealth.stdout.trim()).toBe('{"status":"healthy"}');
      
      // Check frontend accessibility
      const frontendHealth = await execPromise('docker-compose exec -T frontend curl -f http://localhost:3000/');
      expect(frontendHealth.stderr).toBe(''); // No curl errors
      
    } catch (error) {
      throw new Error(`Container health check failed: ${error.message}`);
    } finally {
      // Clean up
      try {
        await execPromise('docker-compose down -v');
      } catch (cleanupError) {
        console.warn('Cleanup warning:', cleanupError.message);
      }
    }
  }, timeout);

  test('production containers start successfully', async () => {
    try {
      // Start production environment
      await execPromise('docker-compose -f docker-compose.prod.yml up -d');
      
      // Wait for containers to be ready
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      // Check containers are running
      const containerStatus = await execPromise('docker-compose -f docker-compose.prod.yml ps --services --filter "status=running"');
      const runningServices = containerStatus.stdout.trim().split('\n').filter(Boolean);
      
      expect(runningServices).toContain('engine');
      expect(runningServices).toContain('frontend');
      
    } catch (error) {
      throw new Error(`Production container startup failed: ${error.message}`);
    } finally {
      // Clean up
      try {
        await execPromise('docker-compose -f docker-compose.prod.yml down -v');
      } catch (cleanupError) {
        console.warn('Cleanup warning:', cleanupError.message);
      }
    }
  }, timeout);
});

describe('Docker Network and Volume Tests', () => {
  const timeout = 30000;

  test('shared data volume is created and accessible', async () => {
    try {
      await execPromise('docker-compose up -d');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Test data volume accessibility from both containers
      await execPromise('docker-compose exec -T engine touch /data/datasets/engine-test.txt');
      await execPromise('docker-compose exec -T frontend ls /data/datasets/engine-test.txt');
      
    } catch (error) {
      throw new Error(`Shared volume test failed: ${error.message}`);
    } finally {
      try {
        await execPromise('docker-compose down -v');
      } catch (cleanupError) {
        console.warn('Cleanup warning:', cleanupError.message);
      }
    }
  }, timeout);

  test('containers can communicate on internal network', async () => {
    try {
      await execPromise('docker-compose up -d');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Test frontend can reach engine
      await execPromise('docker-compose exec -T frontend ping -c 1 engine');
      
      // Test engine can receive requests (if health endpoint exists)
      await execPromise('docker-compose exec -T frontend wget -q --spider http://engine:3001/health');
      
    } catch (error) {
      throw new Error(`Container network communication failed: ${error.message}`);
    } finally {
      try {
        await execPromise('docker-compose down -v');
      } catch (cleanupError) {
        console.warn('Cleanup warning:', cleanupError.message);
      }
    }
  }, timeout);
});