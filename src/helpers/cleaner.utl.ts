import * as fs from 'fs';
import * as path from 'path';

export async function cleanDirectories(dirs: string[]): Promise<void> {
  for (const dir of dirs) {
    const fullPath = path.resolve(dir);

    try {
      if (fs.existsSync(fullPath)) {
        await fs.promises.rm(fullPath, { recursive: true, force: true });
        console.log(`🧹 Cleaned: ${fullPath}`);
      } else {
        console.log(`⚠️ Directory not found, skipping: ${fullPath}`);
      }
    } catch (error) {
      console.error(`💥 Failed to clean ${fullPath}:`, error);
    }
  }
}
