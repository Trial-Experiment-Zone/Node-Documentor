import { Injectable } from '@nestjs/common';
import {
  Document,
  Paragraph,
  HeadingLevel,
  TableOfContents,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import {
  ParsedProjectData,
  ClassInfo,
  FunctionInfo,
  MethodInfo,
  IdentifiedFlow,
} from '../common/types';
import { BorderStyle, TextRun } from 'docx';

@Injectable()
export class DocxGeneratorService {
  async generate(
    projectName: string,
    data: ParsedProjectData,
    folderTree: string,
    erdMermaidCode: string,
    apiDocs: any[],
    flows: IdentifiedFlow[],
  ): Promise<Document> {
    const titlePage = [
      new Paragraph({
        text: 'Project Documentation',
        heading: HeadingLevel.TITLE,
        spacing: { after: 400 },
      }),
      new Paragraph({
        text: `Project: ${projectName}`,
        style: 'IntenseQuote',
        spacing: { after: 200 },
      }),
      new Paragraph({
        text: `Generated on: ${new Date().toLocaleDateString()}`,
        style: 'IntenseQuote',
      }),
    ];

    const tableOfContents = [
      new Paragraph({
        text: 'Table of Contents',
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
      }),
      new TableOfContents('Table of Contents', {
        hyperlink: true,
        headingStyleRange: '1-3',
      }),
    ];

    const folderStructureSection = [
      new Paragraph({
        text: 'Folder Structure',
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
      }),
      new Paragraph({ text: folderTree, style: 'Courier' }),
    ];

    const dbSchemaSection = [
       new Paragraph({
        text: 'Database Schema',
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
      }),
      ...(erdMermaidCode
        ? [
            new Paragraph({
              text: 'Mermaid ER Diagram Syntax',
              heading: HeadingLevel.HEADING_2,
            }),
            ...erdMermaidCode
              .split('\n')
              .map((line) => new Paragraph({ text: line, style: 'Courier' })),
            new Paragraph({
              text: '(Paste into https://mermaid.live to visualize)',
              style: 'IntenseQuote',
            }),
          ]
        : [new Paragraph('No relationships found.')]),
      ...this.formatDatabaseTables(data.entities),
    ];

    const classDetailsSection = [
      new Paragraph({
        text: 'Class & Function Details',
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
      }),
      ...this.formatClasses(data.classes),
      ...this.formatFunctions(data.functions),
    ];

    const apiEndpointsSection = [
      new Paragraph({
        text: 'API Endpoints',
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
      }),
      ...this.formatApiDocs(apiDocs),
    ];

    const projectFlowsSection = [
       new Paragraph({
        text: 'Project Flows',
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
      }),
      ...this.formatFlows(flows),
    ];

    return new Document({
      features: { updateFields: true },
      sections: [
        {
          children: [
            ...titlePage,
            ...tableOfContents,
            ...folderStructureSection,
            ...dbSchemaSection,
            ...classDetailsSection,
            ...apiEndpointsSection,
            ...projectFlowsSection,
          ],
        },
      ],
      styles: {
        paragraphStyles: [
          {
            id: 'Courier',
            name: 'Courier',
            basedOn: 'Normal',
            next: 'Normal',
            run: { font: { name: 'Courier New' } },
          },
          {
            id: 'IntenseQuote',
            name: 'Intense Quote',
            basedOn: 'Normal',
            next: 'Normal',
            run: { italics: true, color: '666666' },
          },
        ],
      },
    });
  }

  private formatFlows(flows: IdentifiedFlow[]): Paragraph[] {
    if (!flows || flows.length === 0) {
      return [new Paragraph('No specific project flows were identified.')];
    }

    const paragraphs: Paragraph[] = [];
    const flowsByKeyword: Record<string, IdentifiedFlow[]> = {};

    // Group flows by keyword
    for (const flow of flows) {
      if (!flowsByKeyword[flow.keyword]) {
        flowsByKeyword[flow.keyword] = [];
      }
      flowsByKeyword[flow.keyword].push(flow);
    }

    for (const keyword in flowsByKeyword) {
      paragraphs.push(
        new Paragraph({
          text: `Flow: ${keyword}`,
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph('The following files appear to be related to this flow:'),
      );
      for (const flow of flowsByKeyword[keyword]) {
        paragraphs.push(
          new Paragraph({
            text: `- ${flow.filePath}`,
            bullet: { level: 0 },
            style: 'Courier',
          }),
        );
      }
    }

    return paragraphs;
  }



  private formatDatabaseTables(entities: ClassInfo[]): (Paragraph | Table)[] {
    if (!entities || entities.length === 0) return [];

    const elements: (Paragraph | Table)[] = [];

    entities.forEach((entity) => {
      elements.push(
        new Paragraph({
          text: `Entity: ${entity.name}`,
          heading: HeadingLevel.HEADING_2,
        }),
      );

      const tableRows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('Column')] }),
            new TableCell({ children: [new Paragraph('Type')] }),
            new TableCell({ children: [new Paragraph('Decorators')] }),
          ],
        }),
      ];

      entity.properties?.forEach((prop) => {
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(prop.name || '')] }),
              new TableCell({ children: [new Paragraph(prop.type || '')] }),
              new TableCell({
                children: [
                  new Paragraph((prop.decorators || []).join(', ') || ''),
                ],
              }),
            ],
          }),
        );
      });

      elements.push(
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            insideHorizontal: {
              style: BorderStyle.SINGLE,
              size: 1,
              color: '000000',
            },
            insideVertical: {
              style: BorderStyle.SINGLE,
              size: 1,
              color: '000000',
            },
          },
        }),
      );
    });

    return elements;
  }

  private formatClasses = (items: ClassInfo[]) =>
    this.formatItems(items, 'Class');

  private formatFunctions = (items: FunctionInfo[]) =>
    this.formatItems(items, 'Function');

  private formatItems(
    items: (ClassInfo | FunctionInfo)[],
    type: 'Class' | 'Function',
  ): Paragraph[] {
    const elements: Paragraph[] = [];

    if (!items || items.length === 0) return elements;

    items.forEach((item) => {
      elements.push(
        new Paragraph({
          text: `${type}: ${item.name}`,
          heading: HeadingLevel.HEADING_2,
        }),
      );

      item.docs?.split('\n').forEach((line: string) => {
        if (line.startsWith('```json') || line.startsWith('```')) return;

        const style =
          line.startsWith('{') || line.startsWith('  ') || line.startsWith('}')
            ? 'Courier'
            : undefined;

        elements.push(new Paragraph({ text: line, style }));
      });

      if ('methods' in item && Array.isArray(item.methods)) {
        item.methods.forEach((method: MethodInfo) => {
          elements.push(
            new Paragraph({
              text: `Method: ${method.name}`,
              heading: HeadingLevel.HEADING_3,
            }),
          );

          method.docs?.split('\n').forEach((line: string) => {
            if (line.startsWith('```json') || line.startsWith('```')) return;

            const style =
              line.startsWith('{') ||
              line.startsWith('  ') ||
              line.startsWith('}')
                ? 'Courier'
                : undefined;

            elements.push(new Paragraph({ text: line, style }));
          });
        });
      }
    });

    return elements;
  }

  private formatApiDocs(apiDocs: any[]): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    for (const doc of apiDocs) {
      paragraphs.push(
        new Paragraph({
          text: `Endpoint: ${doc.route}`,
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          text: `Controller: ${doc.controller} → Method: ${doc.methodName}`,
          style: 'IntenseQuote',
        }),
      );

      const paramKeys = Object.keys(doc.requestParams || {});
      if (paramKeys.length > 0) {
        paragraphs.push(new Paragraph({ text: 'Request Params:' }));
        for (const key of paramKeys) {
          const param = doc.requestParams[key];
          if (param?.fields) {
            paragraphs.push(
              new Paragraph({
                text: `- ${key}: ${param.name}`,
                style: 'Courier',
              }),
            );
            paragraphs.push(...this.renderFields(param.fields, 2));
          } else {
            paragraphs.push(
              new Paragraph({
                text: `- ${key}: ${param?.name || 'unknown'} (${param?.type || 'unknown'})`,
                style: 'Courier',
              }),
            );
          }
        }
      }

      if (doc.responseDto?.fields) {
        paragraphs.push(new Paragraph({ text: 'Response:' }));
        paragraphs.push(...this.renderFields(doc.responseDto.fields, 1));
      }

      paragraphs.push(new Paragraph('')); // spacing
    }

    return paragraphs;
  }

  private renderFields(
    fields: Record<string, any>,
    indent = 1,
    seen: Set<string> = new Set(),
  ): Paragraph[] {
    const result: Paragraph[] = [];

    for (const [key, val] of Object.entries(fields)) {
      const prefix = '  '.repeat(indent);

      // Case 1: Plain string (type info)
      if (typeof val === 'string') {
        result.push(
          new Paragraph({
            text: `${prefix}- ${key}: ${val}`,
            style: 'Courier',
          }),
        );
        continue;
      }

      if (
        val &&
        typeof val === 'object' &&
        val.type === 'enum' &&
        Array.isArray(val.values)
      ) {
        result.push(
          new Paragraph({
            text: `${prefix}- ${key}: ${val.name} (enum)`,
            style: 'Courier',
          }),
        );
        for (const member of val.values) {
          result.push(
            new Paragraph({
              text: `${prefix}  • ${member}`,
              style: 'Courier',
            }),
          );
        }
        continue;
      }

      // Case 2: Fully resolved object with name + fields (recurse)
      if (
        val &&
        typeof val === 'object' &&
        typeof val.name === 'string' &&
        typeof val.fields === 'object'
      ) {
        const signature = `${val.name}-${key}`;
        if (seen.has(signature)) {
          result.push(
            new Paragraph({
              text: `${prefix}- ${key}: ${val.name} (circular ref)`,
              style: 'Courier',
            }),
          );
          continue;
        }

        result.push(
          new Paragraph({
            text: `${prefix}- ${key}: ${val.name}`,
            style: 'Courier',
          }),
        );
        seen.add(signature);
        result.push(...this.renderFields(val.fields, indent + 1, seen));
        continue;
      }

      // Case 3: Raw object (best-effort stringify)
      // Case 3: Raw object (pretty JSON)
      if (val && typeof val === 'object') {
        try {
          const prettyLines = JSON.stringify(val, null, 2).split('\n');
          result.push(
            new Paragraph({ text: `${prefix}- ${key}:`, style: 'Courier' }),
          );
          for (const line of prettyLines) {
            result.push(
              new Paragraph({ text: `${prefix}  ${line}`, style: 'Courier' }),
            );
          }
        } catch {
          result.push(
            new Paragraph({
              text: `${prefix}- ${key}: [Unserializable Object]`,
              style: 'Courier',
            }),
          );
        }
        continue;
      }

      // Fallback
      result.push(
        new Paragraph({
          text: `${prefix}- ${key}: ${String(val)}`,
          style: 'Courier',
        }),
      );
    }

    return result;
  }
}
