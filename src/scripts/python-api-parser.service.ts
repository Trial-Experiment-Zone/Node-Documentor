import { Injectable } from '@nestjs/common';
import { parsePythonApis } from './python-api-parser.util';

@Injectable()
export class PythonApiParserService {
  async parsePythonApis(projectPath: string): Promise<any[]> {
    return parsePythonApis(projectPath);
  }
}
