import { Module } from '@nestjs/common';
import { DocumentationController } from './documentation.controller';
import { DocumentationService } from './documentation.service';
import { MarkdownGeneratorService } from '../generators/markdown-generator.service';
import { ErdGeneratorService } from '../generators/erd-generator.service';
import { PythonApiParserService } from 'src/scripts/python-api-parser.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [DocumentationController],
  providers: [
    DocumentationService,
    MarkdownGeneratorService,
    ErdGeneratorService,
    PythonApiParserService,
  ],
  exports: [DocumentationService],
})
export class DocumentationModule {}
