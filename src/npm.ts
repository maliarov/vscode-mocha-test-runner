import {spawn} from 'child_process';

export function root(isGlobal): Promise<string> {
    return new Promise((resolve, reject) => {
        let output = '';
        let error = '';

        const npmProcess = spawn('npm', ['root', ...(isGlobal ? ['-g'] : [])]);

        npmProcess.stdout.on('data', (data) => output += data.toString());
        npmProcess.stderr.on('data', (data) => error += data.toString());
        npmProcess.on('close', (code) => code ? reject(error) : resolve(output.trim()));
    });
}