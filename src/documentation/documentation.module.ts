import { Module } from '@nestjs/common';
import { MarkdownGeneratorService } from '../generators/markdown-generator.service';
import { ErdGeneratorService } from '../generators/erd-generator.service';
import { DocumentationController } from './documentation.controller';
import { DocumentationService } from './documentation.service';

@Module({
  controllers: [DocumentationController],
  providers: [
    DocumentationService,
    ErdGeneratorService,
    MarkdownGeneratorService,
  ],
})
export class DocumentationModule {}
