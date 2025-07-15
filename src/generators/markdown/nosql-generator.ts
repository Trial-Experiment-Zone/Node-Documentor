import { MongoSchema } from '../../parsers/nosql/mongo-parser';

export function formatMongoSchemas(schemas: MongoSchema[]): string {
  if (!schemas || schemas.length === 0) return '';

  let md = '## MongoDB Configuration\n\n';

  // Show connection info first
  const connections = schemas.filter((s) => s.type === 'mongodb-connection');
  if (connections.length > 0) {
    md += '### Database Connections\n';
    connections.forEach((conn) => {
      md += `**File**: ${conn.path}\n`;
      md += `**Connection**: ${conn.connectionString}\n\n`;
    });
  }

  // Rest of existing schema documentation...
  const dataSchemas = schemas.filter((s) => s.type !== 'mongodb-connection');
  if (dataSchemas.length > 0) {
    md += '## NoSQL Database Schemas\n\n';

    dataSchemas.forEach((schema) => {
      md += `### ${schema.name}\n`;
      md += `**File**: ${schema.path}\n\n`;

      if (Object.keys(schema.fields).length > 0) {
        md += '#### Fields\n';
        md += '| Name | Type | Required | Default | Unique |\n';
        md += '|------|------|----------|---------|--------|\n';

        Object.entries(schema.fields).forEach(([name, field]) => {
          md += `| ${name} | ${field.type} | `;
          md += `${field.required ? '✅' : '❌'} | `;
          md += `${field.default ?? '❌'} | `;
          md += `${field.unique ? '✅' : '❌'} |\n`;
        });

        md += '\n';
      }

      if (schema.indexes?.length) {
        md += '#### Indexes\n';
        schema.indexes.forEach((index) => {
          md += `- ${index}\n`;
        });
        md += '\n';
      }
    });
  }

  return md;
}
