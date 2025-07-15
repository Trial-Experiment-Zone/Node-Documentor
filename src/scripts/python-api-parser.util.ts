import { findPythonFiles } from '../shared/file-utils';
import * as path from 'path';
import * as fs from 'fs';
import { Node, Project, SyntaxKind, Type } from 'ts-morph';

const IGNORED_TYPES = new Set([
  'Blob',
  'Promise',
  'Date',
  'File',
  'Response',
  'Request',
  'ParamsDictionary',
  'StreamableFile',
]);

export function generatePythonApiDoc(projectPath: string): any[] {
  const controllers: any[] = [];

  try {
    // Common Python web framework patterns
    const possiblePaths = [
      path.join(projectPath, 'app'),
      path.join(projectPath, 'src'),
      path.join(projectPath, 'api'),
      projectPath,
    ];

    for (const searchPath of possiblePaths) {
      if (fs.existsSync(searchPath)) {
        const pythonFiles = findPythonFiles(searchPath);

        for (const filePath of pythonFiles) {
          const endpoints = parsePythonFile(filePath);
          controllers.push(...endpoints);
        }
      }
    }
  } catch (error) {
    console.error(`Error generating Python API docs: ${error}`);
  }

  return controllers;
}

function parsePythonFile(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const endpoints: any[] = [];

  if (filePath.includes('urls.py') || filePath.includes('/urls/')) {
    endpoints.push(...parseDjangoEndpoints(content, filePath));
  }
  
  if (filePath.endsWith('models.py')) {
    endpoints.push(...parseDjangoModels(content, filePath));
    endpoints.push(...parseSqlAlchemyModels(content, filePath));
  }

  // Existing parsing for other frameworks
  const flaskEndpoints = parseFlaskEndpoints(content, filePath);
  const fastApiEndpoints = parseFastApiEndpoints(content, filePath);
  
  endpoints.push(...flaskEndpoints, ...fastApiEndpoints);
  return endpoints;
}

function parseFlaskEndpoints(content: string, filePath: string): any[] {
  const endpoints: any[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Modern Flask route decorator pattern
    const methodRouteMatch = line.match(
      /@(\w+)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/,
    );
    if (methodRouteMatch) {
      const route = methodRouteMatch[3];
      const methods = [methodRouteMatch[2].toUpperCase()];

      // Parse route parameters (e.g. <int:id>)
      const routeParams: any[] = [];
      const paramMatches = route.matchAll(/<([^:>]+:)?([^>]+)>/g);
      for (const match of paramMatches) {
        routeParams.push({
          name: match[2],
          type: match[1] ? match[1].replace(':', '') : 'string',
          in: 'path',
        });
      }

      // Find the function definition
      let functionName = '';
      let functionParams: any = {};
      let docstring = '';

      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        const funcMatch = nextLine.match(/^def\s+(\w+)\s*\(([^)]*)\)/);

        if (funcMatch) {
          functionName = funcMatch[1];
          functionParams = parseFlaskParams(funcMatch[2]);

          // Extract docstring if present
          if (j + 1 < lines.length && lines[j + 1].trim().startsWith('"""')) {
            docstring = extractDocstring(lines, j + 1);
          }

          // Analyze function body
          const responseType = content.includes('jsonify(')
            ? 'json'
            : 'unknown';
          const requestBody = content.includes('request.json')
            ? 'json'
            : content.includes('request.form')
              ? 'form-data'
              : content.includes('request.files')
                ? 'file-upload'
                : null;

          endpoints.push({
            controller: path.basename(filePath, '.py'),
            route: `${methods.join(',')} ${route}`,
            methodName: functionName,
            requestParams: {
              ...functionParams,
              ...Object.fromEntries(routeParams.map((p) => [p.name, p])),
            },
            responseDto: { type: responseType },
            docstring,
            framework: 'flask',
            requestBody,
            statusCodes: [200], // Default, can be enhanced
          });
          break;
        }
      }
      continue;
    }

    // Traditional Flask route decorator pattern
    const routeMatch = line.match(
      /@(\w+)\.route\s*\(\s*['"]([^'"]+)['"](?:.*methods\s*=\s*\[([^\]]+)\])?/,
    );
    if (routeMatch) {
      const route = routeMatch[2];
      const methods = routeMatch[3]
        ? routeMatch[3]
            .split(',')
            .map((m) => m.trim().replace(/['"]/g, '').toUpperCase())
        : ['GET'];

      // Parse route parameters (e.g. <int:id>)
      const routeParams: any[] = [];
      const paramMatches = route.matchAll(/<([^:>]+:)?([^>]+)>/g);
      for (const match of paramMatches) {
        routeParams.push({
          name: match[2],
          type: match[1] ? match[1].replace(':', '') : 'string',
          in: 'path',
        });
      }

      // Find the function definition
      let functionName = '';
      let functionParams: any = {};
      let docstring = '';

      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        const funcMatch = nextLine.match(/^def\s+(\w+)\s*\(([^)]*)\)/);

        if (funcMatch) {
          functionName = funcMatch[1];
          functionParams = parseFlaskParams(funcMatch[2]);

          // Extract docstring if present
          if (j + 1 < lines.length && lines[j + 1].trim().startsWith('"""')) {
            docstring = extractDocstring(lines, j + 1);
          }

          // Analyze function body
          const responseType = content.includes('jsonify(')
            ? 'json'
            : 'unknown';
          const requestBody = content.includes('request.json')
            ? 'json'
            : content.includes('request.form')
              ? 'form-data'
              : content.includes('request.files')
                ? 'file-upload'
                : null;

          endpoints.push({
            controller: path.basename(filePath, '.py'),
            route: `${methods.join(',')} ${route}`,
            methodName: functionName,
            requestParams: {
              ...functionParams,
              ...Object.fromEntries(routeParams.map((p) => [p.name, p])),
            },
            responseDto: { type: responseType },
            docstring,
            framework: 'flask',
            requestBody,
            statusCodes: [200], // Default, can be enhanced
          });
          break;
        }
      }
    }
  }

  return endpoints;
}

function parseFastApiEndpoints(content: string, filePath: string): any[] {
  const endpoints: any[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // FastAPI decorator pattern: @app.get("/path"), @app.post("/path"), etc.
    const routeMatch = line.match(
      /@(?:app|router)\.(\w+)\s*\(\s*['"]([^'"]+)['"]/,
    );

    if (routeMatch) {
      const method = routeMatch[1].toUpperCase();
      const route = routeMatch[2];

      // Find the function definition
      let functionName = '';
      let functionParams: any = {};
      let docstring = '';

      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        const funcMatch = nextLine.match(
          /^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/,
        );

        if (funcMatch) {
          functionName = funcMatch[1];
          const params = funcMatch[2];
          functionParams = parseFastApiParams(params);

          // Extract docstring if present
          if (j + 1 < lines.length && lines[j + 1].trim().startsWith('"""')) {
            docstring = extractDocstring(lines, j + 1);
          }
          break;
        }
      }

      endpoints.push({
        controller: path.basename(filePath, '.py'),
        route: `${method} ${route}`,
        methodName: functionName,
        requestParams: functionParams,
        responseDto: parseFastApiResponse(content, functionName),
        docstring,
        framework: 'fastapi',
      });
    }
  }

  return endpoints;
}

function parseDjangoEndpoints(content: string, filePath: string): any[] {
  const endpoints: any[] = [];
  
  // Match both path() and re_path() patterns
  const urlPattern = /(?:path|re_path)\(['"]([^'"]+)['"],\s*([^,)]+)/g;
  
  let match;
  while ((match = urlPattern.exec(content)) !== null) {
    const path = match[1] || '/undefined-path';
    const viewName = match[2].trim();
    
    // Skip if path is empty
    if (!path || path === '/undefined-path') continue;
    
    // Determine HTTP methods
    let methods = ['GET'];
    if (/create|register|add|post/i.test(path)) methods = ['POST'];
    else if (/edit|update|put/i.test(path)) methods = ['PUT', 'PATCH'];
    else if (/delete|remove/i.test(path)) methods = ['DELETE'];
    
    endpoints.push({
      path,
      methods,
      file: filePath,
      framework: 'django',
      parameters: path.match(/<\w+:\w+>/g)?.map(p => ({
        name: p.replace(/[<>]/g, '').split(':')[1],
        type: p.replace(/[<>]/g, '').split(':')[0]
      })) || []
    });
  }
  
  return endpoints;
}

function parseDjangoModels(content: string, filePath: string): any[] {
  const models: any[] = [];
  
  // Skip if not models.py
  if (!filePath.endsWith('models.py')) return models;
  
  const lines = content.split('\n');
  let currentModel: string | null = null;
  let currentFields: Record<string, any> = {};
  
  lines.forEach(line => {
    // Model class detection
    const modelMatch = line.match(/class\s+(\w+)\(\s*models\.Model\):/);
    if (modelMatch) {
      currentModel = modelMatch[1];
      models.push({
        name: currentModel,
        type: 'django-model',
        fields: {},
        file: filePath
      });
      return;
    }
    
    // Field detection
    if (currentModel) {
      const fieldMatch = line.match(/(\w+)\s*=\s*models\.(\w+)\(([^)]*)/);
      if (fieldMatch) {
        const [_, name, type, args] = fieldMatch;
        models.find(m => m.name === currentModel)!.fields[name] = {
          type,
          args: args.split(',').map(a => a.trim()).filter(a => a)
        };
      }
    }
  });
  
  return models;
}

function parseSqlAlchemyModels(content: string, filePath: string): any[] {
  const models: any[] = [];
  const lines = content.split('\n');
  let currentModel: string | null = null;

  // Extended type mapping
  const typeMapping: Record<string, string> = {
    'Integer': 'Integer',
    'String': 'String', 
    'Text': 'Text',
    'DateTime': 'DateTime',
    'Boolean': 'Boolean',
    'Float': 'Float',
    'JSON': 'JSON',
    'ARRAY': 'ARRAY',
    'Enum': 'Enum',
    'LargeBinary': 'LargeBinary'
  };

  lines.forEach(line => {
    // SQLAlchemy model detection
    const modelMatch = line.match(/class\s+(\w+)\(\s*Base\)/);
    if (modelMatch) {
      currentModel = modelMatch[1];
      models.push({
        name: currentModel,
        type: 'sqlalchemy-model',
        fields: {},
        file: filePath
      });
      return;
    }

    // Enhanced field detection
    if (currentModel) {
      const fieldMatch = line.match(/(\w+)\s*=\s*(Column|relationship)\(([^)]*)/);
      if (fieldMatch) {
        const [_, name, decorator, args] = fieldMatch;
        
        // Detect type from args
        let type = 'Unknown';
        for (const [key, value] of Object.entries(typeMapping)) {
          if (args.includes(key)) {
            type = value;
            break;
          }
        }
        
        models.find(m => m.name === currentModel)!.fields[name] = {
          type: decorator === 'relationship' ? 'Relationship' : type,
          args: args.split(',')
            .map(a => a.trim())
            .filter(a => a && !a.includes(type))
        };
      }
    }
  });

  return models;
}

function parseDjangoRestSerializers(content: string, filePath: string): any[] {
  const serializers: any[] = [];

  // Only process files likely to contain serializers
  if (
    !filePath.includes('serializers.py') &&
    !filePath.includes('api/serializers')
  ) {
    return serializers;
  }

  const lines = content.split('\n');
  let currentSerializer: string | null = null;

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || line.trim() === '') continue;

    // Detect serializer class definition
    const serializerMatch = line.match(
      /class\s+(\w+)\(\s*(?:rest_framework\.)?serializers\.(\w+)/,
    );
    if (serializerMatch) {
      currentSerializer = serializerMatch[1];
      serializers.push({
        name: currentSerializer,
        type: 'django-serializer',
        serializerType: serializerMatch[2], // ModelSerializer, Serializer, etc.
        fields: {},
        model: null,
      });
      continue;
    }

    // Parse serializer fields
    if (currentSerializer) {
      const serializer = serializers.find((s) => s.name === currentSerializer);

      // Detect model reference in ModelSerializer
      const modelMatch = line.match(/model\s*=\s*(\w+)/);
      if (modelMatch) {
        serializer.model = modelMatch[1];
      }

      // Parse field definitions
      const fieldMatch = line.match(
        /(\w+)\s*=\s*(?:serializers|fields)\.(\w+)\(([^)]*)\)/,
      );
      if (fieldMatch) {
        const [_, fieldName, fieldType, fieldArgs] = fieldMatch;
        serializer.fields[fieldName] = {
          type: fieldType,
          ...parseFieldArgs(fieldArgs),
        };
      }

      // Parse inline field declarations (e.g., field = CharField())
      const inlineFieldMatch = line.match(/(\w+)\s*=\s*(\w+)\(([^)]*)\)/);
      if (inlineFieldMatch && !line.includes('class ')) {
        const [_, fieldName, fieldType, fieldArgs] = inlineFieldMatch;
        serializer.fields[fieldName] = {
          type: fieldType,
          ...parseFieldArgs(fieldArgs),
        };
      }
    }
  }

  return serializers;
}

function detectAlembicMigrations(projectPath: string): any[] {
  try {
    const migrationFiles = fs.readdirSync(path.join(projectPath, 'alembic/versions'))
      .filter(file => file.endsWith('.py') && file.match(/^\d+_.+\.py$/));
    
    return migrationFiles.map(file => ({
      type: 'alembic-migration',
      file: path.join('alembic/versions', file),
      description: file.split('_').slice(1).join('_').replace('.py', '')
    }));
  } catch {
    return [];
  }
}

function parseFieldArgs(args: string): Record<string, any> {
  const result: Record<string, any> = {};

  // Handle both positional and keyword arguments
  args.split(',').forEach((arg) => {
    arg = arg.trim();
    if (!arg) return;

    // Positional argument (e.g. 'to="app.Model"')
    if (arg.includes('=')) {
      const [key, val] = arg.split('=').map((s) => s.trim());
      result[key] = parseArgValue(val);
    }
    // First positional argument is typically the related model
    else if (!result['to'] && !result['model']) {
      result['to'] = parseArgValue(arg);
    }
  });

  return result;
}

function parseArgValue(val: string): any {
  val = val.replace(/['"]/g, '');

  // Handle boolean values
  if (val === 'True') return true;
  if (val === 'False') return false;

  // Handle numeric values
  if (/^\d+$/.test(val)) return parseInt(val);
  if (/^\d+\.\d+$/.test(val)) return parseFloat(val);

  // Handle None
  if (val === 'None') return null;

  return val;
}

function parseFlaskParams(paramString: string): any {
  const params: any = {};

  if (!paramString.trim()) return params;

  const paramParts = paramString.split(',').map((p) => p.trim());

  for (const param of paramParts) {
    const [name, typeHint] = param.split(':').map((p) => p.trim());
    if (name && !name.startsWith('*')) {
      params[name] = {
        name: name.replace(/\s*=.*$/, ''), // Remove default values
        type: typeHint || 'any',
      };
    }
  }

  return params;
}

function parseFastApiParams(paramString: string): any {
  const params: any = {};

  if (!paramString.trim()) return params;

  const paramParts = paramString.split(',').map((p) => p.trim());

  for (const param of paramParts) {
    // FastAPI parameter patterns: param: Type = Query(), param: Type = Body(), etc.
    const match = param.match(/(\w+)\s*:\s*([^=]+)(?:\s*=\s*(.+))?/);

    if (match) {
      const name = match[1];
      const type = match[2].trim();
      const defaultValue = match[3];

      let paramType = 'query';
      if (defaultValue) {
        if (defaultValue.includes('Body(')) paramType = 'body';
        else if (defaultValue.includes('Path(')) paramType = 'param';
        else if (defaultValue.includes('Query(')) paramType = 'query';
      }

      params[paramType] = params[paramType] || {};
      params[paramType][name] = {
        name,
        type: type.replace(/Optional\[([^\]]+)\]/, '$1 | null'),
      };
    }
  }

  return params;
}

function parseFlaskResponse(content: string, functionName: string): any {
  // Simple heuristic: look for return statements in the function
  const functionMatch = content.match(
    new RegExp(`def\\s+${functionName}[^}]*?return\\s+([^\\n]+)`, 's'),
  );

  if (functionMatch) {
    const returnStatement = functionMatch[1].trim();

    if (returnStatement.includes('jsonify')) {
      return { type: 'json', description: 'JSON response' };
    } else if (returnStatement.includes('render_template')) {
      return { type: 'html', description: 'HTML template' };
    } else {
      return { type: 'unknown', description: returnStatement };
    }
  }

  return null;
}

function parseFastApiResponse(content: string, functionName: string): any {
  // Look for return type annotations
  const functionMatch = content.match(
    new RegExp(`def\\s+${functionName}[^:]*?->\\s*([^:]+):`),
  );

  if (functionMatch) {
    const returnType = functionMatch[1].trim();
    return {
      type: returnType,
      description: `Returns ${returnType}`,
    };
  }

  return null;
}

function extractDocstring(lines: string[], startIndex: number): string {
  let docstring = '';
  let i = startIndex;

  if (lines[i].trim().startsWith('"""')) {
    // Multi-line docstring
    const firstLine = lines[i].trim();
    if (firstLine.endsWith('"""') && firstLine.length > 6) {
      // Single line docstring
      docstring = firstLine.slice(3, -3);
    } else {
      // Multi-line docstring
      i++;
      while (i < lines.length && !lines[i].trim().endsWith('"""')) {
        docstring += lines[i] + '\n';
        i++;
      }
    }
  }

  return docstring.trim();
}

function extractTypeFieldsByType(
  project: Project,
  type: Type,
  visitedTypes = new Set<string>(),
  projectPath: string,
): any | null {
  const typeText = type.getText();
  const symbol = type.getSymbol();
  const typeName = symbol?.getName() ?? typeText;

  if (IGNORED_TYPES.has(typeName)) {
    return null;
  }

  const enumDecl = symbol?.getDeclarations()?.[0];
  if (enumDecl?.getKind() === SyntaxKind.EnumDeclaration) {
    const members = (enumDecl as any)
      .getMembers?.()
      .map((m: any) => m.getName());
    return {
      name: typeName,
      type: 'enum',
      values: members,
    };
  }

  if (visitedTypes.has(typeText)) {
    return { name: typeName, fields: '[Circular Reference]' };
  }

  visitedTypes.add(typeText);

  if (
    type.isStringLiteral() ||
    type.isNumberLiteral() ||
    type.isBooleanLiteral()
  ) {
    return { name: typeText, type: 'literal', value: typeText };
  }

  if (type.getSymbol()?.getName() === 'Date') {
    return { name: 'Date', type: 'primitive' };
  }

  if (['any', 'unknown', '{}'].includes(typeText.trim())) {
    return { name: typeText, type: 'primitive' };
  }

  if (
    type.isString() ||
    type.isNumber() ||
    type.isBoolean() ||
    type.isUndefined() ||
    type.isNull() ||
    type.isVoid() ||
    type.getSymbol()?.getName() === 'File' ||
    type.getText().includes('Express.') ||
    type.getText().startsWith('import("node:')
  ) {
    return null;
  }

  if (type.isUnion()) {
    const unionType = type.getUnionTypes().find((t) => t.getSymbol());
    return unionType
      ? extractTypeFieldsByType(project, unionType, visitedTypes, projectPath)
      : null;
  }

  if (type.isArray()) {
    const elem = type.getArrayElementTypeOrThrow();
    const sub = extractTypeFieldsByType(
      project,
      elem,
      visitedTypes,
      projectPath,
    );
    return sub ? { ...sub, isArray: true } : null;
  }

  if (type.getTypeArguments().length > 0) {
    const inner = type.getTypeArguments()[0];
    return extractTypeFieldsByType(project, inner, visitedTypes, projectPath);
  }

  if (
    type.getText().startsWith('{') &&
    type.isObject() &&
    type.getProperties().length > 0
  ) {
    const fields: Record<string, any> = {};
    for (const prop of type.getProperties()) {
      const propDecl = prop.getValueDeclaration();
      if (!propDecl) continue;
      const propType = propDecl.getType();
      const resolved = extractTypeFieldsByType(
        project,
        propType,
        visitedTypes,
        projectPath,
      );
      fields[prop.getName()] = resolved?.fields ? resolved : propType.getText();
    }

    return {
      name: typeName,
      type: 'inlineObject',
      fields,
    };
  }

  const declaration = symbol?.getDeclarations()?.[0];
  let classDecl;

  if (
    declaration &&
    (Node.isClassDeclaration(declaration) ||
      Node.isInterfaceDeclaration(declaration))
  ) {
    classDecl = declaration;
  }

  // If no direct declaration, it might be an alias from an import.
  // Follow the alias to the original declaration.
  if (!classDecl) {
    const aliasedSymbol = symbol?.getAliasedSymbol();
    if (aliasedSymbol) {
      const originalDeclarations = aliasedSymbol.getDeclarations();
      for (const decl of originalDeclarations) {
        if (
          Node.isClassDeclaration(decl) ||
          Node.isInterfaceDeclaration(decl)
        ) {
          classDecl = decl;
          break;
        }
      }
    }
  }

  if (!classDecl) {
    // This is a soft failure now, we just won't document this DTO fully.
    return { name: typeName, type: 'unresolved' };
  }

  const fields: Record<string, any> = {};
  classDecl.getProperties().forEach((prop) => {
    const name = prop.getName();
    const propType = prop.getType();
    const nested = extractTypeFieldsByType(
      project,
      propType,
      new Set(visitedTypes),
      projectPath,
    );

    fields[name] = nested?.fields ? nested : propType.getText();
  });

  return {
    name: classDecl.getName() || typeText,
    fields,
  };
}
