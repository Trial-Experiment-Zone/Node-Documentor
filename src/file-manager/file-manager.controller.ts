import { Controller, Get, Query, Param, Delete, Patch, Body, BadRequestException } from '@nestjs/common';
import { FileManagerService } from './file-manager.service';

class RenameDto {
  oldPath: string;
  newPath: string;
}

@Controller('file-manager')
export class FileManagerController {
  constructor(private readonly fileManagerService: FileManagerService) {}

  @Get('list')
  listFiles(@Query('folder') folder: string) {
    return this.fileManagerService.listFiles(folder || '');
  }

  @Get('content')
  getFileContent(@Query('file') file: string) {
    if (!file) throw new BadRequestException('Missing file param');
    return this.fileManagerService.getFileContent(file);
  }

  @Delete('file')
  deleteFile(@Query('file') file: string) {
    if (!file) throw new BadRequestException('Missing file param');
    return this.fileManagerService.deleteFile(file);
  }

  @Delete('folder')
  deleteFolder(@Query('folder') folder: string) {
    if (!folder) throw new BadRequestException('Missing folder param');
    return this.fileManagerService.deleteFolder(folder);
  }

  @Patch('rename')
  rename(@Body() dto: RenameDto) {
    if (!dto.oldPath || !dto.newPath) throw new BadRequestException('Missing oldPath or newPath');
    return this.fileManagerService.renamePath(dto.oldPath, dto.newPath);
  }
}

