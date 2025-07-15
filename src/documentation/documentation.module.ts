import { Module } from '@nestjs/common';
import { MarkdownGeneratorService } from '../generators/markdown-generator.service';
import { ErdGeneratorService } from '../generators/erd-generator.service';
import { DocumentationController } from './documentation.controller';
import { DocumentationService } from './documentation.service';
import { PythonApiParserService } from '../scripts/python-api-parser.service';

@Module({
  controllers: [DocumentationController],
  providers: [
    DocumentationService,
    ErdGeneratorService,
    MarkdownGeneratorService,
    PythonApiParserService,
  ],
  exports: [PythonApiParserService]
})
export class DocumentationModule {}
