import * as fs from 'fs';
import * as path from 'path';
import { findFiles } from '../../shared/file-utils';
import { ParsedProjectData } from '../../common/types';

export interface MongoSchema extends ParsedProjectData {
  fields: Record<string, {
    type: string;
    required?: boolean;
    default?: any;
    unique?: boolean;
    index?: boolean;
  }>;
  indexes?: string[];
  timestamps?: boolean;
  cqrsType?: string;
  connectionString?: string;
}

export function parseMongoSchemas(projectPath: string): MongoSchema[] {
  const schemas: MongoSchema[] = [];
  
  // Find MongoDB connection configuration
  const configFiles = findFiles(projectPath, /(config|database)\.(ts|js)$/)
    .filter(file => !file.includes('node_modules'));
    
  configFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Detect MongoDB connection strings
    if (content.includes('mongodb://') || 
        content.includes('mongodb+srv://') ||
        content.includes('MongooseModule.forRoot')) {
      schemas.push({
        name: 'MongoDB Connection',
        path: path.relative(projectPath, file),
        type: 'mongodb-connection',
        fields: {},
        connectionString: content.match(/mongodb(\+srv)?:\/\/[^'"\s]+/)?.[0] || 'hidden'
      });
    }
  });
  
  // Find model files (common patterns)
  const modelFiles = findFiles(projectPath, /(model|schema)\.(ts|js)$/);
  
  modelFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    let currentSchema: MongoSchema | null = null;
    
    lines.forEach(line => {
      // Mongoose schema detection
      const schemaMatch = line.match(/const\s+(\w+)Schema\s*=\s*new\s+Schema\(/);
      if (schemaMatch) {
        currentSchema = {
          name: schemaMatch[1].replace('Schema', ''),
          path: path.relative(projectPath, file),
          type: 'mongo-schema',
          fields: {},
          indexes: []
        };
        return;
      }
      
      // TypeORM MongoDB entity detection
      const entityMatch = line.match(/@Entity\(.*?\)\s*class\s+(\w+)/);
      if (entityMatch && line.includes('mongodb')) {
        currentSchema = {
          name: entityMatch[1],
          path: path.relative(projectPath, file),
          type: 'mongo-schema',
          fields: {},
          indexes: []
        };
        return;
      }
      
      // Field parsing
      if (currentSchema) {
        parseMongoField(line, currentSchema);
      }
    });
    
    if (currentSchema) {
      schemas.push(currentSchema);
    }
  });
  
  // Find CQRS files (common patterns)
  const cqrsFiles = findFiles(projectPath, /(command|query|event)\.(ts|js)$/);

  cqrsFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Detect command handlers
    if (content.includes('@CommandHandler') || 
        content.includes('implements ICommandHandler')) {
      const match = content.match(/class\s+(\w+)/);
      if (match) {
        schemas.push({
          name: match[1],
          path: path.relative(projectPath, file),
          type: 'cqrs-command',
          fields: {},
          cqrsType: 'command'
        });
      }
    }
    
    // Detect query handlers
    if (content.includes('@QueryHandler') || 
        content.includes('implements IQueryHandler')) {
      const match = content.match(/class\s+(\w+)/);
      if (match) {
        schemas.push({
          name: match[1],
          path: path.relative(projectPath, file),
          type: 'cqrs-query',
          fields: {},
          cqrsType: 'query'
        });
      }
    }
  });
  
  return schemas;
}

function parseMongoField(line: string, schema: MongoSchema) {
  // Mongoose field parsing
  const mongooseField = line.match(/(\w+):\s*\{.*?type:\s*(\w+).*?\}/);
  if (mongooseField) {
    const [_, name, type] = mongooseField;
    schema.fields[name] = { type };
    if (line.includes('required:')) schema.fields[name].required = true;
    if (line.includes('default:')) schema.fields[name].default = true;
    if (line.includes('unique:')) schema.fields[name].unique = true;
    return;
  }
  
  // TypeORM MongoDB field parsing
  const typeormField = line.match(/@(?:Column|Field)\(.*?\)\s*(?:readonly\s+)?(\w+)/);
  if (typeormField) {
    const name = typeormField[1];
    const typeMatch = line.match(/type:\s*([^,\}]+)/);
    schema.fields[name] = {
      type: typeMatch?.[1].trim() || 'unknown'
    };
  }
}
