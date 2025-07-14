import { Injectable } from '@nestjs/common';
import {
  ParsedProjectData,
  ClassInfo,
  IdentifiedFlow,
  SocketGatewayInfo,
} from '../common/types';

@Injectable()
export class MarkdownGeneratorService {
  generate(
    projectName: string,
    data: ParsedProjectData,
    folderTree: string,
    erdMermaidCode: string,
    apiDocs: any[],
    flows: IdentifiedFlow[],
    webSocketInfo: SocketGatewayInfo[],
  ): string {
    let md = '';

    // 1. Title Page
    md += `# Project Documentation: ${projectName}

`;
    md += `**Generated on:** ${new Date().toLocaleDateString()}

`;
    md += `
---

`; // Page break in Pandoc

    // 2. Table of Contents
    md += `## Table of Contents

`;
    md += `*   [Folder Structure](#folder-structure)
`;
    md += `*   [Database Schema](#database-schema)
`;
    md += `*   [API Endpoints](#api-endpoints)
`;
    md += `*   [WebSocket API](#websocket-api)
`;
    md += `*   [Project Flows](#project-flows)
`;
    md += `
---

`;

    // 3. Folder Structure
    md += `## Folder Structure

`;
    md += '```\n' + folderTree + '\n```\n\n';
    md += `
---

`;

    // 4. Database Schema
    md += `## Database Schema

`;
    md += `### Entity Relationship Diagram

`;
    md += '```mermaid\n' + erdMermaidCode + '\n```\n\n';
    md += this.formatDatabaseTables(data.entities);
    md += `
---

`;

    // 5. API Endpoints
    md += `## API Endpoints

`;
    md += this.formatApiDocs(apiDocs);
    md += `
---

`;

    // 6. WebSocket API
    md += `## WebSocket API

`;
    md += this.formatWebSockets(webSocketInfo);
    md += `
---

`;

    // 7. Project Flows
    md += `## Project Flows

`;
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

  private formatWebSockets(gateways: SocketGatewayInfo[]): string {
    if (!gateways || gateways.length === 0)
      return 'No WebSocket gateways found.\n\n';

    let md = '';
    gateways.forEach((gateway) => {
      md += `### Gateway: \`${gateway.name}\`\n\n`;
      md += `*Source: \`${gateway.filePath}\`*\n\n`;

      if (gateway.subscribedMessages.length > 0) {
        md += `#### Subscribed Messages\n\n`;
        md += `| Event Name | Payload Type | Ack Type |\n`;
        md += `|---|---|---|\n`;
        gateway.subscribedMessages.forEach((msg) => {
          md += `| \`${msg.eventName}\` | \`${msg.payload}\` | \`${msg.ack}\` |\n`;
        });
        md += '\n';
      }

      if (gateway.emittedEvents.length > 0) {
        md += `#### Emitted Events\n\n`;
        md += `| Event Name | Payload Type |\n`;
        md += `|---|---|\n`;
        gateway.emittedEvents.forEach((evt) => {
          md += `| \`${evt.eventName}\` | \`${evt.payload}\` |\n`;
        });
        md += '\n';
      }
    });
    return md;
  }
}
