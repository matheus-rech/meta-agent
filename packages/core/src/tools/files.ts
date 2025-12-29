/**
 * File Tools
 * File system operations for the research project
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export class FileTools {
  private workDir: string;
  
  constructor(workDir: string) {
    this.workDir = workDir;
  }
  
  /**
   * Read a file
   */
  async read(filePath: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    return fs.readFile(fullPath, 'utf-8');
  }
  
  /**
   * Write to a file
   */
  async write(filePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }
  
  /**
   * Append to a file
   */
  async append(filePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.appendFile(fullPath, content);
  }
  
  /**
   * Check if file exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(filePath));
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Delete a file
   */
  async delete(filePath: string): Promise<void> {
    await fs.unlink(this.resolvePath(filePath));
  }
  
  /**
   * Copy a file
   */
  async copy(src: string, dest: string): Promise<void> {
    const srcPath = this.resolvePath(src);
    const destPath = this.resolvePath(dest);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(srcPath, destPath);
  }
  
  /**
   * Move a file
   */
  async move(src: string, dest: string): Promise<void> {
    const srcPath = this.resolvePath(src);
    const destPath = this.resolvePath(dest);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.rename(srcPath, destPath);
  }
  
  /**
   * List directory contents
   */
  async listDir(dirPath: string): Promise<string[]> {
    const fullPath = this.resolvePath(dirPath);
    return fs.readdir(fullPath);
  }
  
  /**
   * List files with extension
   */
  async listFiles(dirPath: string, extension: string): Promise<string[]> {
    const files = await this.listDir(dirPath);
    return files.filter(f => f.endsWith(extension));
  }
  
  /**
   * Create directory
   */
  async mkdir(dirPath: string): Promise<void> {
    await fs.mkdir(this.resolvePath(dirPath), { recursive: true });
  }
  
  /**
   * Get file info
   */
  async getInfo(filePath: string): Promise<{
    size: number;
    created: Date;
    modified: Date;
    isDirectory: boolean;
  }> {
    const stats = await fs.stat(this.resolvePath(filePath));
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isDirectory: stats.isDirectory(),
    };
  }
  
  /**
   * Read JSON file
   */
  async readJson<T = any>(filePath: string): Promise<T> {
    const content = await this.read(filePath);
    return JSON.parse(content);
  }
  
  /**
   * Write JSON file
   */
  async writeJson(filePath: string, data: any, pretty: boolean = true): Promise<void> {
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await this.write(filePath, content);
  }
  
  /**
   * Read CSV file as array of objects
   */
  async readCsv(filePath: string): Promise<Record<string, string>[]> {
    const content = await this.read(filePath);
    const lines = content.trim().split('\n');
    
    if (lines.length === 0) return [];
    
    const headers = this.parseCsvLine(lines[0]);
    const rows: Record<string, string>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const row: Record<string, string> = {};
      
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] || '';
      }
      
      rows.push(row);
    }
    
    return rows;
  }
  
  /**
   * Parse CSV line handling quotes
   */
  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  }
  
  /**
   * Write CSV file from array of objects
   */
  async writeCsv(filePath: string, data: Record<string, any>[]): Promise<void> {
    if (data.length === 0) {
      await this.write(filePath, '');
      return;
    }
    
    const headers = Object.keys(data[0]);
    const lines = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(h => {
        const value = row[h];
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      lines.push(values.join(','));
    }
    
    await this.write(filePath, lines.join('\n'));
  }
  
  /**
   * Find files matching pattern
   */
  async findFiles(pattern: string, dirPath: string = '.'): Promise<string[]> {
    const results: string[] = [];
    const regex = new RegExp(pattern.replace('*', '.*'));
    
    const searchDir = async (dir: string) => {
      const entries = await fs.readdir(this.resolvePath(dir), { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await searchDir(entryPath);
        } else if (regex.test(entry.name)) {
          results.push(entryPath);
        }
      }
    };
    
    await searchDir(dirPath);
    return results;
  }
  
  /**
   * Get working directory
   */
  getWorkDir(): string {
    return this.workDir;
  }
  
  /**
   * Resolve path relative to work directory
   */
  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(this.workDir, filePath);
  }
  
  /**
   * Create project structure
   */
  async createProjectStructure(): Promise<void> {
    const dirs = [
      'protocol',
      'searches',
      'screening',
      'extractions',
      'quality_assessment',
      'analysis/scripts',
      'figures',
      'tables',
      'manuscript',
      'submission/supplementary',
      '.claude/commands',
      '.claude/skills',
    ];
    
    for (const dir of dirs) {
      await this.mkdir(dir);
    }
  }
  
  /**
   * Get project statistics
   */
  async getProjectStats(): Promise<{
    extractions: number;
    analyses: number;
    figures: number;
    manuscripts: number;
  }> {
    const count = async (dir: string, ext: string): Promise<number> => {
      try {
        const files = await this.listFiles(dir, ext);
        return files.length;
      } catch {
        return 0;
      }
    };
    
    return {
      extractions: await count('extractions', '.yaml'),
      analyses: await count('analysis/scripts', '.R'),
      figures: await count('figures', '.png'),
      manuscripts: await count('manuscript', '.md'),
    };
  }
}

export default FileTools;
