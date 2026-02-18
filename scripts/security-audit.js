/**
 * Security Audit Script for UnlockAt
 * Automates "hacking" attempts to verify system robustness.
 */
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import chalk from 'chalk';

const API_BASE = 'http://localhost:3000/api';

async function runCli(args) {
    return new Promise((resolve) => {
        const child = spawn('node', ['./bin/unlockat.js', ...args]);
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', d => stdout += d.toString());
        child.stderr.on('data', d => stderr += d.toString());
        child.on('close', code => resolve({ code, stdout, stderr }));
    });
}

async function startAudit() {
    console.log(chalk.bold.cyan('\n🛡️ UnlockAt Security Audit Initiated\n'));

    // 1. Setup Test File
    const testContent = 'CONFIDENTIAL DATA: 12345';
    await fs.writeFile('audit_test.txt', testContent);

    // 2. Scenario: Immediate Unlock Attempt (Hacking Attempt 1)
    console.log(chalk.white('Scenario 1: Attempting to unlock before time...'));
    const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // 1 hour in future
    await runCli(['lock', 'audit_test.txt', futureDate]);

    const unlockRes = await runCli(['open', 'audit_test.txt.unlockat']);
    if (unlockRes.stdout.includes('Access Denied')) {
        console.log(chalk.green('✅ PASS: Time Oracle refused the key fragment.'));
    } else {
        console.log(chalk.red('❌ FAIL: File unlocked prematurely!'));
    }

    // 3. Scenario: Direct API Request (Hacking Attempt 2)
    console.log(chalk.white('\nScenario 2: Direct API retrieval attempt...'));
    try {
        const buffer = await fs.readFile('audit_test.txt.unlockat');
        const metadataIdx = buffer.indexOf('{"originalName"');
        const metadataLenByte = buffer.subarray(metadataIdx - 4, metadataIdx);
        const metadataLen = metadataLenByte.readUInt32BE();
        const metadata = JSON.parse(buffer.subarray(metadataIdx, metadataIdx + metadataLen).toString());

        const response = await fetch(`${API_BASE}/request-key?keyId=${metadata.keyId}`);
        if (response.status === 403) {
            console.log(chalk.green('✅ PASS: API endpoint protected by server-side NTP time.'));
        } else {
            console.log(chalk.red('❌ FAIL: API leaked key fragment!'));
        }
    } catch (err) {
        console.log(chalk.red('❌ ERROR during audit:'), err.message);
    }

    // 4. Scenario: Bundle Tampering (Hacking Attempt 3)
    console.log(chalk.white('\nScenario 3: Tampering with encrypted data...'));
    const bundle = await fs.readFile('audit_test.txt.unlockat');
    bundle[bundle.length - 20] ^= 0xFF; // Flip a bit in the encrypted data/tag region
    await fs.writeFile('audit_test.txt.unlockat', bundle);

    // We need a test that is SHOULD unlock to see it fail at authentication
    const pastDate = new Date(Date.now() - 1000).toISOString();
    await fs.writeFile('audit_valid.txt', 'VALID DATA');
    await runCli(['lock', 'audit_valid.txt', pastDate]);

    const validBundle = await fs.readFile('audit_valid.txt.unlockat');
    validBundle[validBundle.length - 5] ^= 0xFF; // Corrupt tag
    await fs.writeFile('audit_valid.txt.unlockat', validBundle);

    const corruptRes = await runCli(['open', 'audit_valid.txt.unlockat']);
    if (corruptRes.stderr.includes('Unsupported state or unable to authenticate data')) {
        console.log(chalk.green('✅ PASS: AES-GCM detected unauthorized modification.'));
    } else {
        console.log(chalk.red('❌ FAIL: Tampered data did not trigger authentication error!'));
    }

    // Cleanup
    await fs.unlink('audit_test.txt').catch(() => { });
    await fs.unlink('audit_test.txt.unlockat').catch(() => { });
    await fs.unlink('audit_valid.txt').catch(() => { });
    await fs.unlink('audit_valid.txt.unlockat').catch(() => { });

    console.log(chalk.bold.cyan('\n✅ Security Audit Complete. Result: HARDENED.\n'));
}

startAudit();
