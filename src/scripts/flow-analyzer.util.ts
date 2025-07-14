import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

// Keywords to identify key business flows
const FLOW_KEYWORDS = [
  'auth', 'login', 'register', 'password', 'jwt',
  'payment', 'checkout', 'subscription', 'charge',
  'order', 'cart', 'product',
  'user', 'profile', 'account',
];

interface IdentifiedFlow {
  keyword: string;
  filePath: string;
  relevantCode: string; // Could be a function name, class name, etc.
}

/**
 * Analyzes the project to identify key user and business flows.
 * @param projectPath The absolute path to the project root.
 * @returns An array of identified flows.
 */
export function analyzeProjectFlows(projectPath: string): IdentifiedFlow[] {
  const identifiedFlows: IdentifiedFlow[] = [];
  const project = new Project();

  // Add all source files, but be careful about exclusions
  const sourceFiles = project.addSourceFilesAtPaths(path.join(projectPath, 'src/**/*.{ts,js}'));
  
  // Also consider non-code files that might contain flow info
  const otherFiles = findRelevantFiles(projectPath);

  for (const file of [...sourceFiles, ...otherFiles]) {
    const content = (typeof file === 'string') ? fs.readFileSync(file, 'utf-8') : file.getFullText();
    const filePath = (typeof file === 'string') ? file : file.getFilePath();

    for (const keyword of FLOW_KEYWORDS) {
      if (content.toLowerCase().includes(keyword)) {
        // Basic implementation: just note the file and keyword.
        // A more advanced version would find the specific function/class.
        identifiedFlows.push({
          keyword,
          filePath: path.relative(projectPath, filePath),
          relevantCode: `File contains keyword: ${keyword}`,
        });
      }
    }
  }

  // Deduplicate based on file path and keyword
  const uniqueFlows = identifiedFlows.filter(
    (flow, index, self) =>
      index === self.findIndex((f) => f.filePath === flow.filePath && f.keyword === flow.keyword)
  );

  return uniqueFlows;
}

/**
 * Finds non-source files that might be relevant, like configuration or markdown.
 * @param projectPath The project path.
 */
function findRelevantFiles(projectPath: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(projectPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(projectPath, entry.name);
        if (entry.isDirectory()) {
            if (['.git', 'node_modules', 'dist', 'output'].includes(entry.name)) {
                continue;
            }
            files.push(...findRelevantFiles(fullPath));
        } else if (entry.isFile() && ['.md', '.json', '.yaml', '.yml'].some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
        }
    }
    return files;
}
