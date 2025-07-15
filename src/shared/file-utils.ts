import * as fs from 'fs';
import * as path from 'path';

export function findFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  
  function walk(currentDir: string) {
    const files = fs.readdirSync(currentDir);
    
    files.forEach(file => {
      const fullPath = path.join(currentDir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (pattern.test(file)) {
        results.push(fullPath);
      }
    });
  }
  
  walk(dir);
  return results;
}

export function findPythonFiles(dir: string): string[] {
  return findFiles(dir, /\.py$/);
}
