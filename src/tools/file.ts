import * as fs from 'fs';
import * as path from 'path';

const ALLOWED_DIR = process.cwd(); // Only allow operations within the current working directory
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function isPathAllowed(targetPath: string): boolean {
    const resolvedPath = path.resolve(ALLOWED_DIR, targetPath);
    return resolvedPath.startsWith(ALLOWED_DIR);
}

export const readFileToolDefinition = {
    type: 'function',
    function: {
        name: 'read_file',
        description: 'Read the contents of a file.',
        parameters: {
            type: 'object',
            properties: {
                filePath: { type: 'string', description: 'Relative path to the file to read' }
            },
            required: ['filePath']
        }
    }
};

export const writeFileToolDefinition = {
    type: 'function',
    function: {
        name: 'write_file',
        description: 'Write string content to a file. Overwrites existing file.',
        parameters: {
            type: 'object',
            properties: {
                filePath: { type: 'string', description: 'Relative path to the file' },
                content: { type: 'string', description: 'Content to write' }
            },
            required: ['filePath', 'content']
        }
    }
};

export const listDirToolDefinition = {
    type: 'function',
    function: {
        name: 'list_dir',
        description: 'List files and directories in a given path.',
        parameters: {
            type: 'object',
            properties: {
                dirPath: { type: 'string', description: 'Relative path to directory. Use "." for current directory.' }
            },
            required: ['dirPath']
        }
    }
};

export const deleteFileToolDefinition = {
    type: 'function',
    function: {
        name: 'delete_file',
        description: 'Delete a file.',
        parameters: {
            type: 'object',
            properties: {
                filePath: { type: 'string', description: 'Relative path to the file' }
            },
            required: ['filePath']
        }
    }
};

export async function executeReadFile(args: any): Promise<string> {
    if (!isPathAllowed(args.filePath)) return `Access denied: path outside allowed directory.`;
    const resolvedPath = path.resolve(ALLOWED_DIR, args.filePath);

    if (!fs.existsSync(resolvedPath)) return `File not found in ${args.filePath}`;

    const stat = fs.statSync(resolvedPath);
    if (stat.size > MAX_FILE_SIZE) return `File is too large to read (Limit: ${MAX_FILE_SIZE / 1024 / 1024}MB).`;

    return fs.readFileSync(resolvedPath, 'utf-8');
}

export async function executeWriteFile(args: any): Promise<string> {
    if (!isPathAllowed(args.filePath)) return `Access denied: path outside allowed directory.`;
    const resolvedPath = path.resolve(ALLOWED_DIR, args.filePath);

    // Create directories if they don't exist
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(resolvedPath, args.content, 'utf-8');
    return `Successfully wrote to ${args.filePath}`;
}

export async function executeListDir(args: any): Promise<string> {
    if (!isPathAllowed(args.dirPath)) return `Access denied: path outside allowed directory.`;
    const resolvedPath = path.resolve(ALLOWED_DIR, args.dirPath);

    if (!fs.existsSync(resolvedPath)) return `Directory not found: ${args.dirPath}`;

    const items = fs.readdirSync(resolvedPath, { withFileTypes: true });
    return `Contents of ${args.dirPath}:\n` + items.map(i => `${i.isDirectory() ? '[DIR]' : '[FILE]'} ${i.name}`).join('\n');
}

export async function executeDeleteFile(args: any): Promise<string> {
    if (!isPathAllowed(args.filePath)) return `Access denied: path outside allowed directory.`;
    const resolvedPath = path.resolve(ALLOWED_DIR, args.filePath);

    if (!fs.existsSync(resolvedPath)) return `File not found: ${args.filePath}`;

    fs.unlinkSync(resolvedPath);
    return `Successfully deleted ${args.filePath}`;
}
