import * as fs from 'fs/promises';
import { constants } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class FileManager {

    // Get list of disks/drives
    static async getDisks() {
        console.log('[FileManager] getDisks called');
        try {
            const platform = os.platform();
            const disks: Array<{ name: string; size: number; free: number; usedPercent: number }> = [];

            if (platform === 'win32') {
                console.log('[FileManager] Platform is win32, executing wmic...');
                // Use WMIC on Windows
                // Use WMIC with CSV format for easier parsing
                // wmic logicaldisk get name,size,freespace,caption /format:csv
                const { stdout } = await execAsync('wmic logicaldisk get caption,size,freespace /format:csv');

                // Output format:
                // Node,Caption,FreeSpace,Size
                // MACHINE,C:,12345,67890

                const lines = stdout.trim().split('\n');
                // First line is empty or header, find header

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('Node')) continue; // Skip empty or header

                    const parts = trimmed.split(',');
                    if (parts.length >= 4) {
                        // Node, Caption, FreeSpace, Size
                        // Note: wmic csv output order depends on query but usually reliable if we check
                        // Actually /format:csv output lines are: Node,Property1,Property2... sorted alphabetically by property name?
                        // Let's re-parse safely. 

                        // Wait, wmic /format:csv is:
                        // Node,Caption,FreeSpace,Size  (Alphabetical properties?)
                        // "Node" is always first.
                        // Let's use specific column selection to be sure? 
                        // It's safer to just fetch and use key-value list? No, List is multiline.
                        // CSV is standard.

                        // Let's assume standard CSV: Node,Caption,FreeSpace,Size
                        // But verifying column order is hard without a library.

                        // Fallback: simplified parsing logic used before but improved regex

                        // Let's go back to standard text output and parse more defensively.
                        // Standard: Caption  FreeSpace     Size
                        // C:       100       200
                    }
                }

                // Retrying standard text but with strict column logic fails if columns merge.
                // Let's use `wmic logicaldisk get caption,size,freespace /format:list`
                // This output:
                // Caption=C:
                // FreeSpace=123
                // Size=456

                const { stdout: listOut } = await execAsync('wmic logicaldisk get caption,size,freespace /format:list');
                const chunks = listOut.trim().split(/\n\s*\n/); // Empty line between objects

                for (const chunk of chunks) {
                    const lines = chunk.split('\n');
                    let name = '';
                    let size = 0;
                    let free = 0;

                    for (const l of lines) {
                        const [key, val] = l.trim().split('=');
                        if (!key || !val) continue;

                        if (key.toLowerCase() === 'caption') name = val;
                        if (key.toLowerCase() === 'size') size = parseInt(val);
                        if (key.toLowerCase() === 'freespace') free = parseInt(val);
                    }

                    if (name && size > 0) {
                        disks.push({
                            name,
                            size,
                            free,
                            usedPercent: Math.round(((size - free) / size) * 100)
                        });
                    }
                }
            } else {
                console.log('[FileManager] Platform is *nix, executing df...');
                // Use df on *nix/mac
                const { stdout } = await execAsync('df -kP');
                const lines = stdout.trim().split('\n').slice(1);

                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 6) {
                        const name = parts[5]; // Mounted on
                        const size = parseInt(parts[1]) * 1024; // kbytes to bytes
                        const free = parseInt(parts[3]) * 1024;
                        const usedPercent = parseInt(parts[4].replace('%', ''));

                        // Filter out pseudo-filesystems mostly
                        if (name === '/' || name.startsWith('/media') || name.startsWith('/mnt') || name.startsWith('/Volumes')) {
                            disks.push({ name, size, free, usedPercent });
                        }
                    }
                }
            }
            console.log('[FileManager] getDisks found:', disks.length, 'disks');
            return disks;
        } catch (error: any) {
            console.error('Error getting disks:', error);
            // Fallback: return root
            return [{ name: path.parse(process.cwd()).root, size: 0, free: 0, usedPercent: 0 }];
        }
    }

    // List directory
    static async listDir(dirPath: string) {
        try {
            // Normalize path
            dirPath = path.resolve(dirPath || '/');

            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            const files = await Promise.all(entries.map(async (entry) => {
                try {
                    const fullPath = path.join(dirPath, entry.name);
                    const stats = await fs.stat(fullPath);

                    return {
                        name: entry.name,
                        path: fullPath,
                        isDirectory: entry.isDirectory(),
                        size: stats.size,
                        modified: stats.mtime,
                        created: stats.birthtime,
                        extension: path.extname(entry.name).toLowerCase()
                    };
                } catch (e) {
                    return null; // Skip inaccessible files
                }
            }));

            // Filter nulls and sort (folders first)
            return files
                .filter(f => f !== null)
                .sort((a, b) => {
                    if (a!.isDirectory === b!.isDirectory) {
                        return a!.name.localeCompare(b!.name);
                    }
                    return a!.isDirectory ? -1 : 1;
                });
        } catch (error: any) {
            throw new Error(`Failed to list directory: ${error.message}`);
        }
    }

    // Other operations...
    static async readFile(filePath: string) {
        try {
            // For safety, maybe limit size? But admin requested feature so assume trust.
            // We return base64 for safe transport via JSON socket
            const content = await fs.readFile(filePath, { encoding: 'base64' });
            return content;
        } catch (error: any) {
            throw new Error(`Failed to read file: ${error.message}`);
        }
    }

    static async writeFile(filePath: string, contentBase64: string) {
        try {
            const buffer = Buffer.from(contentBase64, 'base64');
            await fs.writeFile(filePath, buffer);
            return true;
        } catch (error: any) {
            throw new Error(`Failed to write file: ${error.message}`);
        }
    }

    static async delete(targetPath: string) {
        try {
            const stats = await fs.stat(targetPath);
            if (stats.isDirectory()) {
                await fs.rm(targetPath, { recursive: true, force: true });
            } else {
                await fs.unlink(targetPath);
            }
            return true;
        } catch (error: any) {
            throw new Error(`Failed to delete: ${error.message}`);
        }
    }

    static async rename(oldPath: string, newPath: string) {
        try {
            await fs.rename(oldPath, newPath);
            return true;
        } catch (error: any) {
            throw new Error(`Failed to rename: ${error.message}`);
        }
    }

    static async mkdir(dirPath: string) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
            return true;
        } catch (error: any) {
            throw new Error(`Failed to create directory: ${error.message}`);
        }
    }

    static async copy(src: string, dest: string) {
        try {
            await fs.cp(src, dest, { recursive: true });
            return true;
        } catch (error: any) {
            throw new Error(`Failed to copy: ${error.message}`);
        }
    }
}
