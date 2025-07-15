import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as glob from 'glob';
import * as path from 'path';
import { generateApiDoc } from 'src/scripts/api-parser.util';
import { analyzeProjectFlows } from 'src/scripts/flow-analyzer.util';
import { IdentifiedFlow, FlowSummary } from '../common/types';
import { generatePythonApiDoc } from 'src/scripts/python-api-parser.util';
import { parseWebSockets } from 'src/scripts/websocket-parser.util';
import tree from 'tree-node-cli';
import { ParsedProjectData, SocketGatewayInfo } from '../common/types';
import { ErdGeneratorService } from '../generators/erd-generator.service';
import { MarkdownGeneratorService } from '../generators/markdown-generator.service';
import { parseGoEndpoints } from 'src/scripts/go-api-parser.util';

@Injectable()
export class DocumentationService {
  private readonly goParserExecutablePath: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly erdGenerator: ErdGeneratorService,
    private readonly markdownGenerator: MarkdownGeneratorService,
  ) {
    const relativePath = this.configService.get<string>(
      'GO_PARSER_PATH',
      './parser-go/go-parser',
    );
    this.goParserExecutablePath = path.resolve(process.cwd(), relativePath);
  }

  public async generateDocumentation(projectPath: string): Promise<Buffer> {
    if (!fs.existsSync(projectPath)) {
      throw new NotFoundException(`Project path not found: ${projectPath}`);
    }

    const parsedData = await this.runGoParser(projectPath);
    let apiDocs = this.findAndParseApiSpec(projectPath);

    if (!apiDocs) {
      if (this.isTypeScriptProject(projectPath)) {
        try {
          apiDocs = generateApiDoc(projectPath);
        } catch (e) {
          console.error('Failed to generate API docs from source:', e);
          apiDocs = [];
        }
      } else if (await this.isPythonProject(projectPath)) {
        try {
          apiDocs = generatePythonApiDoc(projectPath);
          console.log(
            'Python project detected. Attempting Python API doc generation.',
          );
          // TODO: Add database model/entity extraction for Python (Django ORM, SQLAlchemy, etc.)
          // Example: parsedData.entities = extractPythonEntities(projectPath);
          // Example: parsedData.relationships = extractPythonRelationships(projectPath);
        } catch (e) {
          console.error('Failed to generate API docs from source (Python):', e);
          apiDocs = [];
        }
      } else if (this.isGoProject(projectPath)) {
        try {
          apiDocs = parseGoEndpoints(projectPath);
          console.log('Go (Gin) project detected. Generated API docs from router files.');
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

    // Generate Markdown content
    const databaseTables = parsedData.entities || [];
    const formattedTables = databaseTables
      .map(table => `${table.name}\n${table.properties?.map(p => `- ${p.name}: ${p.type}`).join('\n') || 'No columns'}`)
      .join('\n\n');

    const markdown = this.markdownGenerator.generate(
      apiDocs,
      keywordFlows,
      flowSummaries,
      webSocketInfo,
      apiDocs.filter(d => d.type === 'django-model'),
      erdMermaidCode,
      formattedTables,
      folderTree,
      projectDescription
    );

    // Include formattedTables in the final markdown content
    const finalMarkdown = `${markdown}\n\n${formattedTables}`;
    const filePath = path.join(outputDir, `${projectName}-documentation.md`);
    await fs.promises.writeFile(filePath, finalMarkdown);
    return Buffer.from(finalMarkdown, 'utf-8');
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
        return reject(new InternalServerErrorException(errorMsg));
      }

      execFile(
        executablePath,
        [projectPath],
        { maxBuffer: 1024 * 1024 * 50 },
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Go Parser Error: ${stderr}`);
            return reject(
              new InternalServerErrorException('Go parser failed.'),
            );
          }
          try {
            const parsedJson: ParsedProjectData = JSON.parse(stdout);
            resolve(parsedJson);
          } catch (err) {
            console.error(`JSON parsing error: ${err}. STDOUT: ${stdout}`);
            reject(
              new InternalServerErrorException(
                'Failed to parse Go parser output.',
              ),
            );
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
    const pythonFiles = await glob.glob(path.join(projectPath, '**/*.py'), {
      ignore: ['**/node_modules/**', '**/dist/**', '**/venv/**'],
    });
    const hasRequirementsTxt = fs.existsSync(
      path.join(projectPath, 'requirements.txt'),
    );
    const hasPyprojectToml = fs.existsSync(
      path.join(projectPath, 'pyproject.toml'),
    );
    return pythonFiles.length > 0 || hasRequirementsTxt || hasPyprojectToml;
  }

  private isGoProject(projectPath: string): boolean {
    try {
      const files = fs.readdirSync(projectPath);
      return files.some(file => 
        file === 'go.mod' || 
        file.endsWith('.go') || 
        fs.existsSync(path.join(projectPath, 'go.sum'))
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
