import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

// Keywords to identify key business flows
const FLOW_KEYWORDS = [
  'auth',
  'login',
  'register',
  'password',
  'jwt',
  'payment',
  'checkout',
  'subscription',
  'charge',
  'order',
  'cart',
  'product',
  'user',
  'profile',
  'account',
];

// Enhanced flow patterns with descriptions
const FLOW_PATTERNS = {
  auth: {
    keywords: ['login', 'logout', 'register', 'password', 'jwt', 'token'],
    description: (flows) => `Authentication flow involving ${flows.length} steps: ${flows.map(f => f.keyword).join(' → ')}`
  },
  crud: {
    keywords: ['create', 'read', 'update', 'delete', 'list', 'get', 'post', 'put', 'patch'],
    description: (flows) => `CRUD operation flow for ${flows[0].keyword.replace(/[A-Z]/g, ' $&')} resource`
  },
  payment: {
    keywords: ['checkout', 'payment', 'charge', 'invoice', 'subscription'],
    description: (flows) => `Payment processing flow with ${flows.length} steps`
  }
};

export interface IdentifiedFlow {
  keyword: string;
  filePath: string;
  relevantCode: string;
}

export interface FlowSummary {
  type: string;
  resource: string;
  description: string;
  endpoints: string[];
}

export type AnalysisResult = IdentifiedFlow | FlowSummary;

/**
 * Analyzes the project to identify key user and business flows.
 * @param projectPath The absolute path to the project root.
 * @returns An array of identified flows.
 */
export function analyzeProjectFlows(projectPath: string): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  
  // 1. First run the original keyword-based analysis
  const keywordResults = analyzeByKeywords(projectPath);
  results.push(...keywordResults);
  
  // 2. Then run the enhanced flow analysis
  const flowResults = analyzeFlows(projectPath);
  results.push(...flowResults);
  
  return results;
}

function analyzeByKeywords(projectPath: string): IdentifiedFlow[] {
  const identifiedFlows: IdentifiedFlow[] = [];
  const tsConfigPath = path.join(projectPath, 'tsconfig.json');
  
  if (fs.existsSync(tsConfigPath)) {
    const project = new Project();
    const sourceFiles = project.addSourceFilesAtPaths(
      path.join(projectPath, 'src/**/*.{ts,js}'),
    );

    for (const file of sourceFiles) {
      for (const keyword of FLOW_KEYWORDS) {
        if (file.getText().includes(keyword)) {
          identifiedFlows.push({
            keyword,
            filePath: path.relative(projectPath, file.getFilePath()),
            relevantCode: `File contains keyword: ${keyword}`,
          });
        }
      }
    }
  }
  
  return identifiedFlows;
}

function analyzeFlows(projectPath: string): FlowSummary[] {
  const flowSummaries: FlowSummary[] = [];
  
  try {
    const tsEndpoints = generateApiDoc(projectPath);
    const pyEndpoints = generatePythonApiDoc(projectPath);
    const allEndpoints = [...tsEndpoints, ...pyEndpoints];

    const endpointGroups: Record<string, any[]> = {};
    allEndpoints.forEach(endpoint => {
      const resource = endpoint.controller || endpoint.filePath;
      endpointGroups[resource] = endpointGroups[resource] || [];
      endpointGroups[resource].push(endpoint);
    });

    Object.entries(endpointGroups).forEach(([resource, endpoints]) => {
      // CRUD detection
      const crudMethods = new Set(endpoints.map(e => e.methodName.toLowerCase()));
      if (['create', 'read', 'update', 'delete'].some(m => crudMethods.has(m))) {
        flowSummaries.push({
          type: 'crud',
          resource,
          description: `Complete CRUD operations for ${resource}`,
          endpoints: endpoints.map(e => `${e.methodName} ${e.route}`)
        });
      }

      // Auth flow detection
      if (endpoints.some(e => FLOW_PATTERNS.auth.keywords.some(k => 
        e.methodName.toLowerCase().includes(k) || e.route.toLowerCase().includes(k)
      ))) {
        flowSummaries.push({
          type: 'auth',
          resource,
          description: `Authentication sequence for ${resource}`,
          endpoints: endpoints
            .filter(e => FLOW_PATTERNS.auth.keywords.some(k => 
              e.methodName.toLowerCase().includes(k) || e.route.toLowerCase().includes(k)
            ))
            .map(e => `${e.methodName} ${e.route}`)
        });
      }
    });
  } catch (error) {
    console.error('Flow analysis error:', error);
  }
  
  return flowSummaries;
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
    } else if (
      entry.isFile() &&
      ['.md', '.json', '.yaml', '.yml'].some((ext) => entry.name.endsWith(ext))
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function generateApiDoc(projectPath: string): any[] {
  try {
    // In a real implementation, this would parse TypeScript API docs
    return [];
  } catch (error) {
    console.error('API doc generation failed:', error);
    return [];
  }
}

function generatePythonApiDoc(projectPath: string): any[] {
  try {
    // In a real implementation, this would parse Python API docs
    return [];
  } catch (error) {
    console.error('Python API doc generation failed:', error);
    return [];
  }
}
