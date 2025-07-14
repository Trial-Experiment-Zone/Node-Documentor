import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import tree from 'tree-node-cli';
import { ErdGeneratorService } from '../generators/erd-generator.service';
import { MarkdownGeneratorService } from '../generators/markdown-generator.service';
import { ParsedProjectData, EntityRelationship, ClassInfo, FunctionInfo } from '../common/types';
import { generateApiDoc } from 'src/scripts/api-parser.util';
import { analyzeProjectFlows } from 'src/scripts/flow-analyzer.util';

@Injectable()
export class DocumentationService {
  private readonly goParserExecutablePath: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly erdGenerator: ErdGeneratorService,
    private readonly markdownGenerator: MarkdownGeneratorService, // Changed
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
      try {
        apiDocs = generateApiDoc(projectPath);
      } catch (e) {
        console.error('Failed to generate API docs from source:', e);
        apiDocs = [];
      }
    }

    const folderTree = tree(projectPath, {
      exclude: [/node_modules/, /dist/, /\.git/, /output/],
    });

    const projectName = path.basename(projectPath);
    const outputDir = path.resolve(process.cwd(), 'output', projectName);
    await fs.promises.mkdir(outputDir, { recursive: true });

    const erdMermaidCode = await this.erdGenerator.generateMermaidCodeOnly(
      parsedData.relationships ?? [],
      outputDir,
    );

    const flows = analyzeProjectFlows(projectPath);

    // Generate Markdown content
    const markdownContent = this.markdownGenerator.generate(
      projectName,
      parsedData,
      folderTree,
      erdMermaidCode,
      apiDocs,
      flows,
    );

    // Save the Markdown file
    const filePath = path.join(outputDir, `${projectName}-documentation.md`);
    await fs.promises.writeFile(filePath, markdownContent);

    // Return the markdown content as a buffer
    return Buffer.from(markdownContent, 'utf-8');
  }

  private findAndParseApiSpec(projectPath: string): any[] | null {
    const specFileNames = ['swagger-spec.json', 'openapi.json', 'swagger.json'];
    for (const fileName of specFileNames) {
      const filePath = path.join(projectPath, fileName);
      if (fs.existsSync(filePath)) {
        try {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          return JSON.parse(fileContent); // Return the raw spec
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
            return reject(new InternalServerErrorException('Go parser failed.'));
          }
          try {
            const parsedJson: ParsedProjectData = JSON.parse(stdout);
            resolve(parsedJson);
          } catch (err) {
            console.error(`JSON parsing error: ${err}. STDOUT: ${stdout}`);
            reject(new InternalServerErrorException('Failed to parse Go parser output.'));
          }
        },
      );
    });
  }
}