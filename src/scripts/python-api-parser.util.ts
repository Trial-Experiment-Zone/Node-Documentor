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

function findPythonFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (
        stat.isDirectory() &&
        !item.startsWith('.') &&
        item !== '__pycache__'
      ) {
        traverse(fullPath);
      } else if (item.endsWith('.py')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function parsePythonFile(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const endpoints: any[] = [];

  // Parse different Python web frameworks
  const flaskEndpoints = parseFlaskEndpoints(content, filePath);
  const fastApiEndpoints = parseFastApiEndpoints(content, filePath);
  const djangoEndpoints = parseDjangoEndpoints(content, filePath);

  endpoints.push(...flaskEndpoints, ...fastApiEndpoints, ...djangoEndpoints);

  return endpoints;
}

function parseFlaskEndpoints(content: string, filePath: string): any[] {
  const endpoints: any[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Flask route decorator pattern: @app.route('/path', methods=['GET'])
    const routeMatch = line.match(
      /@(?:app|bp|blueprint)\.route\s*\(\s*['"]([^'"]+)['"](?:.*methods\s*=\s*\[([^\]]+)\])?/,
    );

    if (routeMatch) {
      const route = routeMatch[1];
      const methods = routeMatch[2]
        ? routeMatch[2]
            .split(',')
            .map((m) => m.trim().replace(/['"]/g, '').toUpperCase())
        : ['GET'];

      // Find the function definition
      let functionName = '';
      let functionParams: any = {};
      let docstring = '';

      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        const funcMatch = nextLine.match(/^def\s+(\w+)\s*\(([^)]*)\)/);

        if (funcMatch) {
          functionName = funcMatch[1];
          const params = funcMatch[2];
          functionParams = parseFlaskParams(params);

          // Extract docstring if present
          if (j + 1 < lines.length && lines[j + 1].trim().startsWith('"""')) {
            docstring = extractDocstring(lines, j + 1);
          }
          break;
        }
      }

      methods.forEach((method) => {
        endpoints.push({
          controller: path.basename(filePath, '.py'),
          route: `${method} ${route}`,
          methodName: functionName,
          requestParams: functionParams,
          responseDto: parseFlaskResponse(content, functionName),
          docstring,
          framework: 'flask',
        });
      });
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

  // Django URL patterns are typically in urls.py files
  if (path.basename(filePath) === 'urls.py') {
    const lines = content.split('\n');

    for (const line of lines) {
      const urlMatch = line.match(
        /path\s*\(\s*['"]([^'"]+)['"].*?(\w+)\.(\w+)/,
      );

      if (urlMatch) {
        const route = urlMatch[1];
        const viewModule = urlMatch[2];
        const viewFunction = urlMatch[3];

        endpoints.push({
          controller: viewModule,
          route: `* /${route}`, // Django doesn't specify HTTP method in URL patterns
          methodName: viewFunction,
          requestParams: {},
          responseDto: null,
          framework: 'django',
        });
      }
    }
  }

  return endpoints;
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
