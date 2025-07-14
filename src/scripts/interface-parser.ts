import * as path from 'path';
import { Project, ClassDeclaration, Decorator, Type, Node, PropertyDeclaration } from 'ts-morph';
import { ClassInfo, PropertyInfo, EntityRelationship } from '../common/types';

// --- Configuration ---
const ENTITY_DECORATORS = ['Entity', 'Schema'];
const RELATIONSHIP_DECORATORS = [
  'OneToOne',
  'OneToMany',
  'ManyToOne',
  'ManyToMany',
];

// --- Main Logic ---

function main() {
  const project = new Project({
    tsConfigFilePath: path.join(process.cwd(), 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true, // We will add files manually
  });
  project.addSourceFilesAtPaths('src/**/*.ts');

  const entities: ClassInfo[] = [];
  const relationships: EntityRelationship[] = [];

  const sourceFiles = project.getSourceFiles();

  for (const file of sourceFiles) {
    const classes = file.getClasses();
    for (const classDeclaration of classes) {
      const entityDecorator = classDeclaration
        .getDecorators()
        .find((d) => ENTITY_DECORATORS.includes(d.getName()));

      if (entityDecorator) {
        const entityInfo = parseEntity(classDeclaration);
        entities.push(entityInfo);

        const entityRelationships = parseRelationships(classDeclaration);
        relationships.push(...entityRelationships);
      }
    }
  }

  console.log(JSON.stringify({ entities, relationships }, null, 2));
}

// --- Parsers ---

function parseEntity(classDeclaration: ClassDeclaration): ClassInfo {
  const properties: PropertyInfo[] = classDeclaration
    .getProperties()
    .map((prop) => {
      return {
        name: prop.getName(),
        type: prop.getType().getText(prop),
        decorators: prop.getDecorators().map((d) => d.getText()),
      };
    });

  return {
    name: classDeclaration.getName(),
    filePath: classDeclaration.getSourceFile().getFilePath(),
    docs: 'Parsed from TypeScript class decorator',
    methods: [], // Method parsing can be added here if needed
    properties,
  };
}

function parseRelationships(
  classDeclaration: ClassDeclaration,
): EntityRelationship[] {
  const relationships: EntityRelationship[] = [];
  const sourceEntityName = classDeclaration.getName() ?? 'UnknownEntity';

  for (const prop of classDeclaration.getProperties()) {
    // --- Strategy 1: Decorator-based relationships (TypeORM, etc.) ---
    const relDecorator = prop
      .getDecorators()
      .find((d) => RELATIONSHIP_DECORATORS.includes(d.getName()));

    if (relDecorator) {
      const relationshipType =
        relDecorator.getName() as EntityRelationship['type'];
      const typeArg = relDecorator.getArguments()[0];
      if (!typeArg) continue;

      let targetEntityType: Type | undefined;
      if (Node.isArrowFunction(typeArg)) {
        targetEntityType = typeArg.getReturnType();
      } else {
        targetEntityType = typeArg.getType();
      }
      
      if (!targetEntityType) continue;

      const targetEntityName =
        targetEntityType.getSymbol()?.getName() ?? 'UnknownTarget';

      relationships.push({
        from: sourceEntityName,
        to: targetEntityName,
        type: relationshipType,
      });
      continue; 
    }

    // --- Strategy 2: @Prop with `ref` (Mongoose) ---
    const propDecorator = prop.getDecorator('Prop');
    if (propDecorator) {
      const propArgs = propDecorator.getArguments()[0];
      if (propArgs && Node.isObjectLiteralExpression(propArgs)) {
        const refProperty = propArgs.getProperty('ref');
        if (refProperty && Node.isPropertyAssignment(refProperty)) {
          const refInitializer = refProperty.getInitializer();
          if (refInitializer) {
            // Handle both string literal refs and identifier refs (e.g., ref: 'User' or ref: User.name)
            let targetEntityName = '';
            if (Node.isStringLiteral(refInitializer)) {
              targetEntityName = refInitializer.getLiteralText();
            } else if (Node.isPropertyAccessExpression(refInitializer)) {
              targetEntityName = refInitializer.getExpression().getText();
            } else {
              targetEntityName = refInitializer.getText();
            }
            
            const isArray = prop.getType().isArray();
            const relationshipType = isArray ? 'OneToMany' : 'ManyToOne';

            relationships.push({
              from: sourceEntityName,
              to: targetEntityName,
              type: relationshipType,
            });
          }
        }
      }
    }
  }

  return relationships;
}

// --- Execution ---

try {
  main();
} catch (error) {
  console.error('Failed to parse project:', error);
  process.exit(1);
}
