import { Injectable } from '@nestjs/common';
import {
  ParsedProjectData,
  ClassInfo,
  IdentifiedFlow,
  SocketGatewayInfo,
  FlowSummary,
} from '../common/types';

@Injectable()
export class MarkdownGeneratorService {
  generate(
    apiDocs: ParsedProjectData[],
    keywordFlows: IdentifiedFlow[],
    flowSummaries: FlowSummary[],
    webSocketInfo: SocketGatewayInfo[],
    djangoModels: any[],
    erdMermaidCode: string,
    databaseTables: string,
    projectStructure: string,
    projectDescription: string
  ): string {
    let md = '';

    // 1. Title Page
    md += `# Project Documentation: ${projectDescription}

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
    md += '```\n' + projectStructure + '\n```\n\n';
    md += `
---

`;

    // 4. Database Schema
    md += `## Database Schema

`;
    md += `### Entity Relationship Diagram

`;
    md += '```mermaid\n' + erdMermaidCode + '\n```\n\n';
    md += this.formatDatabaseTables(databaseTables);
    md += this.formatDjangoModels(djangoModels);
    md += `
---

`;

    // 5. API Endpoints
    md += `## API Endpoints

`;
    const djangoEndpoints = apiDocs.filter((d: any) => d.framework === 'django');
    if (djangoEndpoints.length > 0) {
      md += this.formatDjangoEndpoints(djangoEndpoints);
    }
    md += this.formatApiDocs(apiDocs.filter((d: any) => d.framework !== 'django'));
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
    md += this.generateFlowsSection(keywordFlows, flowSummaries);

    return md;
  }

  private formatDatabaseTables(tables: string): string {
    if (!tables) return '';
    return `## Database Tables\n\n\`\`\`\n${tables}\n\`\`\`\n\n`;
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

  private formatDjangoEndpoints(endpoints: any[]): string {
    if (!endpoints || endpoints.length === 0) return '';
    
    // Filter out invalid endpoints
    const validEndpoints = endpoints.filter(e => 
      e.path && 
      e.path !== '/undefined-path' && 
      e.methods?.length > 0
    );
    
    if (validEndpoints.length === 0) return '';
    
    let md = '## Django API Endpoints\n\n';
    
    validEndpoints.forEach(endpoint => {
      md += `### ${endpoint.path}\n`;
      md += `**Methods**: ${endpoint.methods.join(', ')}\n`;
      
      if (endpoint.parameters?.length > 0) {
        md += '**Parameters**:\n';
        endpoint.parameters.forEach((param: any) => {
          md += `- ${param.name} (${param.type})\n`;
        });
      }
      
      md += `**File**: ${endpoint.file}\n\n`;
    });
    
    return md;
  }

  private formatDjangoModels(models: any[]): string {
    if (!models || models.length === 0) return '';
    
    let md = '## Database Models\n\n';
    
    models.forEach(model => {
      md += `### ${model.name}\n`;
      md += `**File**: ${model.file}\n\n`;
      
      if (Object.keys(model.fields).length > 0) {
        md += '#### Fields\n';
        md += '| Name | Type | Arguments |\n';
        md += '|------|------|-----------|\n';
        
        Object.entries(model.fields).forEach(([name, field]: [string, any]) => {
          md += `| ${name} | ${field.type} | ${field.args.join(', ') || '-'} |\n`;
        });
        
        md += '\n';
      }
    });
    
    return md;
  }

  private getEndpointPath(flow: IdentifiedFlow): string {
    // Extract from Flask routes like @app.route('/login')
    const flaskRoute = flow.relevantCode.match(/@\w+\.route\(['"]([^'"]+)['"]/)?.[1];
    
    // Extract from Express routes like router.get('/auth')
    const expressRoute = flow.relevantCode.match(/\.(get|post|put|delete)\(['"]([^'"]+)['"]/)?.[2];
    
    return flaskRoute || expressRoute || flow.filePath.split('/').pop() || flow.keyword;
  }

  private generateFlowsSection(
    keywordFlows: IdentifiedFlow[],
    flowSummaries: FlowSummary[]
  ): string {
    if (keywordFlows.length === 0 && flowSummaries.length === 0) {
      return '';
    }

    let markdown = '## API Flow Overview\n\n';

    // Group auth endpoints
    const authFlows = keywordFlows.filter(f => 
      ['auth', 'login', 'logout', 'token', 'session'].some(k => 
        f.keyword.toLowerCase().includes(k)
      )
    );

    if (authFlows.length > 0) {
      markdown += '### 1. Authentication\n';
      const uniqueAuthEndpoints = new Map<string, string>();
      
      authFlows.forEach(flow => {
        const endpointPath = this.getEndpointPath(flow);
        const desc = flow.relevantCode.match(/\/\*\*(.*?)\*\//s)?.[1]?.replace(/\*/g, '').trim() || 'Authentication endpoint';
        
        if (!uniqueAuthEndpoints.has(endpointPath)) {
          uniqueAuthEndpoints.set(endpointPath, desc);
        }
      });
      
      uniqueAuthEndpoints.forEach((desc, endpoint) => {
        markdown += `- **${endpoint}**: ${desc}\n`;
      });
      
      markdown += '\n';
    }

    // Group CRUD endpoints by resource
    const resourceGroups: Record<string, IdentifiedFlow[]> = {};
    keywordFlows
      .filter(f => !authFlows.includes(f))
      .forEach(flow => {
        const resourceMatch = flow.filePath.match(/\/([^\/]+)\.(ts|js|py)$/);
        const resource = resourceMatch?.[1] || 'other';
        resourceGroups[resource] = resourceGroups[resource] || [];
        resourceGroups[resource].push(flow);
      });

    markdown += '### 2. Core Resources\n';
    Object.entries(resourceGroups).forEach(([resource, flows]) => {
      markdown += `#### ${resource.charAt(0).toUpperCase() + resource.slice(1)}\n`;
      flows.forEach(flow => {
        const desc = flow.relevantCode.match(/\/\*\*(.*?)\*\//s)?.[1]?.replace(/\*/g, '').trim() || 'Endpoint';
        markdown += `- ${flow.keyword}: ${desc}\n`;
      });
      markdown += '\n';
    });

    // Add flow summaries if available
    if (flowSummaries.length > 0) {
      markdown += '### 3. Business Processes\n';
      flowSummaries.forEach(summary => {
        markdown += `#### ${summary.resource}\n`;
        markdown += `${summary.description || 'Process flow'}\n`;
        markdown += `- Involves: ${summary.endpoints.join(', ')}\n\n`;
      });
    }

    return markdown;
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
