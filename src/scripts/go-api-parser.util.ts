import * as fs from 'fs';
import * as path from 'path';

export function parseGoEndpoints(projectPath: string): any[] {
  const endpoints: any[] = [];
  
  // Find all router files
  const routerFiles = findFiles(projectPath, /routers\.go$/);
  
  routerFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Parse Gin routes
    const routeMatches = content.matchAll(/router\.(GET|POST|PUT|DELETE)\(['"]([^'"]+)['"],/g);
    
    for (const match of routeMatches) {
      endpoints.push({
        method: match[1],
        path: match[2],
        file: path.relative(projectPath, file),
        framework: 'gin'
      });
    }
  });
  
  return endpoints;
}

function findFiles(dir: string, pattern: RegExp): string[] {
  const files: string[] = [];
  
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findFiles(fullPath, pattern));
    } else if (pattern.test(item)) {
      files.push(fullPath);
    }
  });
  
  return files;
}
