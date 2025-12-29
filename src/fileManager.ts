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
                console.log('[FileManager] Platform is win32, executing PowerShell for disks...');
                try {
                    // Use PowerShell to get JSON output - far more reliable than parsing WMIC text
                    const cmd = `powershell -NoProfile -Command "Get-WmiObject Win32_LogicalDisk | Select-Object DeviceID, Size, FreeSpace | ConvertTo-Json"`;
                    const { stdout } = await execAsync(cmd);
                    const output = stdout.trim();

                    if (output) {
                        let data = JSON.parse(output);
                        // ConvertTo-Json returns a single object if only one result, or an array
                        if (!Array.isArray(data)) {
                            data = [data];
                        }

                        for (const disk of data) {
                            const name = disk.DeviceID;
                            const size = parseInt(disk.Size || '0');
                            const free = parseInt(disk.FreeSpace || '0');

                            if (name && size > 0) {
                                disks.push({
                                    name,
                                    size,
                                    free,
                                    usedPercent: Math.round(((size - free) / size) * 100)
                                });
                            }
                        }
                    }
                } catch (psError) {
                    console.error('[FileManager] PowerShell failed:', psError);
                    // Fallback to WMIC if PowerShell fails (e.g. very old systems or restricted execution policy)
                    console.log('[FileManager] Attempting WMIC fallback...');
                    try {
                        const { stdout } = await execAsync('wmic logicaldisk get caption,size,freespace /format:csv');
                        const lines = stdout.trim().split('\n');
                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || trimmed.startsWith('Node')) continue;

                            // CSV: Node,Caption,FreeSpace,Size  (Usually)
                            // But safest is to try to find the parts that look like C: and numbers
                            const parts = trimmed.split(',');
                            // Simple heuristic search for the drive data
                            const name = parts.find(p => /^[A-Z]:$/i.test(p));
                            // Find two large numbers
                            const numbers = parts.filter(p => /^\d+$/.test(p)).map(p => parseInt(p)).sort((a, b) => b - a);

                            if (name && numbers.length >= 2) {
                                const size = numbers[0]; // Largest is size
                                const free = numbers[1]; // Smaller is free (usually)
                                // Only caveat: if free > size? Impossible physically.

                                if (size > 0) {
                                    disks.push({
                                        name,
                                        size,
                                        free,
                                        usedPercent: Math.round(((size - free) / size) * 100)
                                    });
                                }
                            }
                        }
                    } catch (wmicError) {
                        console.error('[FileManager] WMIC fallback failed:', wmicError);
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
