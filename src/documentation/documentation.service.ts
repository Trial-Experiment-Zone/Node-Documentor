import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import tree from 'tree-node-cli';
import {
  ParsedProjectData,
  SocketGatewayInfo,
  IdentifiedFlow,
  FlowSummary,
} from '../common/types';
import { ErdGeneratorService } from '../generators/erd-generator.service';
import { MarkdownGeneratorService } from '../generators/markdown-generator.service';
import { parseGoEndpoints } from '../scripts/go-api-parser.util';
import { parseMongoSchemas } from '../parsers/nosql/mongo-parser';
import { execFile } from 'child_process';
import { generateApiDoc } from '../scripts/api-parser.util';
import { analyzeProjectFlows } from '../scripts/flow-analyzer.util';
import { parseWebSockets } from '../scripts/websocket-parser.util';
import { PythonApiParserService } from 'src/scripts/python-api-parser.service';

@Injectable()
export class DocumentationService {
  private readonly goParserExecutablePath: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly erdGenerator: ErdGeneratorService,
    private readonly markdownGenerator: MarkdownGeneratorService,
    private readonly pythonApiParser: PythonApiParserService,
  ) {
    const relativePath = this.configService.get<string>(
      'GO_PARSER_PATH',
      './parser-go/go-parser',
    );
    this.goParserExecutablePath = path.resolve(process.cwd(), relativePath);
  }

  public async generateDocumentation(projectPath: string): Promise<string> {
    if (!fs.existsSync(projectPath)) {
      throw new NotFoundException(`Project path not found: ${projectPath}`);
    }

    const existingParsedData = await this.runGoParser(projectPath);
    const mongoSchemas = parseMongoSchemas(projectPath);
    const parsedData = {
      ...existingParsedData,
      mongoSchemas,
      name: path.basename(projectPath),
      path: projectPath,
      type: 'project',
      description: existingParsedData.description,
      entities: existingParsedData.entities,
      relationships: existingParsedData.relationships,
    };

    let apiDocs;
    if (this.isTypeScriptProject(projectPath)) {
      try {
        const apiDocsFromSource = generateApiDoc(projectPath);
        apiDocs = apiDocsFromSource;
      } catch (e) {
        console.error('Failed to generate API docs from source:', e);
        apiDocs = [];
      }
    } else if (await this.isPythonProject(projectPath)) {
      apiDocs = await this.pythonApiParser.parsePythonApis(projectPath);
      const djangoEndpoints = apiDocs.filter((d) => d.framework === 'django');
      if (djangoEndpoints.length > 0) {
        console.log(
          'Parsed Django endpoints:',
          JSON.stringify(djangoEndpoints, null, 2),
        );
      }
    } else if (this.isGoProject(projectPath)) {
      try {
        apiDocs = parseGoEndpoints(projectPath);
        console.log(
          'Go (Gin) project detected. Generated API docs from router files.',
        );
      } catch (e) {
        console.error('Failed to generate API docs from source (Go):', e);
        apiDocs = [];
      }
    } else {
      console.log(
        'Skipping API doc generation from source: Not a TypeScript project.',
      );
      apiDocs = [];
    }

    const folderTree = tree(projectPath, {
      exclude: [/node_modules/, /dist/, /\.git/, /output/],
    });

    const projectName = parsedData.name || path.basename(projectPath);
    const projectDescription =
      parsedData.description || 'No description available';
    const outputDir = path.resolve(process.cwd(), 'output', projectName);
    await fs.promises.mkdir(outputDir, { recursive: true });

    const erdMermaidCode = await this.erdGenerator.generateMermaidCodeOnly(
      parsedData.relationships ?? [],
      outputDir,
    );

    // Only analyze flows and sockets for TypeScript projects
    let webSocketInfo: SocketGatewayInfo[] = [];
    let keywordFlows: IdentifiedFlow[] = [];
    let flowSummaries: FlowSummary[] = [];

    if (this.isTypeScriptProject(projectPath)) {
      const analysisResults = analyzeProjectFlows(projectPath);

      // Strictly separate the two flow types
      keywordFlows = analysisResults.filter(
        (result): result is IdentifiedFlow => 'keyword' in result,
      );

      flowSummaries = analysisResults.filter(
        (result): result is FlowSummary => 'type' in result,
      );

      webSocketInfo = parseWebSockets(projectPath);
    }

    const alembicMigrations = detectAlembicMigrations(projectPath);

    // Generate Markdown content
    const databaseTables = parsedData.entities || [];
    const formattedTables = databaseTables
      .map(
        (table) =>
          `${table.name}\n${table.properties?.map((p) => `- ${p.name}: ${p.type}`).join('\n') || 'No columns'}`,
      )
      .join('\n\n');

    const markdown = this.markdownGenerator.generate(
      apiDocs,
      keywordFlows,
      flowSummaries,
      webSocketInfo,
      apiDocs.filter((d) => d.type === 'django-model'),
      erdMermaidCode,
      formattedTables,
      folderTree,
      projectDescription,
      alembicMigrations,
    );

    // Include formattedTables in the final markdown content
    const finalMarkdown = `${markdown}\n\n${formattedTables}`;
    const filePath = path.join(outputDir, `${projectName}-documentation.md`);
    await fs.promises.writeFile(filePath, finalMarkdown);
    return finalMarkdown;
  }

  async getOutputFiles(outputDir = 'output'): Promise<any[]> {
    const fullPath = path.join(process.cwd(), outputDir);

    try {
      // Create directory if it doesn't exist
      await fs.promises.mkdir(fullPath, { recursive: true });

      const files = await fs.promises.readdir(fullPath, {
        withFileTypes: true,
      });

      return Promise.all(
        files.map(async (file) => {
          const filePath = path.join(fullPath, file.name);
          const stats = await fs.promises.stat(filePath);

          return {
            name: file.name,
            path: filePath,
            type: file.isDirectory() ? 'directory' : 'file',
            size: stats.isFile() ? this.formatFileSize(stats.size) : '',
            modified: stats.mtime.toISOString(),
          };
        }),
      );
    } catch (error) {
      console.error('Error accessing output directory:', error);
      throw new NotFoundException('Output directory not found');
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private findAndParseApiSpec(projectPath: string): any[] | null {
    const specFileNames = ['swagger-spec.json', 'openapi.json', 'swagger.json'];
    for (const fileName of specFileNames) {
      const filePath = path.join(projectPath, fileName);
      if (fs.existsSync(filePath)) {
        try {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          return JSON.parse(fileContent);
        } catch (e) {
          console.error(`Error parsing API spec file ${fileName}:`, e);
          return null;
        }
      }
    }
    return null;
  }

  private runGoParser(projectPath: string): Promise<ParsedProjectData> {
    return new Promise((resolve, reject) => {
      const executablePath = this.goParserExecutablePath;
      if (!fs.existsSync(executablePath)) {
        const errorMsg = `Go parser executable not found: ${executablePath}`;
        return reject(new Error(errorMsg));
      }

      execFile(
        executablePath,
        [projectPath],
        { maxBuffer: 1024 * 1024 * 50 },
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Go Parser Error: ${stderr}`);
            return reject(new Error('Go parser failed.'));
          }
          try {
            const parsedJson: ParsedProjectData = JSON.parse(stdout);
            resolve(parsedJson);
          } catch (err) {
            console.error(`JSON parsing error: ${err}. STDOUT: ${stdout}`);
            reject(new Error('Failed to parse Go parser output.'));
          }
        },
      );
    });
  }

  private isTypeScriptProject(projectPath: string): boolean {
    const tsConfigPath = path.join(projectPath, 'tsconfig.json');
    return fs.existsSync(tsConfigPath);
  }

  private async isPythonProject(projectPath: string): Promise<boolean> {
    const pythonFiles = await fs.promises.readdir(projectPath);
    const hasRequirementsTxt = fs.existsSync(
      path.join(projectPath, 'requirements.txt'),
    );
    const hasPyprojectToml = fs.existsSync(
      path.join(projectPath, 'pyproject.toml'),
    );
    return (
      pythonFiles.some((file) => file.endsWith('.py')) ||
      hasRequirementsTxt ||
      hasPyprojectToml
    );
  }

  private isGoProject(projectPath: string): boolean {
    try {
      const files = fs.readdirSync(projectPath);
      return files.some(
        (file) =>
          file === 'go.mod' ||
          file.endsWith('.go') ||
          fs.existsSync(path.join(projectPath, 'go.sum')),
      );
    } catch {
      return false;
    }
  }

  private processKeywordFlows(flows: IdentifiedFlow[]): void {
    // Implementation using only IdentifiedFlow properties
  }

  private processFlowSummaries(summaries: FlowSummary[]): void {
    // Implementation using only FlowSummary properties
  }
}

function detectAlembicMigrations(projectPath: string): any[] {
  // Implementation to detect Alembic migrations
  // For demonstration purposes, return an empty array
  return [];
}
