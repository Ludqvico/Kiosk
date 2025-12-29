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
                const { stdout } = await execAsync('wmic logicaldisk get name,size,freespace,caption');
                console.log('[FileManager] wmic output length:', stdout.length);
                const lines = stdout.trim().split('\n').slice(1); // Skip header

                for (const line of lines) {
                    // Output format: Caption  FreeSpace     Name  Size
                    // Example:      C:       1234567890    C:    9876543210
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        const name = parts[0]; // Caption seems safer
                        // wmic values can be weird, sanitize
                        const freeSpace = parseInt(parts.find(p => /^\d+$/.test(p)) || '0');
                        const size = parseInt(parts.reverse().find(p => /^\d+$/.test(p)) || '0');

                        if (size > 0) {
                            disks.push({
                                name,
                                size,
                                free: freeSpace,
                                usedPercent: Math.round(((size - freeSpace) / size) * 100)
                            });
                        }
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
