#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateMasterKey, encryptBuffer, decryptBuffer, splitKey, combineKeys } from '../lib/crypto.js';
import { createBundle, parseBundle } from '../lib/bundle.js';

const program = new Command();
const API_BASE = process.env.UNLOCKAT_API_URL || 'http://localhost:3000/api';

program
    .name('unlockat')
    .description('Secure, Time-Gated File Encryption CLI')
    .version('1.0.0');

program
    .command('lock')
    .description('Encrypt a file until a specific date')
    .argument('<file>', 'File to encrypt')
    .argument('<date>', 'Unlock date (e.g., "2027-01-01")')
    .action(async (file, date) => {
        try {
            console.log(chalk.blue('🔐 Initializing local encryption...'));

            const buffer = await fs.readFile(file);
            const masterKey = generateMasterKey();
            const { fragmentA, fragmentB } = splitKey(masterKey);

            const { iv, encryptedData } = encryptBuffer(buffer, masterKey);

            console.log(chalk.yellow('🛰️ Sending Fragment B to Time Oracle...'));

            const response = await fetch(`${API_BASE}/store-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fragmentB: fragmentB.toString('hex'),
                    targetTimestamp: new Date(date).getTime()
                })
            });

            if (!response.ok) {
                const errBody = await response.json().catch(() => ({}));
                throw new Error(errBody.error || `Server error: ${response.statusText}`);
            }

            const { keyId } = await response.json();

            const metadata = {
                originalName: path.basename(file),
                keyId,
                targetTimestamp: new Date(date).getTime()
            };

            const bundle = createBundle(encryptedData, fragmentA, iv, metadata);
            const outPath = `${file}.unlockat`;
            await fs.writeFile(outPath, bundle);

            const localDate = new Date(metadata.targetTimestamp);
            const offset = -localDate.getTimezoneOffset() / 60;
            const offsetStr = `GMT${offset >= 0 ? '+' : ''}${offset}`;

            console.log(chalk.green('✨ Success! File is now time-locked.'));
            console.log(chalk.dim(`Unlock Date: ${localDate.toLocaleString()} (${offsetStr})`));
            console.log(chalk.dim(`Key ID: ${keyId}`));
            console.log(chalk.dim(`Output: ${outPath}`));
        } catch (err) {
            console.error(chalk.red('❌ Error:'), err.message);
            process.exit(1);
        }
    });

program
    .command('open')
    .description('Decrypt a locked .unlockat file')
    .argument('<file>', '.unlockat file to decrypt')
    .action(async (file) => {
        try {
            console.log(chalk.blue('🔓 Reading encrypted bundle...'));
            const buffer = await fs.readFile(file);
            const parsed = parseBundle(buffer);

            console.log(chalk.yellow('🕰️ Requesting missing key fragment from Time Oracle...'));

            const response = await fetch(`${API_BASE}/request-key?keyId=${parsed.metadata.keyId}`);

            if (response.status === 403) {
                const body = await response.json();
                const unlockDate = new Date(body.unlockDate);
                const offset = -unlockDate.getTimezoneOffset() / 60;
                const offsetStr = `GMT${offset >= 0 ? '+' : ''}${offset}`;

                console.log(chalk.red('🛑 Access Denied: File is still locked.'));
                console.log(chalk.dim(`Remaining: ${body.remainingSeconds} seconds`));
                console.log(chalk.dim(`Unlock Date: ${unlockDate.toLocaleString()} (${offsetStr})`));
                return;
            }

            if (!response.ok) {
                const errBody = await response.json().catch(() => ({}));
                throw new Error(errBody.error || `Server error: ${response.statusText}`);
            }

            const { fragmentB } = await response.json();
            const fragBBuf = Buffer.from(fragmentB, 'hex');

            console.log(chalk.blue('🔑 Reconstructing key and decrypting locally...'));
            const reconstructedKey = combineKeys(parsed.fragmentA, fragBBuf);
            const decrypted = decryptBuffer(parsed.encryptedData, reconstructedKey, parsed.iv);

            const outPath = parsed.metadata.originalName || 'decrypted_file';
            await fs.writeFile(outPath, decrypted);

            console.log(chalk.green('✨ Decryption Success! Original file recovered.'));
            console.log(chalk.dim(`Output: ${outPath}`));
        } catch (err) {
            console.error(chalk.red('❌ Error:'), err.message);
            process.exit(1);
        }
    });

program.parse();
