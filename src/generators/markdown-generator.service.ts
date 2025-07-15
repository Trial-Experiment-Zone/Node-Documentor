import { Injectable } from '@nestjs/common';
import {
  ParsedProjectData,
  ClassInfo,
  IdentifiedFlow,
  SocketGatewayInfo,
  FlowSummary,
} from '../common/types';
import { formatMongoSchemas } from './markdown/nosql-generator';

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
    projectDescription: string,
    alembicMigrations: any[]
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
    md += `*   [Database Migrations](#database-migrations)
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
    const sqlAlchemyModels = apiDocs.filter((d: any) => d.type === 'sqlalchemy-model');
    if (sqlAlchemyModels.length > 0) {
      md += this.formatSqlAlchemyModels(sqlAlchemyModels);
    }
    const mongoSchemas = apiDocs.filter(
      (d: any) => d.type === 'mongo-schema' && d.fields
    ) as any[];
    if (mongoSchemas.length > 0) {
      md += formatMongoSchemas(mongoSchemas);
    }
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

    // 7. Database Migrations
    md += `## Database Migrations

`;
    md += this.formatAlembicMigrations(alembicMigrations);
    md += `
---

`;

    // 8. Project Flows
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
    
    let md = '## Django API Endpoints\n\n';
    
    endpoints.forEach(endpoint => {
      md += `### ${endpoint.path}\n`;
      
      if (endpoint.name) {
        md += `**Name**: ${endpoint.name}\n`;
      }
      
      md += `**Methods**: ${endpoint.methods?.join(', ') || 'GET'}\n`;
      md += `**File**: ${endpoint.file}\n`;
      
      if (endpoint.description) {
        md += `\n${endpoint.description}\n`;
      }
      
      if (endpoint.parameters?.length > 0) {
        md += '\n**Parameters**:\n';
        md += '| Name | Type | Required | Description |\n';
        md += '|------|------|----------|-------------|\n';
        endpoint.parameters.forEach((param: any) => {
          md += `| ${param.name} | ${param.type} | ${param.required ? 'Yes' : 'No'} | ${param.description || '-'} |\n`;
        });
      }
      
      md += '\n';
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

  private formatSqlAlchemyModels(models: any[]): string {
    if (!models || models.length === 0) return '';
    
    let md = '## SQLAlchemy Models\n\n';
    const relationships: string[] = [];
    
    models.forEach(model => {
      md += `### ${model.name}\n`;
      md += `**File**: ${model.file}\n\n`;
      
      if (Object.keys(model.fields).length > 0) {
        md += '#### Fields\n';
        md += '| Name | Type | SQL Type | Arguments |\n';
        md += '|------|------|----------|-----------|\n';
        
        Object.entries(model.fields).forEach(([name, field]: [string, any]) => {
          const sqlType = field.args.find((a: string) => 
            a.includes('String(') || a.includes('Integer') || a.includes('DateTime')
          ) || '-';
          md += `| ${name} | ${field.type} | ${sqlType} | ${field.args.filter((a: string) => !a.includes(field.type)).join(', ') || '-'} |\n`;
          
          // Track relationships for visualization
          if (field.type === 'relationship') {
            const target = field.args.find(a => a.includes('='))?.split('=')[1] || 'Unknown';
            relationships.push(`${model.name} --> ${target.replace(/['"]/g, '')} : ${name}`);
          }
        });
        
        md += '\n';
      }
    });
    
    // Add Mermaid relationship diagram
    if (relationships.length > 0) {
      md += '### Relationships\n\n';
      md += '```mermaid\nclassDiagram\n';
      md += relationships.join('\n');
      md += '\n```\n\n';
    }
    
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

  private formatAlembicMigrations(migrations: any[]): string {
    if (!migrations || migrations.length === 0) return '';
    
    let md = '## Database Migrations\n\n';
    md += '| Migration File | Description |\n';
    md += '|----------------|-------------|\n';
    
    migrations.forEach(migration => {
      md += `| ${migration.file} | ${migration.description} |\n`;
    });
    
    md += '\n';
    return md;
  }

  private formatWebSockets(gateways: SocketGatewayInfo[]): string {
    if (!gateways || gateways.length === 0) return 'No WebSocket gateways found.\n\n';
    
    let md = '## WebSocket Gateways\n\n';
    
    gateways.forEach(gateway => {
      md += `### ${gateway.name}\n`;
      md += `**Type**: ${gateway.type === 'cqrs-websocket' ? 'CQRS Event Bus' : 'Standard'}\n`;
      md += `**Namespace**: ${gateway.namespace}\n`;
      md += `**File**: ${gateway.path}\n\n`;
      
      if (gateway.type === 'cqrs-websocket') {
        md += '**CQRS Events**:\n';
        md += '- Commands\n';
        md += '- Queries\n';
        md += '- Events\n\n';
      }
    });
    
    return md;
  }
}
