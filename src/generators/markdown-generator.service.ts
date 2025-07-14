import { Injectable } from '@nestjs/common';
import { ParsedProjectData, ClassInfo, IdentifiedFlow } from '../common/types';

@Injectable()
export class MarkdownGeneratorService {
  generate(
    projectName: string,
    data: ParsedProjectData,
    folderTree: string,
    erdMermaidCode: string,
    apiDocs: any[],
    flows: IdentifiedFlow[],
  ): string {
    let md = '';

    // 1. Title Page
    md += `# Project Documentation: ${projectName}\n\n`;
    md += `**Generated on:** ${new Date().toLocaleDateString()}\n\n`;
    md += `\n---\n\n`; // Page break in Pandoc

    // 2. Table of Contents placeholder (most Markdown viewers generate this automatically)
    md += `## Table of Contents\n\n`;
    md += `*   [Folder Structure](#folder-structure)\n`;
    md += `*   [Database Schema](#database-schema)\n`;
    md += `*   [API Endpoints](#api-endpoints)\n`;
    md += `*   [Project Flows](#project-flows)\n`;
    md += `\n---\n\n`;

    // 3. Folder Structure
    md += `## Folder Structure\n\n`;
    md += '```\n' + folderTree + '\n```\n\n';
    md += `\n---\n\n`;

    // 4. Database Schema
    md += `## Database Schema\n\n`;
    md += `### Entity Relationship Diagram\n\n`;
    md += '```mermaid\n' + erdMermaidCode + '\n```\n\n';
    md += this.formatDatabaseTables(data.entities);
    md += `\n---\n\n`;

    // 5. API Endpoints
    md += `## API Endpoints\n\n`;
    md += this.formatApiDocs(apiDocs);
    md += `\n---\n\n`;

    // 6. Project Flows
    md += `## Project Flows\n\n`;
    md += this.formatFlows(flows);

    return md;
  }

  private formatDatabaseTables(entities: ClassInfo[]): string {
    if (!entities || entities.length === 0)
      return 'No database entities found.\n\n';

    let md = '';
    entities.forEach((entity) => {
      md += `### Entity: \`${entity.name}\`\n\n`;
      md += `| Column | Type | Decorators |\n`;
      md += `|---|---|---|\n`;
      entity.properties?.forEach((prop) => {
        md += `| ${prop.name || ''} | \`${prop.type || ''}\` | ${
          prop.decorators?.join(', ') || ''
        } |\n`;
      });
      md += '\n';
    });
    return md;
  }

  private formatApiDocs(apiDocs: any[]): string {
    if (!apiDocs || apiDocs.length === 0) return 'No API endpoints found.\n\n';

    let md = '';
    apiDocs.forEach((doc) => {
      md += `### \`${doc.route}\`\n\n`;
      if (doc.description) {
        md += `${doc.description}\n\n`;
      }
      if (doc.requestParams) {
        md += `**Request:**\n\n`;
        md +=
          '```json\n' +
          JSON.stringify(doc.requestParams, null, 2) +
          '\n```\n\n';
      }
      if (doc.responseDto) {
        md += `**Response:**\n\n`;
        md +=
          '```json\n' + JSON.stringify(doc.responseDto, null, 2) + '\n```\n\n';
      }
    });
    return md;
  }

  private formatFlows(flows: IdentifiedFlow[]): string {
    if (!flows || flows.length === 0) {
      return 'No specific project flows were identified.\n\n';
    }

    let md = '';
    const flowsByKeyword: Record<string, IdentifiedFlow[]> = {};

    for (const flow of flows) {
      if (!flowsByKeyword[flow.keyword]) {
        flowsByKeyword[flow.keyword] = [];
      }
      flowsByKeyword[flow.keyword].push(flow);
    }

    for (const keyword in flowsByKeyword) {
      md += `### Flow: ${keyword}\n\n`;
      md += 'The following files appear to be related to this flow:\n\n';
      for (const flow of flowsByKeyword[keyword]) {
        md += `*   \`${flow.filePath}\`\n`;
      }
      md += '\n';
    }
    return md;
  }
}
