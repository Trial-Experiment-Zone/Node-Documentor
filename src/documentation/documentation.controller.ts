import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  HttpStatus,
  NotFoundException,
  Query,
  Delete,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { DocumentationService } from './documentation.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateDocumentationDto } from 'src/dtos/create-documentation.dto';
import * as fs from 'fs';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as path from 'path';

type UploadedFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

@ApiTags('Documentation')
@Controller('documentation')
export class DocumentationController {
  constructor(private readonly documentationService: DocumentationService) {}

  @Get('files')
  @ApiOperation({ summary: 'Get list of generated documentation files' })
  @ApiResponse({ status: 200, description: 'Files retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Output directory not found' })
  async getOutputFiles(@Res() res: Response) {
    try {
      const files = await this.documentationService.getOutputFiles();
      return res.status(HttpStatus.OK).json(files);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return res.status(HttpStatus.NOT_FOUND).json({
          message: error.message,
        });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to retrieve files',
      });
    }
  }

  @Get('file')
  @ApiOperation({ summary: 'Get content of a documentation file' })
  async getFileContent(@Res() res: Response, @Query('path') path: string) {
    try {
      const content = await fs.promises.readFile(path, 'utf-8');
      return res.status(HttpStatus.OK).send(content);
    } catch (error) {
      console.log('Error reading file:', error);
      return res.status(HttpStatus.NOT_FOUND).json({
        message: 'File not found',
      });
    }
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Generate a Markdown documentation file for a project folder',
  })
  async generateDocumentation(
    @Body() createDocumentationDto: CreateDocumentationDto,
    @Res() res: Response,
  ) {
    try {
      const buffer = await this.documentationService.generateDocumentation(
        createDocumentationDto.projectPath,
      );

      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=documentation.md',
      );
      res.status(HttpStatus.CREATED).send(buffer);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: 'Failed to generate document', error: errorMessage });
    }
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload project files' })
  @UseInterceptors(FilesInterceptor('files'))
  async uploadFiles(
    @UploadedFiles() files: UploadedFile[],
    @Res() res: Response,
  ) {
    try {
      if (!files || !files.length) {
        throw new BadRequestException('No files uploaded');
      }

      const outputDir = path.join(process.cwd(), 'docs');
      await fs.promises.mkdir(outputDir, { recursive: true });

      await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(outputDir, file.originalname);
          await fs.promises.writeFile(filePath, file.buffer);
        }),
      );

      return res.status(HttpStatus.OK).json({
        message: 'Files uploaded successfully',
      });
    } catch (error) {
      console.error('Upload error:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to upload files',
      });
    }
  }

  @Delete('file')
  @ApiOperation({ summary: 'Delete a documentation file' })
  async deleteFile(@Res() res: Response, @Query('path') path: string) {
    try {
      await fs.promises.unlink(path);
      return res.status(HttpStatus.OK).json({
        message: 'File deleted successfully',
      });
    } catch (error) {
      console.log('Error deleting file:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to delete file',
      });
    }
  }
}
