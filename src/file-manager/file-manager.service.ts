import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileManagerService {
  baseDir = path.resolve(process.cwd(), 'output'); // You can change this to your docs root

  listFiles(folder: string) {
    const targetFolder = path.join(this.baseDir, folder || '');
    if (!fs.existsSync(targetFolder) || !fs.statSync(targetFolder).isDirectory()) {
      throw new NotFoundException('Folder not found');
    }
    return fs.readdirSync(targetFolder).map(name => {
      const fullPath = path.join(targetFolder, name);
      const stat = fs.statSync(fullPath);
      return {
        name,
        isDirectory: stat.isDirectory(),
        size: stat.size,
        mtime: stat.mtime,
        path: path.relative(this.baseDir, fullPath),
      };
    });
  }

  getFileContent(file: string) {
    const filePath = path.join(this.baseDir, file);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new NotFoundException('File not found');
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return data;
  }

  deleteFile(file: string) {
    const filePath = path.join(this.baseDir, file);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new NotFoundException('File not found');
    }
    fs.unlinkSync(filePath);
    return { success: true };
  }

  deleteFolder(folder: string) {
    const folderPath = path.join(this.baseDir, folder);
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      throw new NotFoundException('Folder not found');
    }
    fs.rmSync(folderPath, { recursive: true, force: true });
    return { success: true };
  }

  renamePath(oldPath: string, newPath: string) {
    const oldFullPath = path.join(this.baseDir, oldPath);
    const newFullPath = path.join(this.baseDir, newPath);
    if (!fs.existsSync(oldFullPath)) {
      throw new NotFoundException('Source not found');
    }
    if (fs.existsSync(newFullPath)) {
      throw new BadRequestException('Destination already exists');
    }
    fs.renameSync(oldFullPath, newFullPath);
    return { success: true };
  }
}

