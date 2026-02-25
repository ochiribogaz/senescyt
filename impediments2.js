import { createInterface } from 'readline/promises';
import cliProgress from 'cli-progress';
import { retrieveImpediments, consolidateCertificates } from './retrieveImpediments.js';
import { calculateBrowserCount } from './utils/browserResources.js';
import people from './impedimentsCari.json' assert { type: 'json' };

const rl = createInterface({ input: process.stdin, output: process.stdout });

const ask = (question) => rl.question(question).then(a => a.trim());

const batchPeople = (arr, n) => {
    const size = Math.ceil(arr.length / n);
    return Array.from({ length: n }, (_, i) => arr.slice(i * size, (i + 1) * size))
        .filter(batch => batch.length > 0);
};

const formatDuration = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
};

(async () => {
    try {
        const { cpuCount, totalMemoryGB, availableMemoryGB, recommended } =
            calculateBrowserCount(people.length);

        console.log('\n--- System Info ---');
        console.log(`CPUs:              ${cpuCount}`);
        console.log(`Total RAM:         ${totalMemoryGB} GB`);
        console.log(`Available RAM:     ${availableMemoryGB} GB`);
        console.log('-------------------');
        console.log(`People to process:    ${people.length}`);
        console.log(`Recommended browsers: ${recommended}`);

        let browserCount;
        const confirm = await ask(`\nUse ${recommended} browser(s)? (y/n): `);

        if (confirm.toLowerCase() === 'y') {
            browserCount = recommended;
        } else {
            const input = await ask('Enter number of browsers: ');
            browserCount = Math.max(1, parseInt(input, 10) || 1);
        }

        rl.close();

        const batches = batchPeople(people, browserCount);

        console.log(`\nStarting ${batches.length} browser(s) — ${batches.map(b => b.length).join(', ')} people each...\n`);

        const multibar = new cliProgress.MultiBar({
            clearOnComplete: false,
            hideCursor: true,
            format: ' Progress |{bar}| {value}/{total} ({percentage}%)',
        }, cliProgress.Presets.shades_grey);

        const bar = multibar.create(people.length, 0);

        let processed = 0;
        const startTime = Date.now();
        const startCpu = process.cpuUsage();

        const onProgress = ({ id, name, success, error }) => {
            processed++;
            bar.update(processed);
            if (success) {
                multibar.log(`[${processed}/${people.length}] SUCCESS: ${name}\n`);
            } else {
                multibar.log(`[${processed}/${people.length}] ERROR [${id}] ${name}: ${error.message}\n`);
            }
        };

        const batchResults = await Promise.all(
            batches.map(batch => retrieveImpediments({ people: batch, onProgress }))
        );

        multibar.stop();

        const elapsedMs = Date.now() - startTime;
        const cpuUsage = process.cpuUsage(startCpu);
        const cpuUserSec   = (cpuUsage.user   / 1_000_000).toFixed(2);
        const cpuSystemSec = (cpuUsage.system / 1_000_000).toFixed(2);

        const allResults = batchResults.flatMap(r => r.results);
        const allErrors  = batchResults.flatMap(r => r.errors);

        console.log(`\nConsolidating ${allResults.length} certificate(s)...`);
        consolidateCertificates(allResults);

        console.log('\n--- Report ---');
        console.log(`Execution time:  ${formatDuration(elapsedMs)}`);
        console.log(`CPU user time:   ${cpuUserSec}s`);
        console.log(`CPU system time: ${cpuSystemSec}s`);
        console.log(`Processed:       ${people.length}`);
        console.log(`Success:         ${allResults.length}`);
        console.log(`Errors:          ${allErrors.length}`);

        if (allErrors.length) {
            console.log('\n--- Errors ---');
            allErrors.forEach(({ person, error }) =>
                console.error(`  [${person.id}] ${person.name}: ${error.message}`)
            );
        }

        console.log('\nDone.');
    } catch (error) {
        rl.close();
        console.error(error);
    }
})();
