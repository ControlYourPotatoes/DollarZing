const fs = require('fs');
const path = require('path');

describe('Project Structure Validation', () => {
  const projectRoot = path.resolve(__dirname, '..');
  
  test('engine directory exists with correct structure', () => {
    const engineDir = path.join(projectRoot, 'engine');
    expect(fs.existsSync(engineDir)).toBe(true);
    
    const expectedDirs = ['src', 'tests'];
    expectedDirs.forEach(dir => {
      expect(fs.existsSync(path.join(engineDir, dir))).toBe(true);
    });
    
    const expectedFiles = ['package.json', 'tsconfig.json', 'Dockerfile'];
    expectedFiles.forEach(file => {
      expect(fs.existsSync(path.join(engineDir, file))).toBe(true);
    });
  });

  test('engine/src directory has correct subdirectories', () => {
    const engineSrcDir = path.join(projectRoot, 'engine', 'src');
    const expectedSubDirs = ['simulation', 'generators', 'workers', 'types'];
    
    expectedSubDirs.forEach(dir => {
      expect(fs.existsSync(path.join(engineSrcDir, dir))).toBe(true);
    });
  });

  test('data directory exists with correct structure', () => {
    const dataDir = path.join(projectRoot, 'data');
    expect(fs.existsSync(dataDir)).toBe(true);
    
    const expectedDirs = ['src', 'tests'];
    expectedDirs.forEach(dir => {
      expect(fs.existsSync(path.join(dataDir, dir))).toBe(true);
    });
  });

  test('data/src directory has correct subdirectories', () => {
    const dataSrcDir = path.join(projectRoot, 'data', 'src');
    const expectedSubDirs = ['storage', 'serialization', 'types'];
    
    expectedSubDirs.forEach(dir => {
      expect(fs.existsSync(path.join(dataSrcDir, dir))).toBe(true);
    });
  });

  test('enhanced src directory maintains existing structure', () => {
    const srcDir = path.join(projectRoot, 'src');
    expect(fs.existsSync(srcDir)).toBe(true);
    
    const expectedDirs = ['components', 'pages', 'store', 'hooks'];
    expectedDirs.forEach(dir => {
      expect(fs.existsSync(path.join(srcDir, dir))).toBe(true);
    });
  });

  test('docker configuration files exist', () => {
    const dockerFiles = ['docker-compose.yml', 'docker-compose.prod.yml'];
    dockerFiles.forEach(file => {
      expect(fs.existsSync(path.join(projectRoot, file))).toBe(true);
    });
  });

  test('typescript configuration files exist for each module', () => {
    const configs = [
      'tsconfig.json',
      'engine/tsconfig.json',
      'data/tsconfig.json'
    ];
    
    configs.forEach(config => {
      expect(fs.existsSync(path.join(projectRoot, config))).toBe(true);
    });
  });
});

describe('Package Configuration Validation', () => {
  const projectRoot = path.resolve(__dirname, '..');
  
  test('root package.json has docker scripts', () => {
    const packagePath = path.join(projectRoot, 'package.json');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    expect(packageContent.scripts).toHaveProperty('docker:dev');
    expect(packageContent.scripts).toHaveProperty('docker:prod');
    expect(packageContent.scripts).toHaveProperty('docker:build');
    expect(packageContent.scripts).toHaveProperty('docker:clean');
  });

  test('engine package.json has correct dependencies and scripts', () => {
    const packagePath = path.join(projectRoot, 'engine', 'package.json');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    expect(packageContent.name).toBe('dollarzing-engine');
    expect(packageContent.scripts).toHaveProperty('build');
    expect(packageContent.scripts).toHaveProperty('dev');
    expect(packageContent.scripts).toHaveProperty('test');
    
    expect(packageContent.dependencies).toHaveProperty('@types/node');
  });

  test('data package.json has correct configuration', () => {
    const packagePath = path.join(projectRoot, 'data', 'package.json');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    expect(packageContent.name).toBe('dollarzing-data');
    expect(packageContent.dependencies).toHaveProperty('idb');
  });
});