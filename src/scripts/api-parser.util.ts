import * as path from 'path';
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

export function generateApiDoc(projectPath: string): any[] {
  const project = new Project({
    tsConfigFilePath: path.join(projectPath, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: false,
  });

  // ✅ Force load DTOs
  project.addSourceFilesAtPaths(path.join(projectPath, 'src/**/*.ts'));

  const sourceFiles = project.getSourceFiles(
    path.join(projectPath, 'src/**/*.ts'),
  );

  const httpMethods = ['Get', 'Post', 'Put', 'Delete', 'Patch'];
  const controllers: any[] = [];

  sourceFiles.forEach((file) => {
    const controllerClass = file
      .getClasses()
      .find((cls) =>
        cls.getDecorators().some((d) => d.getName() === 'Controller'),
      );
    if (!controllerClass) return;

    const baseRoute =
      controllerClass
        .getDecorator('Controller')
        ?.getArguments()[0]
        ?.getText()
        ?.replace(/['"]/g, '') || '';

    controllerClass.getMethods().forEach((method) => {
      const routeDecorator = method
        .getDecorators()
        .find((d) => httpMethods.includes(d.getName()));
      if (!routeDecorator) return;

      const httpMethod = routeDecorator.getName().toUpperCase();
      const route =
        routeDecorator.getArguments()[0]?.getText().replace(/['"]/g, '') || '';

      const fullRoute = `${httpMethod} ${baseRoute}${route.startsWith('/') ? '' : '/'}${route}`;
      const methodName = method.getName();

      const requestParams: Record<string, any> = {};

      method.getParameters().forEach((param) => {
        const decorator = param.getDecorators()[0];
        if (!decorator) return;

        const decoratorName = decorator.getName(); // Body, Param, Query, etc.
        const type = param.getType();
        const resolved = extractTypeFieldsByType(
          project,
          type,
          new Set<string>(),
          projectPath,
        );

        if (resolved) {
          requestParams[decoratorName.toLowerCase()] = resolved;
        } else {
          requestParams[decoratorName.toLowerCase()] = {
            name: param.getName(),
            type: type.getText(),
          };
        }
      });

      const returnType = method.getReturnType();
      const unwrapped = returnType.getTypeArguments()?.[0] || returnType;
      const responseDto = extractTypeFieldsByType(
        project,
        unwrapped,
        new Set<string>(),
        projectPath,
      );

      controllers.push({
        controller: controllerClass.getName(),
        route: fullRoute,
        methodName,
        requestParams,
        responseDto,
      });
    });
  });

  return controllers;
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
